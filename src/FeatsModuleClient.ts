/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */
/**
 * Created by lucast on 31/08/2016.
 */

import {
    ModuleClient,
    ListResponse,
    LoadRequest, LoadResponse,
    ConfigurationRequest, ConfigurationResponse,
    ProcessRequest, FinishRequest,
    Response, Request, ModuleRequestHandler, toBase64, fromBase64, PluginHandle,
    ProcessEncoding, WireFeatureSet, ProcessResponse, WireFeatureList, WireFeature
} from "./ClientServer";
import {
    FeatureTimeAdjuster, createFeatureTimeAdjuster
} from "./FeatureTimeAdjuster";
import {FeatureSet, Feature, FeatureList} from "./Feature";
import {Timestamp} from "./Timestamp";
import {EmscriptenModuleRequestHandler} from "./EmscriptenModuleRequestHandler";
import {SampleType, AdapterFlags, InputDomain} from "./FeatureExtractor";

interface WireProcessInput {
    timestamp: Timestamp;
    inputBuffers: number[][] | string[];
}
interface WireProcessRequest {
    pluginHandle: PluginHandle;
    processInput: WireProcessInput;
}

export class FeatsModuleClient implements ModuleClient {
    private timeAdjusters: Map<string, FeatureTimeAdjuster>;
    private handler: ModuleRequestHandler;
    private encodingMap: Map<ProcessEncoding, (request: ProcessRequest) => Promise<Response>>;
    private handleToSampleRate: Map<PluginHandle, number>;

    constructor(handler: ModuleRequestHandler) {
        this.handler = handler;
        this.timeAdjusters = new Map();
        this.encodingMap = new Map([
            [ProcessEncoding.Raw, (request: ProcessRequest) => this.processRaw(request)],
            [ProcessEncoding.Base64, (request: ProcessRequest) => this.processEncoded(FeatsModuleClient.encodeBase64(request))],
            [ProcessEncoding.Json, (request: ProcessRequest) => this.processEncoded(FeatsModuleClient.encodeJson(request))]
        ]);
        this.handleToSampleRate = new Map();
    }

    public static createFromModule(module: any): FeatsModuleClient { // TODO need to define an actual interface for the module
        const isEmscriptenModule: boolean = typeof module.ccall === "function"; // TODO this is an arbitrary way of deciding
        return isEmscriptenModule ? new FeatsModuleClient(new EmscriptenModuleRequestHandler(module)) : null; // TODO complete factory when more Handlers exist
    }

    public listPlugins(): Promise<ListResponse> {
        return this.request({type: "list"} as Request).then((response) => {
            return response.content as ListResponse;
        });
    }

    public loadPlugin(request: LoadRequest): Promise<LoadResponse> {
        (request as any).adapterFlags = request.adapterFlags.map((flag) => AdapterFlags[flag]);
        return this.request({type: "load", content: request} as Request).then((response) => {
            this.handleToSampleRate.set(response.content.pluginHandle, request.inputSampleRate);
            const staticData: any = response.content.staticData;
            return {
                pluginHandle: response.content.pluginHandle,
                staticData: Object.assign({}, staticData, {inputDomain: InputDomain[staticData.inputDomain]}),
                defaultConfiguration: response.content.defaultConfiguration
            };
        });
    }

    public configurePlugin(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.request({type: "configure", content: request}).then((response) => {
            for (let output of response.content.outputList) {
                (output.configured as any).sampleType = SampleType[output.configured.sampleType];
                this.timeAdjusters.set(output.basic.identifier, createFeatureTimeAdjuster(
                    output, request.configuration.stepSize, this.handleToSampleRate.get(request.pluginHandle))
                );
            }
            return response.content as ConfigurationResponse;
        });
    }

    public process(request: ProcessRequest): Promise<FeatureSet> {
        const response: Promise<Response> = this.encodingMap.get(this.handler.getProcessEncoding())(request);
        return response.then(response => {
            let features: FeatureSet = FeatsModuleClient.responseToFeatureSet(response);
            this.adjustFeatureTimes(features, request.processInput.timestamp);
            return features;
        });
    }

    public finish(request: FinishRequest): Promise<FeatureSet> {
        return this.request({type: "finish", content: request}).then((response) => {
            const features: FeatureSet = FeatsModuleClient.responseToFeatureSet(response);
            this.adjustFeatureTimes(features);
            this.handleToSampleRate.delete(request.pluginHandle);
            return features;
        });
    }

    private request(request: Request): Promise<Response> {
        return this.handler.handle(request);
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

    private processEncoded(request: WireProcessRequest): Promise<Response> {
        return this.handler.handle({type: "process", content: request})
    }

    private processRaw(request: ProcessRequest): Promise<Response> {
        return this.handler.handle({type: "process", content: request})
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
        return wfeatures.map(FeatsModuleClient.convertWireFeature);
    }

    private static responseToFeatureSet(response: Response): FeatureSet {
        const features: FeatureSet = new Map();
        const processResponse: ProcessResponse = response.content;
        const wireFeatures: WireFeatureSet = processResponse.features;
        Object.keys(wireFeatures).forEach(key => {
            return features.set(key, FeatsModuleClient.convertWireFeatureList(wireFeatures[key]));
        });
        return features;
    }

    private adjustFeatureTimes(features: FeatureSet, inputTimestamp?: Timestamp) {
        for (let [i, featureList] of features.entries()) {
            const adjuster: FeatureTimeAdjuster = this.timeAdjusters.get(i);
            featureList.map(feature => adjuster.adjust(feature, inputTimestamp));
        }
    }
}
