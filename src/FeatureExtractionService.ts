/**
 * Created by lucast on 19/09/2016.
 */
import {
    FeatureExtractor, Configuration, ConfiguredOutputs, OutputList, StaticData, InputDomain
} from "./FeatureExtractor";
import {FeatureSet} from "./Feature";
import {
    Service, LoadRequest, LoadResponse, ConfigurationRequest, ConfigurationResponse, ProcessRequest,
    ProcessResponse, ListResponse, FinishResponse, FinishRequest, ExtractorHandle
} from "./Piper";

export type FeatureExtractorFactory = (sampleRate: number) => FeatureExtractor;

export interface PluginFactory { // TODO rename, this is part of our identity crisis
    extractor: FeatureExtractorFactory;
    metadata: StaticData;
}

export interface Plugin {
    extractor: FeatureExtractor;
    metadata: StaticData;
}

export class FeatureExtractionService implements Service {
    private factories: Map<string, PluginFactory>;
    private loaded: Map<number, Plugin>;
    private configured: Map<number, Plugin>;
    private countingHandle: number;

    constructor(...factories: PluginFactory[]) {
        FeatureExtractionService.sanitiseStaticData(factories);
        this.factories = new Map(factories.map(plugin => [plugin.metadata.key, plugin] as [string, PluginFactory]));
        this.loaded = new Map();
        this.configured = new Map();
        this.countingHandle = 0;
    }

    list(): ListResponse {
        return {
            available: [...this.factories.values()].map(plugin => plugin.metadata)
        }
    }

    load(request: LoadRequest): LoadResponse {
        // TODO what do I do with adapter flags? channel adapting stuff, frequency domain transformation etc
        // TODO what about parameterValues?
        if (!this.factories.has(request.key)) throw new Error("Invalid plugin key.");

        const factory: PluginFactory = this.factories.get(request.key);
        const extractor: FeatureExtractor = factory.extractor(request.inputSampleRate);
        const metadata: StaticData = factory.metadata;
        this.loaded.set(++this.countingHandle, {extractor: extractor, metadata: metadata}); // TODO should the first assigned handle be 1 or 0? currently 1

        const defaultConfiguration: Configuration = extractor.getDefaultConfiguration();

        return {
            handle: this.countingHandle,
            staticData: metadata,
            defaultConfiguration: defaultConfiguration
        };
    }

    configure(request: ConfigurationRequest): ConfigurationResponse {
        if (!this.loaded.has(request.handle)) throw new Error("Invalid plugin handle");
        if (this.configured.has(request.handle)) throw new Error("PluginFactory is already configured");

        const plugin: Plugin = this.loaded.get(request.handle);
        // TODO this is probably where the error handling for channel mismatch should be...
        const outputs: ConfiguredOutputs = plugin.extractor.configure(request.configuration);
        this.configured.set(request.handle, plugin);
        const outputList: OutputList = plugin.metadata.basicOutputInfo.map(basic => {
            return {
                basic: basic,
                configured: Object.assign({binNames: [], sampleRate: 0}, outputs.get(basic.identifier))
            };
        });
        return {handle: request.handle, outputList: outputList};
    }

    // TODO what about FrequencyDomain input?, or channel count mis-match?
    // ^^ The AdapterFlags will indicate the work to be done, but I've not yet implemented anything which does it
    //     - WireProcessResponse (there is no JSON schema for this, but copy the shape of the latest VamPipe)
    process(request: ProcessRequest): ProcessResponse { // TODO what if this was over the wire?
        if (!this.configured.has(request.handle))
            throw new Error("Invalid plugin handle, or plugin not configured.");

        const plugin: Plugin = this.configured.get(request.handle);
        const numberOfInputs: number = request.processInput.inputBuffers.length;
        const metadata: StaticData = plugin.metadata;

        if (numberOfInputs < metadata.minChannelCount || numberOfInputs > metadata.maxChannelCount) // TODO is there a specific number of channels after configure is called?
            throw new Error("wrong number of channels supplied.");

        // TODO again, having to convert between maps and objects, to have to go back again elsewhere is very wasteful
        // especially as we aren't doing the same thing for ProcessRequest here ~ it is all very confused
        const features: FeatureSet = plugin.extractor.process(request.processInput);
        return {handle: request.handle, features: features};
    }

    finish(request: FinishRequest): FinishResponse {
        const handle: ExtractorHandle = request.handle;
        if (!this.configured.has(handle))
            throw new Error("Invalid plugin handle, or plugin not configured.");
        const plugin: Plugin = this.configured.get(handle);
        const features: FeatureSet = plugin.extractor.finish();
        this.loaded.delete(handle);
        this.configured.delete(handle);
        return {handle: handle, features: features};
    }

    private static sanitiseStaticData(factories: PluginFactory[]): void {
        // TODO this is to parse the InputDomain field as Enums, and really belongs in the compiling code
        factories.forEach(plugin => {
            if (typeof plugin.metadata.inputDomain === "string") {
                plugin.metadata.inputDomain = InputDomain[plugin.metadata.inputDomain as any] as any;
            }
        });
    }
}
