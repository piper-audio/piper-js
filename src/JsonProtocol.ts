/**
 * Created by lucast on 04/10/2016.
 */
import * as base64 from "base64-js";
import {Timestamp} from "./Timestamp";
import {
    ExtractorHandle,
    ProcessRequest,
    Protocol,
    ListResponse,
    LoadResponse,
    ConfigurationResponse,
    ProcessResponse,
    LoadRequest,
    ConfigurationRequest,
    FinishRequest,
    Transport,
    FinishResponse,
    ListRequest, TransportData, RpcResponse
} from "./Piper";
import {
    Feature,
    FeatureList,
    FeatureSet
} from "./Feature";
import {
    AdapterFlags,
    InputDomain,
    SampleType,
    BasicDescriptor,
    ParameterDescriptor,
    ValueExtents,
    Configuration, StaticData, ProcessInput
} from "./FeatureExtractor";


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

function toTransport(obj: any): TransportData {
    return JSON.stringify(obj);
}

function fromTransport(buffer: TransportData): Promise<any> {
    const response: RpcResponse = JSON.parse(buffer);

    if (response.error) throw new Error(response.error.message);
    return Promise.resolve(response.result);
}

export class JsonProtocol extends Protocol {
    private asBase64: boolean;

    constructor(transport: Transport, asBase64: boolean = false) {
        super(transport);
        this.asBase64 = asBase64;
    }

    writeListRequest(): void {
        this.transport.write(toTransport({method: "list"}));
    }

    writeListResponse(response: ListResponse): void {
        // TODO error case
        this.transport.write(toTransport({
            method: "list",
            result: serialiseListResponse(response)
        }));
    }

    writeLoadRequest(request: LoadRequest): void {
        this.transport.write(toTransport({
            method: "load",
            params: serialiseLoadRequest(request)
        }));
    }

    writeLoadResponse(response: LoadResponse): void {
        // TODO error case
        this.transport.write(toTransport({
            method: "load",
            result: serialiseLoadResponse(response)
        }));
    }

    writeConfigurationRequest(request: ConfigurationRequest): void {
        this.transport.write(toTransport({
            method: "configure",
            params: serialiseConfigurationRequest(request)
        }));
    }

    writeConfigurationResponse(response: ConfigurationResponse): void {
        // TODO error case
        this.transport.write(toTransport({
            method: "configure",
            result: serialiseConfigurationResponse(response)
        }));
    }

    writeProcessRequest(request: ProcessRequest): void {
        this.transport.write(toTransport({
            method: "process",
            params: serialiseProcessRequest(request, this.asBase64)
        }));
    }

    writeProcessResponse(response: ProcessResponse): void {
        // TODO error case
        this.transport.write(toTransport({
            method: "process",
            result: serialiseProcessResponse(response)
        }));
    }

    writeFinishRequest(request: FinishRequest): void {
        this.transport.write(toTransport({
            method: "finish",
            params: request
        }));
    }

    writeFinishResponse(response: FinishResponse): void {
        this.writeProcessResponse(response);
    }


    // TODO should the read methods expect requests in the form {"type": ..., "content"}? or just content..
    readListRequest(): Promise<ListRequest> { return Promise.resolve({}); }

    readListResponse(): Promise<ListResponse> {
        return this.transport.read().then(fromTransport).then(deserialiseListResponse);
    }

    readLoadRequest(): Promise<LoadRequest> {
        return this.transport.read().then(fromTransport).then(deserialiseLoadRequest);
    }

    readLoadResponse(): Promise<LoadResponse> {
        return this.transport.read().then(fromTransport).then(deserialiseLoadResponse)
    }

    readConfigurationRequest(): Promise<ConfigurationRequest> {
        return this.transport.read().then(fromTransport).then(deserialiseConfigurationRequest)
    }

    readConfigurationResponse(): Promise<ConfigurationResponse> {
        return this.transport.read().then(fromTransport).then(deserialiseConfigurationResponse)
    }

    readProcessRequest(): Promise<ProcessRequest> {
        return this.transport.read().then(fromTransport).then(deserialiseProcessRequest)
    }

    readProcessResponse(): Promise<ProcessResponse> {
        return this.transport.read().then(fromTransport).then(deserialiseProcessResponse)
    }

    readFinishRequest(): Promise<Promise<FinishRequest>> {
        return this.transport.read().then(fromTransport); // just so happens to be the same wire or not
    }

