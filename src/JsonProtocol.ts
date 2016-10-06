/**
 * Created by lucast on 04/10/2016.
 */
import {Timestamp} from "./Timestamp";
import {
    PluginHandle, ProcessRequest, Protocol, ListResponse, LoadResponse,
    ConfigurationResponse, ProcessResponse, LoadRequest, ConfigurationRequest, FinishRequest, Transport, FinishResponse
} from "./Piper";
import {Feature, FeatureList, FeatureSet} from "./Feature";
import * as base64 from "base64-js";
import {
    AdapterFlags, InputDomain, SampleType, BasicDescriptor,
    ParameterDescriptor, ValueExtents, Configuration
} from "./FeatureExtractor";
import List = Mocha.reporters.List;

export interface WireFeature {
    timestamp?: Timestamp;
    duration?: Timestamp;
    label?: string;
    featureValues?: number[] | string;
}

type WireFeatureList = WireFeature[];

interface WireFeatureSet {
    [key: string]: WireFeatureList;
}

interface WireProcessResponse {
    pluginHandle: number,
    features: WireFeatureSet
}

interface WireProcessInput {
    timestamp: Timestamp;
    inputBuffers: number[][] | string[];
}

interface WireProcessRequest {
    pluginHandle: PluginHandle;
    processInput: WireProcessInput;
}

interface WireStaticData {
    pluginKey: string;
    basic: BasicDescriptor;
    maker?: string;
    copyright?: string;
    pluginVersion: number;
    category?: string[];
    minChannelCount: number;
    maxChannelCount: number;
    parameters?: ParameterDescriptor[];
    programs?: string[];
    inputDomain: string;
    basicOutputInfo: BasicDescriptor[];
}

interface WireListResponse {
    plugins: WireStaticData[];
}

interface WireLoadRequest {
    pluginKey: string;
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
    pluginHandle: PluginHandle;
    configuration: WireConfiguration;
}

interface WireConfigurationResponse {
    pluginHandle: PluginHandle;
    outputList: WireOutputList;
}

interface WireLoadResponse {
    pluginHandle: PluginHandle;
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

export class JsonProtocol extends Protocol {
    private asBase64;

    constructor(transport: Transport, asBase64: boolean = false) {
        super(transport);
        this.asBase64 = asBase64;
    }

    writeListRequest(): void {
        this.transport.write(JSON.stringify({type: "list"}));
    }

    writeListResponse(response: ListResponse): void {
        // TODO error case
        this.transport.write(JSON.stringify({
            type: "list",
            success: true,
            content: response
        }));
    }

    writeLoadRequest(request: LoadRequest): void {
        this.transport.write(JSON.stringify({
            type: "load",
            content: serialiseLoadRequest(request)
        }));
    }

    writeLoadResponse(response: LoadResponse): void {
        // TODO error case
        this.transport.write(JSON.stringify({
            type: "load",
            success: true,
            content: serialiseLoadResponse(response)
        }));
    }

    writeConfigurationRequest(request: ConfigurationRequest): void {
        this.transport.write(JSON.stringify({
            type: "configure",
            content: serialiseConfigurationRequest(request)
        }));
    }

    writeConfigurationResponse(response: ConfigurationResponse): void {
        // TODO error case
        this.transport.write(JSON.stringify({
            type: "configure",
            success: true,
            content: serialiseConfigurationResponse(response)
        }));
    }

    writeProcessRequest(request: ProcessRequest): void {
        this.transport.write({
            type: "process",
            content: serialiseProcessRequest(request, this.asBase64)
        });
    }

    writeProcessResponse(response: ProcessResponse): void {
        // TODO error case
        this.transport.write(JSON.stringify({
            type: "process",
            success: true,
            content: serialiseProcessResponse(response)
        }));
    }

    writeFinishRequest(request: FinishRequest): void {
        this.transport.write(JSON.stringify({
            type: "finish",
            content: request
        }));
    }

    writeFinishResponse(response: FinishResponse): void {
        this.writeProcessResponse(response);
    }


    // TODO should the read methods expect requests in the form {"type": ..., "content"}? or just content..
    readListRequest(): void {/* TODO */}

    readListResponse(): ListResponse {
        const response: WireListResponse = JSON.parse(this.transport.read());
        return deserialiseListResponse(response);
    }

    readLoadRequest(): LoadRequest {
        const request: WireLoadRequest = JSON.parse(this.transport.read());
        return deserialiseLoadRequest(request);
    }

    readLoadResponse(): LoadResponse {
        const response: WireLoadResponse = JSON.parse(this.transport.read());
        return deserialiseLoadResponse(response);
    }

