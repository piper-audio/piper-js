/**
 * Created by lucast on 04/10/2016.
 */
import {Timestamp} from "./Timestamp";
import {
    PluginHandle, ProcessRequest, Protocol, ListResponse, LoadResponse,
    ConfigurationResponse, ProcessResponse, LoadRequest, ConfigurationRequest, FinishRequest, Transport
} from "./Piper";
import {Feature, FeatureList, FeatureSet} from "./Feature";
import * as base64 from "base64-js";
import {AdapterFlags, InputDomain, SampleType} from "./FeatureExtractor";

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

export class JsonProtocol extends Protocol {

    constructor(transport: Transport) {
        super(transport);
    }

    writeListRequest(): void {
    }

    writeListResponse(response: ListResponse): void {
    }

    writeLoadRequest(request: LoadRequest): void {
        (request as any).adapterFlags = request.adapterFlags.map((flag) => AdapterFlags[flag]);
    }

    writeLoadResponse(response: LoadResponse): void {
    }

    writeConfigurationRequest(request: ConfigurationRequest): void {
    }

    writeConfigurationResponse(response: ConfigurationResponse): void {
    }

    writeProcessRequest(request: ProcessRequest): void {
    }

    writeProcessResponse(response: ProcessResponse): void {
    }

    writeFinishRequest(request: FinishRequest): void {
    }

    readListRequest(): void {
    }

    readListResponse(): ListResponse {
        return undefined;
    }

    readLoadRequest(): LoadRequest {
        return undefined;
    }

    readLoadResponse(): LoadResponse {
        const response: LoadResponse = JSON.parse(this.transport.read()); // TODO this can't be safe
        const staticData: any = response.staticData;
        return {
            pluginHandle: response.pluginHandle,
            staticData: Object.assign({}, staticData, {inputDomain: InputDomain[staticData.inputDomain]}),
            defaultConfiguration: response.defaultConfiguration
        };
    }

    readConfigurationRequest(): ConfigurationRequest {
        return undefined;
    }

    readConfigurationResponse(): ConfigurationResponse {
        const response: ConfigurationResponse = JSON.parse(this.transport.read()); // TODO this can't be safe
        response.outputList.forEach((output: any) => output.sampleType = SampleType[output.configured.sampleType]);
        return response;
    }

    readProcessRequest(): ProcessRequest {
        return undefined;
    }

    readProcessResponse(): ProcessResponse {
        return undefined;
    }

    readFinishRequest(): FinishRequest {
        return undefined;
    }

    private static encodeJson(request: ProcessRequest): WireProcessRequest {
        const encoded = request.processInput.inputBuffers.map(channel => {
            return [...channel]
        });
        return {
            pluginHandle: request.pluginHandle,
            processInput: {
                timestamp: request.processInput.timestamp,
                inputBuffers: encoded
            }
        };
    }

    private static convertWireFeature(wfeature: WireFeature): Feature {
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

    private static convertWireFeatureList(wfeatures: WireFeatureList): FeatureList {
        return wfeatures.map(JsonProtocol.convertWireFeature);
    }

    private static responseToFeatureSet(processResponse: WireProcessResponse): FeatureSet {
        const features: FeatureSet = new Map();
        const wireFeatures: WireFeatureSet = processResponse.features;
        Object.keys(wireFeatures).forEach(key => {
            return features.set(key, JsonProtocol.convertWireFeatureList(wireFeatures[key]));
        });
        return features;
    }
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