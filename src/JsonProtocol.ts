/**
 * Created by lucast on 04/10/2016.
 */
import * as base64 from "base64-js";
import {Timestamp} from "feats/Timestamp";
import {
    ExtractorHandle,
    ProcessRequest,
    ListResponse,
    LoadResponse,
    ConfigurationResponse,
    ProcessResponse,
    LoadRequest,
    ConfigurationRequest,
    FinishRequest,
    FinishResponse,
    ListRequest,
    Filter,
    ServiceFunc
} from "./Piper";
import {
    Feature,
    FeatureList,
    FeatureSet
} from "feats/Feature";
import {
    AdapterFlags,
    InputDomain,
    SampleType,
    BasicDescriptor,
    ParameterDescriptor,
    ValueExtents,
    Configuration, StaticData, ProcessInput
} from "feats/FeatureExtractor";

export const serialiseJsonListRequest
    : Filter<ListRequest, string, string, string>
    = (request: ListRequest, next: ServiceFunc<string, string>)
    : Promise<string> => next(serialiseListRequest(request));

export const serialiseJsonLoadRequest
    : Filter<LoadRequest, string, string, string>
    = (request: LoadRequest, next: ServiceFunc<string, string>)
    : Promise<string> => next(serialiseLoadRequest(request));

export const serialiseJsonConfigurationRequest
    : Filter<ConfigurationRequest, string, string, string>
    = (request: ConfigurationRequest, next: ServiceFunc<string, string>)
    : Promise<string> => next(serialiseConfigurationRequest(request));

export const serialiseJsonProcessRequest
    : Filter<ProcessRequest, string, string, string>
    = (request: ProcessRequest, next: ServiceFunc<string, string>)
    : Promise<string> => next(serialiseProcessRequest(request));

export const serialiseJsonFinishRequest
    : Filter<FinishRequest, string, string, string>
    = (request: FinishRequest, next: ServiceFunc<string, string>)
    : Promise<string> => next(serialiseFinishRequest(request));

export const deserialiseJsonListResponse
    : Filter<ListRequest, ListResponse, ListRequest, string>
    = (request: ListRequest, service: ServiceFunc<ListRequest, string>)
    : Promise<ListResponse> =>
    service(request).then(deserialiseListResponse);

export const deserialiseJsonLoadResponse
    : Filter<LoadRequest, LoadResponse, LoadRequest, string>
    = (request: LoadRequest, service: ServiceFunc<LoadRequest, string>)
    : Promise<LoadResponse> =>
    service(request).then(deserialiseLoadResponse);

export const deserialiseJsonConfigurationResponse
    : Filter<ConfigurationRequest, ConfigurationResponse, ConfigurationRequest, string>
    = (request: ConfigurationRequest, service: ServiceFunc<ConfigurationRequest, string>)
    : Promise<ConfigurationResponse> =>
    service(request).then(deserialiseConfigurationResponse);

export const deserialiseJsonProcessResponse
    : Filter<ProcessRequest, ProcessResponse, ProcessRequest, string>
    = (request: ProcessRequest, service: ServiceFunc<ProcessRequest, string>)
    : Promise<ProcessResponse> =>
    service(request).then(deserialiseProcessResponse);

export const deserialiseJsonFinishResponse
    : Filter<FinishRequest, FinishResponse, FinishRequest, string>
    = (request: FinishRequest, service: ServiceFunc<FinishRequest, string>)
    : Promise<FinishResponse> =>
    service(request).then(deserialiseFinishResponse);

function serialiseListRequest(request: ListRequest): string {
    return toTransport({method: "list", params: request});
}

function serialiseListResponse(response: ListResponse): string {
    return toTransport({method: "list", result: toWireListResponse(response)});
}

function serialiseLoadRequest(request: LoadRequest): string {
    return toTransport({method: "load", params: toWireLoadRequest(request)});
}

function serialiseLoadResponse(response: LoadResponse): string {
    return toTransport({method: "load", result: toWireLoadResponse(response)});
}

function serialiseConfigurationRequest(request: ConfigurationRequest): string {
    return toTransport({method: "configure", params: toWireConfigurationRequest(request)});
}

function serialiseConfigurationResponse(response: ConfigurationResponse): string {
    return toTransport({method: "configure", result: toWireConfigurationResponse(response)});
}

function serialiseProcessRequest(request: ProcessRequest): string {
    return toTransport({method: "process", params: toWireProcessRequest(request)});
}

function serialiseProcessResponse(response: ProcessResponse): string {
    return toTransport({method: "process", result: toWireProcessResponse(response)});
}

function serialiseFinishRequest(request: FinishRequest): string {
    return toTransport({method: "finish", params: request});
}

function serialiseFinishResponse(response: FinishResponse): string {
    return toTransport({method: "finish", result: toWireProcessResponse(response)});
}

function deserialiseListRequest(request: string): ListRequest {
    return toTransport({})
}

function deserialiseListResponse(response: string): ListResponse {
    return toListResponse(fromTransport(response));
}

function deserialiseLoadRequest(request: string): LoadRequest {
    return toLoadRequest(fromTransport(request));
}

