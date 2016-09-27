/**
 * Created by lucast on 19/09/2016.
 */
import {
    ModuleRequestHandler, Request, Response, ProcessEncoding, LoadRequest,
    LoadResponse, ConfigurationRequest, ConfigurationResponse, ProcessRequest, PluginHandle, ProcessResponse, WireFeatureSet
} from "./ClientServer";
import {
    FeatureExtractor, Configuration, ConfiguredOutputs, OutputList, StaticData,
    SampleType
} from "./FeatureExtractor";
import {FeatureSet} from "./Feature";

export type FeatureExtractorFactory = (sampleRate: number) => FeatureExtractor;

export interface PluginFactory { // TODO rename, this is part of our identity crisis
    extractor: FeatureExtractorFactory;
    metadata: StaticData;
}

export interface Plugin {
    extractor: FeatureExtractor;
    metadata: StaticData;
}

export class LocalModuleRequestHandler implements ModuleRequestHandler { // TODO Local? This also has an identity crisis
    private factories: Map<string, PluginFactory>;
    private loaded: Map<number, Plugin>;
    private configured: Map<number, Plugin>;
    private countingHandle: number;

    constructor(...factories: PluginFactory[]) {
        this.factories = new Map(factories.map(plugin => [plugin.metadata.pluginKey, plugin] as [string, PluginFactory]));
        this.loaded = new Map();
        this.configured = new Map();
        this.countingHandle = 0;
    }

    public handle(request: Request): Promise<Response> {
        // TODO switch statement suggests the interface should just be list, load, config, process, finish?
        // or that it belongs somewhere else, at this point it looks like a bit like request router
        try {
            switch (request.type) {
                case "list":
                    return Promise.resolve({
                        type: request.type,
                        success: true,
                        content: {plugins: this.list()}
                    });
                case "load":
                    return Promise.resolve({
                        type: request.type,
                        success: true,
                        content: this.load(request.content)
                    });
                case "configure":
                    return Promise.resolve({
                        type: request.type,
                        success: true,
                        content: this.configure(request.content)
                    });
                case "process":
                    return Promise.resolve({
                        type: request.type,
                        success: true,
                        content: this.process(request.content)
                    });
                case "finish":
                    return Promise.resolve({
                        type: request.type,
                        success: true,
                        content: this.finish(request.content.pluginHandle)
                    });
                default:
                    return LocalModuleRequestHandler.rejectRequest("Unsupported request type.", request);
            }
        } catch(err) {
            return LocalModuleRequestHandler.rejectRequest(err, request);
        }
    }

    public getProcessEncoding(): ProcessEncoding {
        return ProcessEncoding.Raw;
    }
    // TODO this might all belong somewhere else

    private list(): StaticData[] {
        return [...this.factories.values()].map(plugin => plugin.metadata);
    }

    private load(request: LoadRequest): LoadResponse {
        // TODO what do I do with adapter flags? channel adapting stuff, frequency domain transformation etc
        // TODO what about parameterValues?
        if (!this.factories.has(request.pluginKey)) throw new Error("Invalid plugin key.");

        const factory: PluginFactory = this.factories.get(request.pluginKey);
        const extractor: FeatureExtractor = factory.extractor(request.inputSampleRate);
        const metadata: StaticData = factory.metadata;
        this.loaded.set(++this.countingHandle, {extractor: extractor, metadata: metadata}); // TODO should the first assigned handle be 1 or 0? currently 1

        const defaultConfiguration: Configuration = extractor.getDefaultConfiguration();

        return {
            pluginHandle: this.countingHandle,
            staticData: metadata,
            defaultConfiguration: defaultConfiguration
        };
    }

    private configure(request: ConfigurationRequest): ConfigurationResponse {
        if (!this.loaded.has(request.pluginHandle)) throw new Error("Invalid plugin handle");
        if (this.configured.has(request.pluginHandle)) throw new Error("PluginFactory is already configured");

        const plugin: Plugin = this.loaded.get(request.pluginHandle);
        // TODO this is probably where the error handling for channel mismatch should be...
        const outputs: ConfiguredOutputs = plugin.extractor.configure(request.configuration);
        this.configured.set(request.pluginHandle, plugin);
        const outputList: OutputList = plugin.metadata.basicOutputInfo.map(basic => {
            return {
                basic: basic,
                configured: Object.assign({binNames: [], sampleRate: 0}, outputs.get(basic.identifier))
            };
        });
        outputList.forEach(output => (output.configured as any).sampleType = SampleType[output.configured.sampleType]);
        return {pluginHandle: request.pluginHandle, outputList: outputList};
    }

    // process, should be a direct call to process, may need to alter the shape of the return (not sure)
    // TODO what about FrequencyDomain input?, or channel count mis-match?
    // ^^ The AdapterFlags will indicate the work to be done, but I've not yet implemented anything which does it
    //     - ProcessResponse (there is no JSON schema for this, but copy the shape of the latest VamPipe)
    private process(request: ProcessRequest): ProcessResponse { // TODO what if this was over the wire?
        if (!this.configured.has(request.pluginHandle))
            throw new Error("Invalid plugin handle, or plugin not configured.");

        const plugin: Plugin = this.configured.get(request.pluginHandle);
        const numberOfInputs: number = request.processInput.inputBuffers.length;
        const metadata: StaticData = plugin.metadata;

        if (numberOfInputs < metadata.minChannelCount || numberOfInputs > metadata.maxChannelCount) // TODO is there a specific number of channels after configure is called?
            throw new Error("wrong number of channels supplied.");

        // TODO again, having to convert between maps and objects, to have to go back again elsewhere is very wasteful
        // especially as we aren't doing the same thing for ProcessRequest here ~ it is all very confused
        const features: FeatureSet = plugin.extractor.process(request.processInput);
        return {pluginHandle: request.pluginHandle, features: LocalModuleRequestHandler.toWireFeatureSet(features)};
    }

    // finish, directly call finish
    //     - ProcessResponse?
    private finish(handle: PluginHandle): ProcessResponse {
        if (!this.configured.has(handle))
            throw new Error("Invalid plugin handle, or plugin not configured.");
        const plugin: Plugin = this.configured.get(handle);
        const features: FeatureSet = plugin.extractor.finish();
        this.loaded.delete(handle);
        this.configured.delete(handle);
        return {pluginHandle: handle, features: LocalModuleRequestHandler.toWireFeatureSet(features)};
    }

    private static rejectRequest(err: string, request: Request): Promise<Request> {
        return Promise.reject<Response>({
            type: request.type,
            success: false,
            errorText: err
        });
    }

    private static toWireFeatureSet(features: FeatureSet): WireFeatureSet { // TODO this is horrible
        let wireFeatures: any = {};
        for (let [key, featureList] of features.entries()) {
            featureList.forEach(feature => {
                if (feature.hasOwnProperty("featureValues"))
                    feature.featureValues = [...feature.featureValues] as any; // this is mutating the input FeatureSet, ergh
            });
            wireFeatures[key] = featureList;
        }
        return wireFeatures;
    }
}
