/**
 * Created by lucast on 30/08/2016.
 */
import {StaticData, Configuration, OutputList, ProcessInput, AdapterFlags} from "./FeatureExtractor";
import {FeatureSet} from "./Feature";

// Types used in the application

export type PluginHandle = number;

export interface ListResponse {
    plugins: StaticData[];
}

export interface LoadRequest {
    pluginKey: string;
    inputSampleRate: number;
    adapterFlags: AdapterFlags[];
}

export interface LoadResponse {
    pluginHandle: PluginHandle;
    staticData: StaticData;
    defaultConfiguration: Configuration;
}

export interface ConfigurationRequest {
    pluginHandle: PluginHandle;
    configuration: Configuration;
}

export interface ConfigurationResponse {
    pluginHandle: PluginHandle;
    outputList: OutputList;
}

export interface ProcessRequest {
    pluginHandle: PluginHandle;
    processInput: ProcessInput;
}

export interface ProcessResponse {
    pluginHandle: PluginHandle;
    features: FeatureSet;
}

export interface FinishRequest {
    pluginHandle: PluginHandle;
}

export type FinishResponse = ProcessResponse;

//

export abstract class Protocol {
    public transport: Transport;

    constructor(transport: Transport) {
        this.transport = transport;
    }

    // writing
    abstract writeListRequest(): void;
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
    abstract readListRequest(): void;
    abstract readListResponse(): ListResponse;
    abstract readLoadRequest(): LoadRequest;
    abstract readLoadResponse(): LoadResponse;
    abstract readConfigurationRequest(): ConfigurationRequest;
    abstract readConfigurationResponse(): ConfigurationResponse;
    abstract readProcessRequest(): ProcessRequest;
    abstract readProcessResponse(): ProcessResponse;
    abstract readFinishRequest(): FinishRequest;
    abstract readFinishResponse(): FinishResponse;
}

type TransportData = any; // TODO hello JS, my old friend - bodge

export interface Transport {
    read(): TransportData;
    write(buffer: TransportData): void;
    flush(): void;
}

export interface Service {
    list(): ListResponse;
    load(request: LoadRequest) : LoadResponse;
    configure(request: ConfigurationRequest): ConfigurationResponse;
    process(request: ProcessRequest): ProcessResponse;
    finish(request: FinishRequest): FinishResponse;
}

export interface Client {
    list(): Promise<ListResponse>;
    load(request: LoadRequest) : Promise<LoadResponse>;
    configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    process(request: ProcessRequest): Promise<ProcessResponse>;
    finish(request: FinishRequest): Promise<FinishResponse>;
}