
// TypeScript has a .d.ts file for webworkers,
// but tsconfig cannot use both dom and webworker definitions
// so stub out a basic type here for now
import {StreamingService} from "../streaming";
import {
    ErrorResponse,
    RequestMessage,
    ResponseData,
    ResponseInfo
} from "../protocols/web-worker";
export interface DedicatedWorkerGlobalScope {
    onmessage: (this: this, ev: MessageEvent) => any;
    postMessage(data: any): void;
    importScripts(uri: string): void;
}

export class WebWorkerStreamingServer {
    private service: StreamingService;
    private scope: DedicatedWorkerGlobalScope;

    constructor(workerScope: DedicatedWorkerGlobalScope,
                service: StreamingService) {
        this.service = service;
        this.scope = workerScope;
        const onMessageToWrap: (ev: MessageEvent) => any = this.scope.onmessage;
        this.scope.onmessage = (e: MessageEvent) => {
            if (onMessageToWrap) {
                onMessageToWrap(e);
            }
            this.handleRequest(e.data);
        };
    }

    private handleRequest(request: RequestMessage<any>): void {
        if (this.isValidRequestShape(request)) {
            this.routeRequest(request);
        } else {
            this.sendError(request, "Invalid request");
        }
    }

    private isValidRequestShape(req: Partial<RequestMessage<any>>): boolean {
        return req.params != null && req.id != null && req.method != null;
    }

    private routeRequest(request: RequestMessage<any>): void {
        switch (request.method) {
            case "list":
                this.service.list(request.params)
                    .then(response => this.sendResponse(request, response))
                    .catch(err => this.sendError(request, err));
                break;
            case "process":
                this.createObservable(request);
                break;
            default:
                this.sendError(request, "Invalid request type");
        }
    }

    private createObservable(request: RequestMessage<any>): void {
        this.service.process(request.params)
            .subscribe(
                (response) => this.sendResponse(request, response),
                (err) => this.sendError(request, err),
                () => this.sendComplete(request)
            );
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

    private sendComplete(info: ResponseInfo) {
        this.sendResponse({
                id: info.id,
                method: "finish"
            },
            {}
        );
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