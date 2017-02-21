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

export interface Service {
    list(request: ListRequest): Promise<ListResponse>;
    load(request: LoadRequest) : Promise<LoadResponse>;
    configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    process(request: ProcessRequest): Promise<ProcessResponse>;
    finish(request: FinishRequest): Promise<FinishResponse>;
}

export interface SynchronousService {
    list(request: ListRequest): ListResponse;
    load(request: LoadRequest) : LoadResponse;
    configure(request: ConfigurationRequest): ConfigurationResponse;
    process(request: ProcessRequest): ProcessResponse;
    finish(request: FinishRequest): FinishResponse;
}

// exports for library consumption
export {EmscriptenProxy} from "./EmscriptenProxy";
export * from "./JsonProtocol";
export {FeatsService} from "./FeatsService";
export {PiperClient} from "./PiperClient";
export {segment, process, collect} from "./HigherLevelUtilities";
export * from "./FeatureExtractor";
export {fromSeconds, fromFrames, toSeconds} from "./Timestamp";
