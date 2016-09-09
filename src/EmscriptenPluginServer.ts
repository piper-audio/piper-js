/**
 * Created by lucast on 31/08/2016.
 */
import {
    PluginServer,
    StaticData,
    LoadRequest, LoadResponse,
    ConfigurationRequest, ConfigurationResponse,
    ProcessRequest,
    Response, Request, AdapterFlags, SampleType, OutputDescriptor
} from './PluginServer';
import {Feature} from "./Feature";
import VamPipeServer = require('../ext/ExampleModule');
import {Allocator, EmscriptenModule} from "./Emscripten";
import {
    FeatureTimeAdjuster, createFeatureTimeAdjuster
} from "./FeatureTimeAdjuster";

export class EmscriptenPluginServer implements PluginServer {
    private server: EmscriptenModule;
    private doRequest: (ptr: number) => number;
    private freeJson: (ptr: number) => void;
    private timeAdjusters: Map<number, FeatureTimeAdjuster>;

    constructor() {
        this.server = VamPipeServer();
        this.doRequest = this.server.cwrap('vampipeRequestJson', 'number', ['number']) as (ptr: number) => number;
        this.freeJson = this.server.cwrap('vampipeFreeJson', 'void', ['number']) as (ptr: number) => void;
        this.timeAdjusters = new Map();
    }

    private request(request: Request): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            const requestJson: string = JSON.stringify(request);
            const requestJsonPtr: number = this.server.allocate(this.server.intArrayFromString(requestJson), 'i8', Allocator.ALLOC_NORMAL);
            const responseJsonPtr: number = this.doRequest(requestJsonPtr);
            this.server._free(requestJsonPtr);
            var response: Response = JSON.parse(this.server.Pointer_stringify(responseJsonPtr));
            this.freeJson(responseJsonPtr);
            if (!response.success) reject(response.errorText);
            resolve(response);
        });
    }

    listPlugins(): Promise<StaticData[]> {
        return this.request({type: 'list'} as Request).then((response) => {
            return response.content.plugins as StaticData[];
        });
    }

    loadPlugin(request: LoadRequest): Promise<LoadResponse> {
        (request as any).adapterFlags = request.adapterFlags.map((flag) => AdapterFlags[flag]);
        return this.request({type: 'load', content: request} as Request).then((response) => {
            return response.content as LoadResponse;
        });
    }

    configurePlugin(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.request({type: 'configure', content: request}).then((response) => {
            for (let [i, output] of response.content.outputList.entries()) {
                (output as any).sampleType = SampleType[output.sampleType];
                this.timeAdjusters.set(i, createFeatureTimeAdjuster(output));
            }
            return response.content as ConfigurationResponse;
        });
    }

    process(request: ProcessRequest): Promise<Feature[][]> {
        request.processInput.inputBuffers.forEach((val) => {
            (val as any).values = [...val.values]; // TODO is there a better way to change Float32Array's JSON representation
        });
        return this.request({type: 'process', content: request}).then((response) => {
            const features: Feature[][] = EmscriptenPluginServer.responseToFeatureSet(response);
            this.adjustFeatureTimes(features);
            return features;
        });
    }

    finish(pluginHandle: number): Promise<Feature[][]> {
        return this.request({type: 'finish', content: {pluginHandle: pluginHandle}}).then((response) => {
            const features: Feature[][] = EmscriptenPluginServer.responseToFeatureSet(response);
            this.adjustFeatureTimes(features);
            return features;
        });
    }

    private static responseToFeatureSet(response: Response): Feature[][] {
        return Object.keys(response.content).map(key => response.content[key]); // TODO change this back to use a key, not number
    }

    private adjustFeatureTimes(features: Feature[][]) {
        // TODO as Chris pointed out, there isn't actually any guarantee that the order
        // TODO of the returned features aligns with the order of the OutputDescriptors, or there could be gaps

        for (let [i, featureList] of features.entries()) {
            const adjuster: FeatureTimeAdjuster = this.timeAdjusters.get(i);
            featureList.map(feature => adjuster.adjust(feature));
        }
    }
}


