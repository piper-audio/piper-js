import {
    ConfigurationRequest,
    ConfigurationResponse,
    FinishRequest,
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

export class WebWorkerServer {
    private scope: DedicatedWorkerGlobalScope;
    private service: SynchronousService;

    constructor(workerScope: DedicatedWorkerGlobalScope,
                service: SynchronousService) {
        this.scope = workerScope;
        this.service = service;
        // TODO reduce dupe with web-worker-streaming
        const onMessageToWrap: (ev: MessageEvent) => any = this.scope.onmessage;
        this.scope.onmessage = (e: MessageEvent) => {
            if (onMessageToWrap) {
                onMessageToWrap(e);
            }
            this.handleRequest(e.data);
        };
    }

    private routeRequest(request: RequestMessage<any>): void {
        try {
            switch (request.method) {
                case 'list':
                    this.sendResponse(
                        request,
                        this.service.list(request.params)
                    );
                    break;
                case 'load':
                    this.sendResponse(
                        request,
                        this.service.load(request.params)
                    );
                    break;
                case 'configure':
                    this.sendResponse(
                        request,
                        this.service.configure(request.params)
                    );
                    break;
                case 'process':
                    this.sendResponse(
                        request,
                        this.service.process(request.params)
                    );
                    break;
                case 'finish':
                    this.sendResponse(
                        request,
                        this.service.finish(request.params)
                    );
                    break;
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
            this.sendError(request, 'Invalid request');
        }
    }

    private isValidRequestShape(req: Partial<RequestMessage<any>>): boolean {
        return req.params != null && req.id != null && req.method != null;
    }

    private sendError(info: ResponseInfo, message: string) {
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