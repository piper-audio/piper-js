/**
 * Created by lucast on 30/08/2016.
 */
import {
    StaticData, Configuration, OutputList, ProcessInput, AdapterFlags,
    Framing
} from "./FeatureExtractor";
import {FeatureSet} from "./Feature";

// Types used in the application

export type ExtractorHandle = number;

export interface ListRequest {
    from?: string[];
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
    framing: Framing;
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

export abstract class Service {
    abstract list(request: ListRequest): Promise<ListResponse>;
    abstract load(request: LoadRequest) : Promise<LoadResponse>;
    abstract configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    abstract process(request: ProcessRequest): Promise<ProcessResponse>;
    abstract finish(request: FinishRequest): Promise<FinishResponse>;
}

export abstract class SynchronousService {
    abstract list(request: ListRequest): ListResponse;
    abstract load(request: LoadRequest) : LoadResponse;
    abstract configure(request: ConfigurationRequest): ConfigurationResponse;
    abstract process(request: ProcessRequest): ProcessResponse;
    abstract finish(request: FinishRequest): FinishResponse;
}