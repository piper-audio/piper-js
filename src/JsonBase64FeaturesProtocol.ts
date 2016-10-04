/**
 * Created by lucast on 04/10/2016.
 */
import {
    Protocol, RawRequest, ListResponse, LoadResponse, ConfigurationResponse, ProcessResponse,
    LoadRequest, ConfigurationRequest, ProcessRequest, FinishRequest, PluginHandle
} from "./Piper";
import {Timestamp} from "./Timestamp";
import * as base64 from "base64-js";
import {Feature, FeatureList, FeatureSet} from "./Feature";

interface WireFeature {
    timestamp?: Timestamp;
    duration?: Timestamp;
    label?: string;
    featureValues?: string;
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
    inputBuffers: string[];
}
interface WireProcessRequest {
    pluginHandle: PluginHandle;
    processInput: WireProcessInput;
}

export class JsonBase64FeaturesProtocol implements Protocol {
    writeListResponse(response: ListResponse): RawRequest {
        return undefined;
    }

    writeLoadResponse(response: LoadResponse): RawRequest {
        return undefined;
    }

    writeConfigurationResponse(response: ConfigurationResponse): RawRequest {
        return undefined;
    }

    writeProcessResponse(response: ProcessResponse): RawRequest {
        return undefined;
    }

    readLoadRequest(request: RawRequest): LoadRequest {
        return undefined;
    }

    readConfigurationRequest(request: RawRequest): ConfigurationRequest {
        return undefined;
    }

    readProcessRequest(request: RawRequest): ProcessRequest {
        return undefined;
    }

    readFinishRequest(request: RawRequest): FinishRequest {
        return undefined;
    }

    private static encodeBase64(request: ProcessRequest): WireProcessRequest {
        const encoded: string[] = request.processInput.inputBuffers.map(toBase64);
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
        return out.featureValues = fromBase64(wfeature.featureValues);
    }

    private static convertWireFeatureList(wfeatures: WireFeatureList): FeatureList {
        return wfeatures.map(JsonBase64FeaturesProtocol.convertWireFeature);
    }

    private static responseToFeatureSet(processResponse: WireProcessResponse): FeatureSet {
        const features: FeatureSet = new Map();
        const wireFeatures: WireFeatureSet = processResponse.features;
        Object.keys(wireFeatures).forEach(key => {
            return features.set(key, JsonBase64FeaturesProtocol.convertWireFeatureList(wireFeatures[key]));
        });
        return features;
    }
}

export function toBase64(values: Float32Array): string {
    // We want a base-64 encoding of the raw memory backing the
    // typed array. We assume byte order will be the same when the
    // base-64 stuff is decoded, but I guess that might not be
    // true in a network situation. The Float32Array docs say "If
    // control over byte order is needed, use DataView instead" so
    // I guess that's a !!! todo item
    return base64.fromByteArray(new Uint8Array(values.buffer));
}

export function fromBase64(b64: string): Float32Array {
    // The base64 module expects input to be padded to a
    // 4-character boundary, but the C++ VampJson code does not do
    // that, so let's do it here
    while (b64.length % 4 > 0) {
        b64 += "=";
    }
    // !!! endianness, as above.
    return new Float32Array(base64.toByteArray(b64).buffer);
}