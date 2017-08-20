import {
    ConfigurationRequest,
    ConfigurationResponse, ExtractorHandle, FeatureSet,
    FinishRequest, Framing,
    ListRequest,
    ListResponse,
    LoadRequest,
    LoadResponse,
    ProcessRequest,
    ProcessResponse,
    Service,
    SynchronousService
} from "./core";
import {DedicatedWorkerGlobalScope} from "./servers/web-worker-streaming";
import {
    ErrorResponse,
    RequestMessage,
    ResponseData,
    ResponseInfo,
    SuccessfulResponse
} from "./protocols/web-worker";
import {RequestIdProvider} from "./clients/web-worker-streaming";
import {segment, toProcessInputStream} from "./audio";

export class WebWorkerService implements Service {
    private pending: ResponseInfo & {running: boolean};
    private worker: Worker;
    private idProvider: RequestIdProvider;

    constructor(worker: Worker, idProvider: RequestIdProvider) {
        this.idProvider = idProvider;
        this.worker = worker;
        this.resetPending();
    }

    list(request: ListRequest): Promise<ListResponse> {
        return this.sendMessage({
            id: this.idProvider.next().value,
            method: 'list',
            params: request
        });
    }

    load(request: LoadRequest): Promise<LoadResponse> {
        return this.sendMessage({
            id: this.idProvider.next().value,
            method: 'load',
            params: request
        });
    }

    configure(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.sendMessage({
            id: this.idProvider.next().value,
            method: 'configure',
            params: request
        });
    }

    process(request: ProcessRequest): Promise<ProcessResponse> {
        return this.sendMessage({
            id: this.idProvider.next().value,
            method: 'process',
            params: request
        });
    }

    finish(request: FinishRequest): Promise<ProcessResponse> {
        return this.sendMessage({
            id: this.idProvider.next().value,
            method: 'finish',
            params: request
        });
    }

    private sendMessage<T, R>(request: RequestMessage<T>): Promise<R> {
        if (this.pending.running) {
            return Promise.reject('Only one request can be processed at a time');
        }
        return new Promise((res, rej) => {
            this.worker.onmessage = (val) => {
                const pending = {...this.pending};
                this.resetPending();
                if (pending.id !== val.data.id) {
                    return rej(new Error('Invalid response id'));
                }
                if (pending.method !== val.data.method) {
                    return rej(new Error('Invalid response method'));
                }
                if (this.isErrorResponse(val.data)) {
                    const error = val.data.error;
                    return rej(new Error(`${error.code}: ${error.message}`));
                }
                res((val.data as SuccessfulResponse<R>).result);
            };
            this.pending = {
                id: request.id,
                method: request.method,
                running: true
            };
            this.worker.postMessage(request);
        });
    }

    private resetPending(): void {
        this.pending = {
            id: null,
            method: null,
            running: false
        }
    };

    private isErrorResponse<T>(data: ResponseData<T>): data is ErrorResponse {
        return (data as ErrorResponse).error !== undefined;
    }
}

type ProcessHandler = (request: ProcessRequest) => ProcessResponse;
function handleProcess(request: ProcessRequest,
                       state: ExtractorState,
                       process: ProcessHandler): ProcessResponse {
    const {framing} = state || {framing: null};
    const hasCustomFraming = framing
        && framing.stepSize != null && framing.blockSize != null;
    const nChannels = request.processInput.inputBuffers.length;
    const shouldPerformMultiple = hasCustomFraming
        && nChannels
        && request.processInput.inputBuffers[0].length !== framing.blockSize;
    return shouldPerformMultiple ?
        processMultiple(request, state, process): process(request);
}

function processMultiple(request: ProcessRequest,
                         state: ExtractorState,
                         process: ProcessHandler): ProcessResponse {
    const {framing, sampleRate} = state;
    // TODO should offset by the timestamp in the request
    const blocks = toProcessInputStream(
        {
            frames: segment(
                framing.blockSize,
                framing.stepSize,
                request.processInput.inputBuffers
            ),
            format: {
                channelCount: request.processInput.inputBuffers.length,
                sampleRate
            }
        },
        framing.stepSize,
        request.processInput.timestamp
    );
    const combined: FeatureSet = new Map();
    for (const processInput of blocks) {
      const res = process({
          handle: request.handle,
          processInput
      });
      combine(res.features, combined);
    }
    return {
        handle: request.handle,
        features: combined
    };
}

