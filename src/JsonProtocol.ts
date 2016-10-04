/**
 * Created by lucast on 04/10/2016.
 */
import {Timestamp} from "./Timestamp";
import {
    PluginHandle, ProcessRequest, Protocol, ListResponse, RawRequest, LoadResponse,
    ConfigurationResponse, ProcessResponse, LoadRequest, ConfigurationRequest, FinishRequest
} from "./Piper";
import {Feature, FeatureList, FeatureSet} from "./Feature";

interface WireFeature {
    timestamp?: Timestamp;
    duration?: Timestamp;
    label?: string;
    featureValues?: number[];
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
    inputBuffers: number[][];
}

interface WireProcessRequest {
    pluginHandle: PluginHandle;
    processInput: WireProcessInput;
}

export class JsonProtocol implements Protocol {
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
        return out.featureValues = new Float32Array(wfeature.featureValues);
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
