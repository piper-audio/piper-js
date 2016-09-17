/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */
/**
 * Created by lucast on 31/08/2016.
 */

import {
    ModuleClient,
    StaticData,
    LoadRequest, LoadResponse,
    ConfigurationRequest, ConfigurationResponse,
    ProcessRequest,
    Response, Request, AdapterFlags, SampleType, ModuleRequestHandler, toBase64, fromBase64, ProcessBlock
} from "./ClientServer";
import {
    FeatureTimeAdjuster, createFeatureTimeAdjuster
} from "./FeatureTimeAdjuster";
import {FeatureSet, Feature} from "./Feature";
import {Timestamp} from "./Timestamp";
interface WireFeature {
    timestamp?: Timestamp;
    duration?: Timestamp;
    label?: string;
    values?: Float32Array;
    b64values?: string;
}

export class FeatsModuleClient implements ModuleClient {
    private timeAdjusters: Map<number, FeatureTimeAdjuster>;

    constructor(private handler: ModuleRequestHandler) {
        this.timeAdjusters = new Map();
    }

    private request(request: Request): Promise<Response> {
        return this.handler.handle(request);
    }

    listPlugins(): Promise<StaticData[]> {
        return this.request({type: "list"} as Request).then((response) => {
            return response.content.plugins as StaticData[];
        });
    }

    loadPlugin(request: LoadRequest): Promise<LoadResponse> {
        (request as any).adapterFlags = request.adapterFlags.map((flag) => AdapterFlags[flag]);
        return this.request({type: "load", content: request} as Request).then((response) => {
            return response.content as LoadResponse;
        });
    }

    configurePlugin(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.request({type: "configure", content: request}).then((response) => {
            for (let [i, output] of response.content.outputList.entries()) {
                (output as any).sampleType = SampleType[output.sampleType];
                this.timeAdjusters.set(i, createFeatureTimeAdjuster(output));
            }
            return response.content as ConfigurationResponse;
        });
    }

    process(request: ProcessRequest): Promise<FeatureSet> {
        const block: ProcessBlock = request.processInput;
        const isBase64: boolean = block.inputBuffers[0].b64values != null && block.inputBuffers[0].b64values !== ""; // TODO would there ever be a mix of values and b64values?
        const response: Promise<Response> = isBase64 ? this.processBase64(request) : this.processJson(request);
        return response.then(response => {
            let features: FeatureSet = FeatsModuleClient.responseToFeatureSet(response);
            this.adjustFeatureTimes(features);
            return features;
        });
    }

    private processJson(request: ProcessRequest): Promise<Response> {
        request.processInput.inputBuffers.forEach((val) => {
            (val as any).values = [...val.values]; // TODO is there a better way to change Float32Array"s JSON representation
        });
        return this.handler.handle({type: "process", content: request});
    }

    private processBase64(request: ProcessRequest): Promise<Request> {
        const encoded = request.processInput.inputBuffers.map(channel => {
            return {b64values: toBase64(channel.values)};
        });
        const encReq = {
            pluginHandle: request.pluginHandle,
            processInput: {
                timestamp: request.processInput.timestamp,
                inputBuffers: encoded
            }
        };
        return this.handler.handle({type: "process", content: encReq});
    }

    finish(pluginHandle: number): Promise<FeatureSet> {
        return this.request({type: "finish", content: {pluginHandle: pluginHandle}}).then((response) => {
            const features: FeatureSet = FeatsModuleClient.responseToFeatureSet(response);
            this.adjustFeatureTimes(features);
            return features;
        });
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
        if (wfeature.b64values != null && wfeature.b64values !== "") {
            out.values = fromBase64(wfeature.b64values);
        } else if (wfeature.values != null) {
            out.values = new Float32Array(wfeature.values);
        }
        return out;
    }
    private static convertWireFeatureList(wfeatures: WireFeature[]): Feature[] {
        return wfeatures.map(FeatsModuleClient.convertWireFeature);
    }

    private static responseToFeatureSet(response: Response): FeatureSet {
        const features: FeatureSet = new Map();
        Object.keys(response.content).forEach(
            key => features.set(Number.parseInt(key),
                FeatsModuleClient.convertWireFeatureList(
                    response.content[key])));
        // TODO seems awkward and inefficient converting an object to a map
        return features;
    }

    private adjustFeatureTimes(features: FeatureSet) {
        for (let [i, featureList] of features.entries()) {
            const adjuster: FeatureTimeAdjuster = this.timeAdjusters.get(i);
            featureList.map(feature => adjuster.adjust(feature));
        }
    }
}


