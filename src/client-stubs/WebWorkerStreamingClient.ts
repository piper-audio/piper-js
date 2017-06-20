/**
 * Created by lucas on 10/04/2017.
 */
import {StreamingResponse, StreamingService} from "../StreamingService";
import {ListRequest, ListResponse} from "../Piper";
import {SimpleRequest} from "../HigherLevelUtilities";
import {Observable} from "rxjs";
import {
    ErrorResponse,
    RequestId, RequestMessage, ResponseData,
    ResponseMessage, SuccessfulResponse, WebMethod
} from "../protocols/WebWorkerProtocol";


export type RequestIdProvider = Iterator<RequestId>;

export function* countingIdProvider(seed: number): RequestIdProvider {
    while (true) {
        yield `${seed++}`;
    }
}

type ResponseObservable = Observable<ResponseMessage<ListResponse
    | StreamingResponse>>;
export class WebWorkerStreamingClient implements StreamingService {
    private worker: Worker;
    private idProvider: RequestIdProvider;
    private messages$: ResponseObservable;
    private running: RequestId[];

    constructor(worker: Worker, idProvider: RequestIdProvider) {
        this.worker = worker;
        this.idProvider = idProvider;
        this.messages$ = Observable.fromEvent(this.worker, "message")
            .do((val: ResponseMessage<any>) => {
                // TODO piper specific exception types
                if (!this.running.includes(val.data.id)) {
                    throw new Error(`Invalid response id`);
                }
                if (!["list", "process", "finish"].includes(val.data.method)) {
                    throw new Error("Invalid response type");
                }
                if (this.isErrorResponse(val.data)) {
                    const error = val.data.error;
                    throw new Error(`${error.code}: ${error.message}`);
                }
            })
            .share();
        this.running = [];
    }

    list(request: ListRequest): Promise<ListResponse> {
        const id: RequestId = this.idProvider.next().value;
        const method: WebMethod = "list";

        const list$: Observable<ListResponse> =
            this.createResponseObserver<ListRequest>({
                    id: id,
                    method: method,
                    params: request
                }
            )
            .filter(res => (res. data as SuccessfulResponse<ListResponse>)
                .result.available !== undefined) /* TODO should this throw?*/
            .map<ResponseMessage<any>, ListResponse>(res =>
                (res.data as SuccessfulResponse<ListResponse>).result)
            .take(1);
        return list$.toPromise();
    }

    process(request: SimpleRequest): Observable<StreamingResponse> {
        return this.createFeatureStream(request);
    }

    private createFeatureStream(request: SimpleRequest)
    : Observable<StreamingResponse> {
        const id: RequestId = this.idProvider.next().value;

        return this.createResponseObserver<SimpleRequest>({
                id: id,
                method: "process",
                params: request
            }
        )
        /*TODO inspect res.data to ensure valid StreamingResponse?*/
            .takeWhile(val => val.data.method !== "finish")
            .map<ResponseMessage<any>, StreamingResponse>(res =>
                (res.data as SuccessfulResponse<StreamingResponse>).result
            );
    }

    // TODO take predicate and also check response validity
    private createResponseObserver<T>(seedRequest: RequestMessage<T>): ResponseObservable {
        const sendRequest$: Observable<any> = Observable.create(() => {
            this.running.push(seedRequest.id);
            this.worker.postMessage(seedRequest);
        });

        return this.messages$
            .merge(sendRequest$)
            .filter(val => val.data.id === seedRequest.id)
            .finally(() => {
                const i = this.running.findIndex(id => id === seedRequest.id);
                if (i !== -1) {
                    this.running.splice(i, 1);
                }
            });
    }

    private isErrorResponse<T>(data: ResponseData<T>): data is ErrorResponse {
        return (data as ErrorResponse).error !== undefined;
    }
}