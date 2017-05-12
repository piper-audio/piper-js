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

    constructor(worker: Worker, idProvider: RequestIdProvider) {
        this.worker = worker;
        this.idProvider = idProvider;
        this.messages$ = Observable.fromEvent(this.worker, "message");
    }

    list(request: ListRequest): Promise<ListResponse> {
        const id: RequestId = this.idProvider.next().value;
        const method: WebMethod = "list";

        const list$: Observable<ListResponse> =
            this.createThrowingObserver<ListRequest>({
                    id: id,
                    method: method,
                    params: request
                },
                method
            )
            .filter(res => (res. data as SuccessfulResponse<ListResponse>)
                .result.available !== undefined) /* TODO should this throw?*/
            .map<ResponseMessage<any>, ListResponse>(res =>
                (res.data as SuccessfulResponse<ListResponse>).result)
            .take(1);
        return list$.toPromise();
    }

    process(request: SimpleRequest): Observable<StreamingResponse> {
        return this.createFeatureStream(request, "process");
    }

    private createFeatureStream(request: SimpleRequest,
                                method: WebMethod): Observable<StreamingResponse> {
        const id: RequestId = this.idProvider.next().value;

        return this.createThrowingObserver<SimpleRequest>({
                id: id,
                method: method,
                params: request
            },
            method,
            "finish"
        )
        /*TODO inspect res.data to ensure valid StreamingResponse?*/
            .takeWhile(val => val.data.method !== "finish")
            .map<ResponseMessage<any>, StreamingResponse>(res =>
                (res.data as SuccessfulResponse<StreamingResponse>).result
            );
    }

    // TODO take predicate and also check response validity
    private createThrowingObserver<T>(seedRequest: RequestMessage<T>,
                                   ...method: WebMethod[]): ResponseObservable {
        const sendRequest$ = Observable.create(() => {
            this.worker.postMessage(seedRequest);
        });

        // TODO this won't work if multiple requests are being processed
        // perhaps errors shouldn't be thrown, and each observer should just
        // filter for matching id, allowing the other messages to pass through.
        // Then, it still may make sense to throw if the method doesn't match
        return this.messages$
            .merge(sendRequest$)
            .do((val: ResponseMessage<any>) => {
                // TODO piper specific exception types
                if (val.data.id !== seedRequest.id) {
                    throw new Error("Wrong response id");
                }
                if (!method.includes(val.data.method)) {
                    throw new Error("Wrong response type");
                }
                if (this.isErrorResponse(val.data)) {
                    const error = val.data.error;
                    throw new Error(`${error.code}: ${error.message}`);
                }
            });
    }

    private isErrorResponse<T>(data: ResponseData<T>): data is ErrorResponse {
        return (data as ErrorResponse).error !== undefined;
    }
}