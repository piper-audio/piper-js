/**
 * Created by lucast on 30/08/2016.
 */
import {StaticData, Configuration, OutputList, ProcessInput, AdapterFlags} from "feats/FeatureExtractor";
import {FeatureSet} from "feats/Feature";

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

export interface Service {
    list(request: ListRequest): Promise<ListResponse>;
    load(request: LoadRequest) : Promise<LoadResponse>;
    configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    process(request: ProcessRequest): Promise<ProcessResponse>;
    finish(request: FinishRequest): Promise<FinishResponse>;
}

export type ServiceFunc<Request, Response> = (req: Request) => Promise<Response>;
export type ListService = ServiceFunc<ListRequest, ListResponse>;
export type LoadService = ServiceFunc<LoadRequest, LoadResponse>;
export type ConfigurationService = ServiceFunc<ConfigurationRequest, ConfigurationResponse>;
export type ProcessService = ServiceFunc<ProcessRequest, ProcessResponse>;
export type FinishService = ServiceFunc<FinishRequest, FinishResponse>;

export type Filter<ReqIn, RepOut, ReqOut, RepIn>
    = (request: ReqIn, service: ServiceFunc<ReqOut, RepIn>) => Promise<RepOut>;

export type SimpleFilter<Req, Res> = Filter<Req, Res, Req, Res>;

export function compose<ReqIn, RepOut, ReqOut, RepIn>
(filter: Filter<ReqIn, RepOut, ReqOut, RepIn>,
 service: ServiceFunc<ReqOut, RepIn>): ServiceFunc<ReqIn, RepOut> {
    return (request: ReqIn) => filter(request, service);
}

export function composeSimple<Req, Rep>
(filter: SimpleFilter<Req, Rep>,
 service: ServiceFunc<Req, Rep>): ServiceFunc<Req, Rep> {
    return (request: Req) => filter(request, service);
}

// exports for library consumption
export {EmscriptenProxy} from "./EmscriptenProxy";
export * from "./JsonProtocol";
export {FeatsService} from "./FeatsService";
export {PiperClient} from "./PiperClient";