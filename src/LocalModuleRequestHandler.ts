/**
 * Created by lucast on 19/09/2016.
 */
import {
    ModuleRequestHandler, Request, Response, ProcessEncoding, StaticData, LoadRequest,
    LoadResponse, ConfigurationRequest, ConfigurationResponse, ProcessRequest, PluginHandle, Configuration
} from "./ClientServer";
import {FeatureExtractor} from "./FeatureExtractor";
import {FeatureSet} from "./Feature";

export type FeatureExtractorFactory = (sampleRate: number) => FeatureExtractor;

interface ProcessResponse { // TODO where does this belong? FeatsModuleClient also has a ProcessResponse, with a WireFeature
    pluginHandle: PluginHandle,
    features: FeatureSet
}

export interface Plugin { // TODO rename, this is part of our identity crisis
    extractor: FeatureExtractorFactory,
    metadata: StaticData
}

export class LocalModuleRequestHandler implements ModuleRequestHandler { // TODO Local? This also has an identity crisis
    private plugins: Map<string, Plugin>;
    private loaded: Map<number, FeatureExtractor>;
    private configured: Map<number, FeatureExtractor>;
    private countingHandle: number;

    constructor(...plugins: Plugin[]) {
        this.plugins = new Map(plugins.map(plugin => [plugin.metadata.pluginKey, plugin] as [string, Plugin]));
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
        return [...this.plugins.values()].map(plugin => plugin.metadata);
    }

    private load(request: LoadRequest): LoadResponse {
        // TODO what do I do with adapter flags? channel adapting stuff, frequency domain transformation etc
        // TODO what about parameterValues?
        if (!this.plugins.has(request.pluginKey)) throw new Error("Invalid plugin key.");

        const plugin: Plugin = this.plugins.get(request.pluginKey);
        const extractor: FeatureExtractor = plugin.extractor(request.inputSampleRate);
        this.loaded.set(++this.countingHandle, extractor); // TODO should the first assigned handle be 1 or 0? currently 1

        const defaultConfiguration: Configuration = {
            channelCount: (plugin.metadata.minChannelCount === plugin.metadata.maxChannelCount) ?
                plugin.metadata.minChannelCount : 0, // TODO logic from VamPipe adapter, what happens when it returns 0?
            stepSize: extractor.getPreferredStepSize(),
            blockSize: extractor.getPreferredBlockSize()
        };

        return {
            pluginHandle: this.countingHandle,
            staticData: plugin.metadata,
            defaultConfiguration: defaultConfiguration
        };
    }

    private configure(request: ConfigurationRequest): ConfigurationResponse {
        if (!this.loaded.has(request.pluginHandle)) throw new Error("Invalid plugin handle");
        if (this.configured.has(request.pluginHandle)) throw new Error("Plugin is already configured");

        const extractor: FeatureExtractor = this.loaded.get(request.pluginHandle);
        const config: Configuration = request.configuration;
        extractor.initialise(config.channelCount, config.stepSize, config.blockSize);
        this.configured.set(request.pluginHandle, extractor);
        return {pluginHandle: request.pluginHandle, outputList: extractor.getOutputDescriptors()};
    }

    // process, should be a direct call to process, may need to alter the shape of the return (not sure)
    // TODO what about FrequencyDomain input?, or channel count mis-match?
    // ^^ The AdapterFlags will indicate the work to be done, but I've not yet implemented anything which does it
    //     - ProcessResponse (there is no JSON schema for this, but copy the shape of the latest VamPipe)
    private process(request: ProcessRequest): ProcessResponse {
        return undefined;
    }

    // finish, directly call finish
    //     - ProcessResponse?
    private finish(handle: PluginHandle): ProcessResponse {
        return undefined;
    }

    private static rejectRequest(err: string, request: Request): Promise<Request> {
        return Promise.reject<Response>({
            type: request.type,
            success: false,
            errorText: err
        });
    }
}