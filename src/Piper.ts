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

//
export type RawRequest = string;

export interface Protocol {
    writeListResponse(response: ListResponse): RawRequest;
    writeLoadResponse(response: LoadResponse): RawRequest;
    writeConfigurationResponse(response: ConfigurationResponse): RawRequest;
    writeProcessResponse(response: ProcessResponse): RawRequest;
    readLoadRequest(request: RawRequest): LoadRequest;
    readConfigurationRequest(request: RawRequest): ConfigurationRequest;
    readProcessRequest(request: RawRequest): ProcessRequest;
    readFinishRequest(request: RawRequest): FinishRequest;
}
//
// export interface Service {
//     handle(request: Request): Promise<Response>;
// }
//
// export interface FeatureExtractionClient {
//     list(): Promise<ListResponse>;
//     load(request: LoadRequest) : Promise<LoadResponse>;
//     configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
//     process(request: ProcessRequest): Promise<FeatureSet>;
//     finish(request: FinishRequest): Promise<FeatureSet>;
// }