function deserialiseLoadResponse(response: string): LoadResponse {
    return toLoadResponse(fromTransport(response));
}

function deserialiseConfigurationRequest(request: string): ConfigurationRequest {
    return toConfigurationRequest(fromTransport(request));
}

function deserialiseConfigurationResponse(response: string): ConfigurationResponse {
    return toConfigurationResponse(fromTransport(response));
}

function deserialiseProcessRequest(request: string): ProcessRequest {
    return toProcessRequest(fromTransport(request));
}

function deserialiseProcessResponse(response: string): ProcessResponse {
    return toProcessResponse(fromTransport(response));
}

function deserialiseFinishRequest(request: string): FinishRequest {
    return fromTransport(request);
}

function deserialiseFinishResponse(response: string): FinishResponse {
    return deserialiseProcessResponse(response);
}

type WireFeatureValues = number[] | string;

interface WireFeature {
    timestamp?: Timestamp;
    duration?: Timestamp;
    label?: string;
    featureValues?: WireFeatureValues;
}

type WireFeatureList = WireFeature[];

interface WireFeatureSet {
    [key: string]: WireFeatureList;
}

interface WireProcessResponse {
    handle: number,
    features: WireFeatureSet
}

interface WireProcessInput {
    timestamp: Timestamp;
    inputBuffers: number[][] | string[];
}

interface WireProcessRequest {
    handle: ExtractorHandle;
    processInput: WireProcessInput;
}

interface WireStaticData {
    key: string;
    basic: BasicDescriptor;
    maker?: string;
    copyright?: string;
    version: number;
    category?: string[];
    minChannelCount: number;
    maxChannelCount: number;
    parameters?: ParameterDescriptor[];
    programs?: string[];
    inputDomain: string;
    basicOutputInfo: BasicDescriptor[];
}

interface WireListResponse {
    available: WireStaticData[];
}

interface WireLoadRequest {
    key: string;
    inputSampleRate: number;
    adapterFlags: string[];
}

type WireParameters = {[key: string]: number};

interface WireConfiguration {
    channelCount: number;
    stepSize: number;
    blockSize: number;
    parameterValues?: WireParameters
}

interface WireConfigurationRequest {
    handle: ExtractorHandle;
    configuration: WireConfiguration;
}

interface WireConfigurationResponse {
    handle: ExtractorHandle;
    outputList: WireOutputList;
}

interface WireLoadResponse {
    handle: ExtractorHandle;
    staticData: WireStaticData;
    defaultConfiguration: WireConfiguration;
}

interface WireConfiguredOutputDescriptor {
    unit?: string;
    binCount?: number;
    binNames?: string[];
    extents?: ValueExtents;
    quantizeStep?: number;
    sampleType: string;
    sampleRate?: number;
    hasDuration: boolean;
}

interface WireOutputDescriptor {
    basic: BasicDescriptor;
    configured: WireConfiguredOutputDescriptor;
}

type WireOutputList = WireOutputDescriptor[];

function toTransport(obj: any): string {
    return JSON.stringify(obj);
}

interface ResponseError {
    code: number;
    message: string;
}

interface RpcResponse {
    method: string;
    result?: any;
    error?: ResponseError;
}

function fromTransport(buffer: string): any {
    const response: RpcResponse = JSON.parse(buffer);

    if (response.error) throw new Error(response.error.message);
    return response.result;
}

function toWireListResponse(response: ListResponse): WireListResponse {
    return {
        available: response.available.map(data => Object.assign({}, data, {
            inputDomain: InputDomain[data.inputDomain]
        }))
    };
}

function toListResponse(response: WireListResponse): ListResponse {
    return {
        available: response.available.map(data => Object.assign({}, data, {
            inputDomain: parseInt(InputDomain[data.inputDomain as any])
        }))
    };
}

function toWireLoadRequest(request: LoadRequest): WireLoadRequest {
    return Object.assign({}, request, {adapterFlags: request.adapterFlags.map(flag => AdapterFlags[flag])});
}

function toLoadRequest(request: WireLoadRequest): LoadRequest {
    return {
        key: request.key,
        inputSampleRate: request.inputSampleRate,
        adapterFlags: request.adapterFlags.map(flag => parseInt(AdapterFlags[flag as any]))
    };
}

function toWireLoadResponse(response: LoadResponse): WireLoadResponse {
    const staticData: StaticData = response.staticData;
    return {
        handle: response.handle,
        staticData: Object.assign({}, staticData, {inputDomain: InputDomain[staticData.inputDomain]}),
        defaultConfiguration: toWireConfiguration(response.defaultConfiguration)
    };
}

function toLoadResponse(response: WireLoadResponse): LoadResponse {
    const staticData: WireStaticData = response.staticData;
    return {
        handle: response.handle,
        staticData: Object.assign({}, staticData, {inputDomain: parseInt(InputDomain[staticData.inputDomain as any])}),
        defaultConfiguration: toConfiguration(response.defaultConfiguration)
    };
}