    readConfigurationRequest(): ConfigurationRequest {
        const request: WireConfigurationRequest = JSON.parse(this.transport.read());
        return deserialiseConfigurationRequest(request);
    }

    readConfigurationResponse(): ConfigurationResponse {
        const response: WireConfigurationResponse = JSON.parse(this.transport.read());
        return deserialiseConfigurationResponse(response);
    }

    readProcessRequest(): ProcessRequest {
        const request: WireProcessRequest = JSON.parse(this.transport.read());
        return deserialiseProcessRequest(request);
    }

    readProcessResponse(): ProcessResponse {
        const response: WireProcessResponse = JSON.parse(this.transport.read());
        return deserialiseProcessResponse(response);
    }

    readFinishRequest(): FinishRequest {
        return JSON.parse(this.transport.read()); // just so happens to be the same wire or not
    }

    readFinishResponse(): FinishResponse {
        return this.readProcessResponse();
    }
}

function deserialiseListResponse(response: WireListResponse): ListResponse {
    return {
        plugins: response.plugins.map(data => data.inputDomain = InputDomain[data.inputDomain])
    }
}

function serialiseLoadRequest(request: LoadRequest): WireLoadRequest {
    return Object.assign({}, request, {adapterFlags: request.adapterFlags.map(flag => AdapterFlags[flag])});
}

function deserialiseLoadRequest(request: WireLoadRequest): LoadRequest {
    return Object.assign({}, request, {adapterFlags: request.adapterFlags.map(flag => AdapterFlags[flag])});
}

function serialiseLoadResponse(response: LoadResponse): WireLoadResponse {
    return Object.assign({}, response, {
        staticData: Object.assign({}, response.staticData, InputDomain[response.staticData.inputDomain])
    });
}

function deserialiseLoadResponse(response: WireLoadResponse): LoadResponse {
    const staticData: WireStaticData = response.staticData;
    return {
        pluginHandle: response.pluginHandle,
        staticData: Object.assign({}, response.staticData, {inputDomain: InputDomain[staticData.inputDomain]}),
        defaultConfiguration: deserialiseConfiguration(response.defaultConfiguration)
    };
}

function serialiseConfigurationRequest(request: ConfigurationRequest): WireConfigurationRequest {
    return {
        pluginHandle: request.pluginHandle,
        configuration: serialiseConfiguration(request.configuration)
    }
}
// TODO dup, all to do with flipping the enum
function deserialiseConfigurationRequest(request: WireConfigurationRequest): ConfigurationRequest {
    return {
        pluginHandle: request.pluginHandle,
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
                sampleType: SampleType[output.configured.sampleType]
            })
        }))
    })
}

function serialiseConfiguration(config: Configuration): WireConfiguration {
    return config.parameterValues == null ?
        config :
        Object.assign({}, config, {
            parameterValues: [...config.parameterValues.entries()]
                .reduce((obj, pair) => Object.assign(obj, {[pair[0]]: pair[1]}), {})
        });
}

function deserialiseConfiguration(config: WireConfiguration): Configuration {
    return config.parameterValues == null ?
        config :
        Object.assign({}, config, {
            parameterValues: new Map(Object.keys(config.parameterValues).map(key => [key, config.parameterValues[key]]))
        });
}

function serialiseProcessRequest(request: ProcessRequest, asBase64?: boolean): WireProcessRequest {
    return {
        pluginHandle: request.pluginHandle,
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
        pluginHandle: request.pluginHandle,
        processInput: Object.assign({}, request, {
            inputBuffers: typeof request.processInput.inputBuffers[0] === "string" ?
                request.processInput.inputBuffers.map(fromBase64) :
                request.processInput.inputBuffers.map(channel => new Float32Array(channel))
        })
    }; //TODO write test
}

function serialiseProcessResponse(response: ProcessResponse): WireProcessResponse {
    // TODO write test
    return {
        pluginHandle: response.pluginHandle,
        features: [...response.features.entries()].map(pair => {
            const [key, featureList] = pair;
            return {
                [key]: featureList.map((feature: Feature) => Object.assign({}, feature, {
                    // TODO what if .featureValues is not defined
                    featureValues: this.asBase64 ? toBase64(feature.featureValues) : [...feature.featureValues]
                }))
            }
        })
    };
}

function deserialiseProcessResponse(response: WireProcessResponse): ProcessResponse {
    const features: FeatureSet = new Map();
    const wireFeatures: WireFeatureSet = response.features;
    Object.keys(wireFeatures).forEach(key => {
        return features.set(key, convertWireFeatureList(wireFeatures[key]));
    });
    return {
        pluginHandle: response.pluginHandle,
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