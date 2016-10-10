/**
 * Created by lucast on 30/08/2016.
 */
import {StaticData, Configuration, OutputList, ProcessInput, AdapterFlags} from "./FeatureExtractor";
import {FeatureSet} from "./Feature";

export interface RpcRequest {
    method: string;
    params?: any; // TODO create a more meaningful type for this
}

export interface ResponseError {
    code: number;
    message: string;
}

export interface RpcResponse {
    method: string;
    result?: any; // TODO create a more meaningful type for this
    error?: ResponseError;
}

// Types used in the application

export type ExtractorHandle = number;

export interface ListRequest {
}

export interface ListResponse {
    available: StaticData[];
}

export interface LoadRequest {
    key: string;
    inputSampleRate: number;
    adapterFlags: AdapterFlags[];
}

export interface LoadResponse {
    handle: ExtractorHandle;
    staticData: StaticData;
    defaultConfiguration: Configuration;
}

export interface ConfigurationRequest {
    handle: ExtractorHandle;
    configuration: Configuration;
}

export interface ConfigurationResponse {
    handle: ExtractorHandle;
    outputList: OutputList;
}

export interface ProcessRequest {
    handle: ExtractorHandle;
    processInput: ProcessInput;
}

export interface ProcessResponse {
    handle: ExtractorHandle;
    features: FeatureSet;
}

export interface FinishRequest {
    handle: ExtractorHandle;
}

export type FinishResponse = ProcessResponse;

//

export abstract class Protocol {
    public transport: Transport;

    constructor(transport: Transport) {
        this.transport = transport;
    }

    // writing
    abstract writeListRequest(request: ListRequest): void;
    abstract writeListResponse(response: ListResponse): void;
    abstract writeLoadRequest(request: LoadRequest): void;
    abstract writeLoadResponse(response: LoadResponse): void;
    abstract writeConfigurationRequest(request: ConfigurationRequest): void;
    abstract writeConfigurationResponse(response: ConfigurationResponse): void;
    abstract writeProcessRequest(request: ProcessRequest): void;
    abstract writeProcessResponse(response: ProcessResponse): void;
    abstract writeFinishRequest(request: FinishRequest): void;
    abstract writeFinishResponse(response: FinishResponse): void;

    // reading
    abstract readListRequest(): Promise<ListRequest>;
    abstract readListResponse(): Promise<ListResponse>;
    abstract readLoadRequest(): Promise<LoadRequest>;
    abstract readLoadResponse(): Promise<LoadResponse>;
    abstract readConfigurationRequest(): Promise<ConfigurationRequest>;
    abstract readConfigurationResponse(): Promise<ConfigurationResponse>;
    abstract readProcessRequest(): Promise<ProcessRequest>;
    abstract readProcessResponse(): Promise<ProcessResponse>;
    abstract readFinishRequest(): Promise<FinishRequest>;
    abstract readFinishResponse(): Promise<FinishResponse>;
}

export type TransportData = string;

export interface Transport {
    read(): Promise<TransportData>;
    write(buffer: TransportData): void;
    flush(): void;
}

export interface Service {
    list(request: ListRequest): Promise<ListResponse>;
    load(request: LoadRequest) : Promise<LoadResponse>;
    configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    process(request: ProcessRequest): Promise<ProcessResponse>;
    finish(request: FinishRequest): Promise<FinishResponse>;
}