import {RpcMethod} from "./JsonProtocol";
export type RequestId = string;
export type WebMethod = RpcMethod | "collect";

export interface RequestMessage<RequestType> {
    method: WebMethod;
    id: RequestId;
    params: RequestType;
}

export interface ResponseInfo {
    method: WebMethod;
    id: RequestId;
}

export interface SuccessfulResponse<ResultType> extends ResponseInfo {
    result: ResultType;
}

export interface ErrorResponse extends ResponseInfo {
    error: {
        code: number;
        message: string;
    }
}

export type ResponseData<T> = SuccessfulResponse<T> | ErrorResponse;
export interface ResponseMessage<ResponseType> {
    data: ResponseData<ResponseType>;
}