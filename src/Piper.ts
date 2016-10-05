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

export interface Protocol {
    writeListResponse(response: ListResponse): void;
    writeLoadResponse(response: LoadResponse): void;
    writeConfigurationResponse(response: ConfigurationResponse): void;
    writeProcessResponse(response: ProcessResponse): void;
    readLoadRequest(): LoadRequest;
    readConfigurationRequest(): ConfigurationRequest;
    readProcessRequest(): ProcessRequest;
    readFinishRequest(): FinishRequest;
}

export interface FeatureExtractionService {
    list(): ListResponse;
    load(request: LoadRequest) : LoadResponse;
    configure(request: ConfigurationRequest): ConfigurationResponse;
    process(request: ProcessRequest): FeatureSet;
    finish(request: FinishRequest): FeatureSet;
}

export interface FeatureExtractionClient {
    list(): Promise<ListResponse>;
    load(request: LoadRequest) : Promise<LoadResponse>;
    configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    process(request: ProcessRequest): Promise<FeatureSet>;
    finish(request: FinishRequest): Promise<FeatureSet>;
}