function toWireConfigurationRequest(request: ConfigurationRequest): WireConfigurationRequest {
    return {
        handle: request.handle,
        configuration: toWireConfiguration(request.configuration)
    }
}

function toConfigurationRequest(request: WireConfigurationRequest): ConfigurationRequest {
    return {
        handle: request.handle,
        configuration: toConfiguration(request.configuration)
    };
}

function toWireConfigurationResponse(response: ConfigurationResponse): WireConfigurationResponse {
    return Object.assign({}, response, { // TODO is this necessary? i.e. not wanting to mutate response
        outputList: response.outputList.map(output => Object.assign({}, output, {
            configured: Object.assign({}, output.configured, {
                sampleType: SampleType[output.configured.sampleType]
            })
        }))
    });
}

function toConfigurationResponse(response: WireConfigurationResponse): ConfigurationResponse {
    return Object.assign({}, response, {
        outputList: response.outputList.map(output => Object.assign({}, output, {
            configured: Object.assign({}, output.configured, {
                sampleType: parseInt(SampleType[output.configured.sampleType as any])
            })
        }))
    })
}

function toWireConfiguration(config: Configuration): WireConfiguration {
    return config.parameterValues == null
        ? {channelCount: config.channelCount, stepSize: config.stepSize, blockSize: config.blockSize}
        : Object.assign({}, config, {
            parameterValues: [...config.parameterValues.entries()]
                .reduce((obj, pair) => Object.assign(obj, {[pair[0]]: pair[1]}), {})
        });
}

function toConfiguration(config: WireConfiguration): Configuration {
    return config.parameterValues == null
        ? {channelCount: config.channelCount, stepSize: config.stepSize, blockSize: config.blockSize}
        : Object.assign({}, config, {
            parameterValues: new Map(Object.keys(config.parameterValues).map(key => [key, config.parameterValues[key]]) as any)
        });
}

function toWireProcessRequest(request: ProcessRequest, asBase64?: boolean): WireProcessRequest {
    return {
        handle: request.handle,
        processInput: {
            timestamp: request.processInput.timestamp,
            inputBuffers: asBase64 ?
                request.processInput.inputBuffers.map(toBase64) :
                request.processInput.inputBuffers.map(channel => [...channel])
        }
    }
}

function toProcessRequest(request: WireProcessRequest): ProcessRequest {
    return {
        handle: request.handle,
        processInput: Object.assign({}, request, {
            inputBuffers: (typeof request.processInput.inputBuffers[0]) === "string"
                ? (request.processInput.inputBuffers as string[]).map(fromBase64)
                : (request.processInput.inputBuffers as number[][]).map(channel => new Float32Array(channel))
        } as ProcessInput)
    }; //TODO write test
}

function toWireProcessResponse(response: ProcessResponse): WireProcessResponse {
    // TODO write test
    return {
        handle: response.handle,
        features: [...response.features.entries()].reduce((set, pair) => {
            const [key, featureList]: [string, FeatureList] = pair;
            return Object.assign(set, {
                [key]: featureList.map((feature: Feature) => Object.assign({}, feature as any,
                    (response.features != null ?
                    {
                        featureValues: this.asBase64 ? toBase64(feature.featureValues) : [...feature.featureValues]
                    } : {}) as any
                ))
            })
        }, {})
    };
}

function toProcessResponse(response: WireProcessResponse): ProcessResponse {
    const features: FeatureSet = new Map();
    const wireFeatures: WireFeatureSet = response.features;
    Object.keys(wireFeatures).forEach(key => {
        return features.set(key, convertWireFeatureList(wireFeatures[key]));
    });
    return {
        handle: response.handle,
        features: features
    };
}

function convertWireFeatureList(wfeatures: WireFeatureList): FeatureList {
    return wfeatures.map(convertWireFeature);
}

function convertWireFeature(wfeature: WireFeature): Feature {
    let out: Feature = {};
    if (wfeature.timestamp != null) {
        out.timestamp = wfeature.timestamp;
    }
    if (wfeature.duration != null) {
        out.duration = wfeature.duration;
    }
    if (wfeature.label != null) {
        out.label = wfeature.label;
    }
    const vv = wfeature.featureValues;
    if (vv != null) {
        if (typeof vv === "string") {
            out.featureValues = fromBase64(vv);
        } else {
            out.featureValues = new Float32Array(vv);
        }
    }
    return out;
}

function toBase64(values: Float32Array): string {
    // We want a base-64 encoding of the raw memory backing the
    // typed array. We assume byte order will be the same when the
    // base-64 stuff is decoded, but I guess that might not be
    // true in a network situation. The Float32Array docs say "If
    // control over byte order is needed, use DataView instead" so
    // I guess that's a !!! todo item
    return base64.fromByteArray(new Uint8Array(values.buffer));
}

function fromBase64(b64: string): Float32Array {
    // The base64 module expects input to be padded to a
    // 4-character boundary, but the C++ VampJson code does not do
    // that, so let's do it here
    while (b64.length % 4 > 0) {
        b64 += "=";
    }
    // !!! endianness, as above.
    return new Float32Array(base64.toByteArray(b64).buffer);
}