    readFinishResponse(): Promise<FinishResponse> {
        return this.readProcessResponse();
    }
}

function serialiseListResponse(response: ListResponse): WireListResponse {
    return {
        available: response.available.map(data => Object.assign({}, data, {
            inputDomain: InputDomain[data.inputDomain]
        }))
    };
}

function deserialiseListResponse(response: WireListResponse): ListResponse {
    return {
        available: response.available.map(data => Object.assign({}, data, {
            inputDomain: parseInt(InputDomain[data.inputDomain as any])
        }))
    };
}

function serialiseLoadRequest(request: LoadRequest): WireLoadRequest {
    return Object.assign({}, request, {adapterFlags: request.adapterFlags.map(flag => AdapterFlags[flag])});
}

function deserialiseLoadRequest(request: WireLoadRequest): LoadRequest {
    return {
        key: request.key,
        inputSampleRate: request.inputSampleRate,
        adapterFlags: request.adapterFlags.map(flag => parseInt(AdapterFlags[flag as any]))
    };
}

function serialiseLoadResponse(response: LoadResponse): WireLoadResponse {
    const staticData: StaticData = response.staticData;
    return {
        handle: response.handle,
        staticData: Object.assign({}, staticData, {inputDomain: InputDomain[staticData.inputDomain]}),
        defaultConfiguration: serialiseConfiguration(response.defaultConfiguration)
    };
}

function deserialiseLoadResponse(response: WireLoadResponse): LoadResponse {
    const staticData: WireStaticData = response.staticData;
    return {
        handle: response.handle,
        staticData: Object.assign({}, staticData, {inputDomain: parseInt(InputDomain[staticData.inputDomain as any])}),
        defaultConfiguration: deserialiseConfiguration(response.defaultConfiguration)
    };
}

function serialiseConfigurationRequest(request: ConfigurationRequest): WireConfigurationRequest {
    return {
        handle: request.handle,
        configuration: serialiseConfiguration(request.configuration)
    }
}

function deserialiseConfigurationRequest(request: WireConfigurationRequest): ConfigurationRequest {
    return {
        handle: request.handle,
        configuration: deserialiseConfiguration(request.configuration)
    };
}

function serialiseConfigurationResponse(response: ConfigurationResponse): WireConfigurationResponse {
    return Object.assign({}, response, { // TODO is this necessary? i.e. not wanting to mutate response
        outputList: response.outputList.map(output => Object.assign({}, output, {
            configured: Object.assign({}, output.configured, {
                sampleType: SampleType[output.configured.sampleType]
            })
        }))
    });
}

// TODO dup, all to do with flipping the enum
function deserialiseConfigurationResponse(response: WireConfigurationResponse): ConfigurationResponse {
    return Object.assign({}, response, {
        outputList: response.outputList.map(output => Object.assign({}, output, {
            configured: Object.assign({}, output.configured, {
                sampleType: parseInt(SampleType[output.configured.sampleType as any])
            })
        }))
    })
}

function serialiseConfiguration(config: Configuration): WireConfiguration {
    return config.parameterValues == null
        ? {channelCount: config.channelCount, stepSize: config.stepSize, blockSize: config.blockSize}
        : Object.assign({}, config, {
            parameterValues: [...config.parameterValues.entries()]
                .reduce((obj, pair) => Object.assign(obj, {[pair[0]]: pair[1]}), {})
        });
}

function deserialiseConfiguration(config: WireConfiguration): Configuration {
    return config.parameterValues == null
        ? {channelCount: config.channelCount, stepSize: config.stepSize, blockSize: config.blockSize}
        : Object.assign({}, config, {
            parameterValues: new Map(Object.keys(config.parameterValues).map(key => [key, config.parameterValues[key]]) as any)
        });
}

function serialiseProcessRequest(request: ProcessRequest, asBase64?: boolean): WireProcessRequest {
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

function deserialiseProcessRequest(request: WireProcessRequest): ProcessRequest {
    return {
        handle: request.handle,
        processInput: Object.assign({}, request, {
            inputBuffers: (typeof request.processInput.inputBuffers[0]) === "string"
                ? (request.processInput.inputBuffers as string[]).map(fromBase64)
                : (request.processInput.inputBuffers as number[][]).map(channel => new Float32Array(channel))
        } as ProcessInput)
    }; //TODO write test
}

function serialiseProcessResponse(response: ProcessResponse): WireProcessResponse {
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

function deserialiseProcessResponse(response: WireProcessResponse): ProcessResponse {
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