function combine(inSet: FeatureSet, outSet: FeatureSet) {
    inSet.forEach((value, key) => {
        if (outSet.has(key)) {
            outSet.get(key).push(...value);
        } else {
            outSet.set(key, value);
        }
    });
    return outSet;
}

interface ExtractorState {
    sampleRate: number;
    framing: Framing;
}
export class WebWorkerServer {
    private scope: DedicatedWorkerGlobalScope;
    private createService: () => SynchronousService;
    private handleToState: Map<ExtractorHandle, ExtractorState>;
    private handleToService: Map<ExtractorHandle, SynchronousService>;

    constructor(workerScope: DedicatedWorkerGlobalScope,
                serviceFactory: () => SynchronousService) {
        this.scope = workerScope;
        this.createService = serviceFactory;
        this.handleToState = new Map();
        this.handleToService = new Map();
        // TODO reduce dupe with web-worker-streaming
        const onMessageToWrap: (ev: MessageEvent) => any = this.scope.onmessage;
        this.scope.onmessage = (e: MessageEvent) => {
            if (onMessageToWrap) {
                onMessageToWrap(e);
            }
            this.handleRequest(e.data);
        };
    }

    private getService(handle?: ExtractorHandle): SynchronousService {
        if (handle != null) {
            if (this.handleToService.has(handle)) {
                return this.handleToService.get(handle);
            } else {
                this.handleToService.set(handle, this.createService());
            }
        }
        return this.createService(); // will be garbage collected if not stored
    }

    private routeRequest(request: RequestMessage<any>): void {
        try {
            switch (request.method) {
                case 'list':
                    this.sendResponse(
                        request,
                        this.getService().list(request.params)
                    );
                    break;
                case 'load': {
                    const service = this.createService();
                    const res = service.load(request.params);
                    this.handleToService.set(res.handle, service);
                    this.handleToState.set(res.handle, {
                        sampleRate: request.params.inputSampleRate,
                        framing: {stepSize: null, blockSize: null}
                    });
                    this.sendResponse(
                        request,
                        res
                    );
                    break;
                }
                case 'configure': {
                    const service = this.getService(request.params.handle);
                    const config = service.configure(request.params);
                    if (this.handleToState.has(config.handle)) {
                        const current = this.handleToState.get(config.handle);
                        this.handleToState.set(config.handle, {
                            sampleRate: current.sampleRate,
                            framing: config.framing
                        });
                    }
                    this.sendResponse(
                        request,
                        config
                    );
                    break;
                }
                case 'process': {
                    const handle = request.params.handle;
                    const features = handleProcess(
                        request.params,
                        this.handleToState.get(request.params.handle),
                        (req) => this.getService(handle).process(req)
                    );
                    this.sendResponse(
                        request,
                        features
                    );
                    break;
                }
                case 'finish': {
                    const res = this.getService(
                        request.params.handle
                    ).finish(request.params);
                    this.handleToState.delete(res.handle);
                    this.handleToService.delete(res.handle);
                    this.sendResponse(
                        request,
                        res
                    );
                    break;
                }
                default:
                    this.sendError(request, 'Invalid request type');
            }
        } catch (e) {
            const getMessage = (e: any): string => {
                if (e instanceof Error) {
                    return e.message;
                }
                if (typeof e === 'string') {
                    return e;
                }
                return 'Error whilst processing request';
            };
            this.sendError(request, getMessage(e));
        }
    }

    // TODO reduce dupe from web-worker-streaming
    private handleRequest(request: RequestMessage<any>): void {
        if (this.isValidRequestShape(request)) {
            this.routeRequest(request);
        } else {
            const handle = request && request.params && request.params.handle;
            this.sendError(request, 'Invalid request', handle);
        }
    }

    private isValidRequestShape(req: Partial<RequestMessage<any>>): boolean {
        return req.params != null && req.id != null && req.method != null;
    }

    private sendError(info: ResponseInfo,
                      message: string,
                      handle?: ExtractorHandle) {
        if (handle != null) {
            this.handleToState.delete(handle);
            this.handleToService.delete(handle);
        }
        this.sendMessage<ErrorResponse>({
            id: info.id,
            method: info.method,
            error: {
                code: 0, /* TODO */
                message: message
            }
        });
    }

    private sendResponse<T>(info: ResponseInfo,
                            data: T): void {
        this.sendMessage<T>({
            id: info.id,
            method: info.method,
            result: data
        });
    }

    private sendMessage<T>(message: ResponseData<T>) {
        this.scope.postMessage(message);
    }
}

export * from './clients/web-worker-streaming';
export * from './servers/web-worker-streaming';
export * from './protocols/web-worker';