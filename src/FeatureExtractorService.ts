/**
 * Created by lucast on 19/09/2016.
 */
import {
    FeatureExtractor,
    Configuration,
    ConfigurationResponse as Configured,
    OutputList,
    StaticData,
    InputDomain,
    AdapterFlags
} from "./FeatureExtractor";
import {
    Service, LoadRequest, LoadResponse, ConfigurationRequest,
    ConfigurationResponse, ProcessRequest,
    ProcessResponse, ListResponse, FinishResponse, FinishRequest,
    ExtractorHandle, ListRequest, SynchronousService
} from "./Piper";
import {FeatureSet} from "./Feature";
import {
    FrequencyDomainAdapter,
    ProcessInputAdjustmentMethod
} from "./FrequencyDomainAdapter";
import {RealFftFactory} from "./fft/RealFft";

export interface FeatureExtractorFactory {
    create: (sampleRate: number) => FeatureExtractor;
    metadata: StaticData;
}

export interface DescribedFeatureExtractor {
    extractor: FeatureExtractor;
    metadata: StaticData;
}

export class FeatureExtractorSynchronousService implements SynchronousService {
    private factories: Map<string, FeatureExtractorFactory>;
    private loaded: Map<number, DescribedFeatureExtractor>;
    private configured: Map<number, DescribedFeatureExtractor>;
    private countingHandle: number;
    private fftFactory: RealFftFactory;

    constructor(fftFactory: RealFftFactory, ...factories: FeatureExtractorFactory[]) {
        FeatureExtractorSynchronousService.sanitiseStaticData(factories);
        this.factories = new Map(factories.map(plugin => [plugin.metadata.key, plugin] as [string, FeatureExtractorFactory]));
        this.loaded = new Map();
        this.configured = new Map();
        this.countingHandle = 0;
        this.fftFactory = fftFactory;
    }

    list(request: ListRequest): ListResponse {
        const factories: FeatureExtractorFactory[] = [...this.factories.values()];
        const available: FeatureExtractorFactory[] = request.from && request.from.length ?
            factories.filter(plugin => {
                return request.from.includes(plugin.metadata.key.split(":")[0]);
            }) : factories;
        return {
            available: available.map(plugin => plugin.metadata)
        };
    }

    load(request: LoadRequest): LoadResponse {
        // TODO what do I do with adapter flags? channel adapting stuff, frequency domain transformation etc
        // TODO what about parameterValues?
        if (!this.factories.has(request.key)) throw new Error("Invalid plugin key.");
        const isInputDomainAdapted = request.adapterFlags.length > 0
            && (
                request.adapterFlags.includes(AdapterFlags.AdaptAll)
                || request.adapterFlags.includes(AdapterFlags.AdaptAllSafe)
                || request.adapterFlags.includes(AdapterFlags.AdaptInputDomain)
            );

        const factory: FeatureExtractorFactory = this.factories.get(request.key);
        const metadata: StaticData = factory.metadata;
        const extractor: FeatureExtractor =
            metadata.inputDomain === InputDomain.FrequencyDomain && isInputDomainAdapted
                ? new FrequencyDomainAdapter(
                    factory.create(request.inputSampleRate),
                    this.fftFactory,
                    request.inputSampleRate,
                    ProcessInputAdjustmentMethod.Timestamp
                )
                : factory.create(request.inputSampleRate);
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
        if (this.configured.has(request.handle)) throw new Error("FeatureExtractorFactory is already configured");

        const plugin: DescribedFeatureExtractor = this.loaded.get(request.handle);
        // TODO this is probably where the error handling for channel mismatch should be...
        const response: Configured = plugin.extractor.configure(request.configuration);
        this.configured.set(request.handle, plugin);
        const outputList: OutputList = plugin.metadata.basicOutputInfo.map(basic => {
            return Object.assign(
                {
                    basic: basic,
                    configured: Object.assign(
                        {binNames: [], sampleRate: 0},
                        response.outputs.get(basic.identifier)
                    )
                },
                plugin.metadata.staticOutputInfo.has(basic.identifier) ?
                    {
                        static: plugin.metadata.staticOutputInfo.get(
                            basic.identifier
                        )
                    } : {}
            );
        });
        return {
            handle: request.handle,
            outputList: outputList,
            framing: response.framing
        };
    }

    // TODO what about FrequencyDomain input?, or channel count mis-match?
    // ^^ The AdapterFlags will indicate the work to be done, but I've not yet implemented anything which does it
    process(request: ProcessRequest): ProcessResponse { // TODO what if this was over the wire?
        if (!this.configured.has(request.handle))
            throw new Error("Invalid plugin handle, or plugin not configured.");

        const plugin: DescribedFeatureExtractor = this.configured.get(request.handle);
        const numberOfInputs: number = request.processInput.inputBuffers.length;
        const metadata: StaticData = plugin.metadata;

        if (numberOfInputs < metadata.minChannelCount || numberOfInputs > metadata.maxChannelCount) // TODO is there a specific number of channels after configure is called?
            throw new Error("wrong number of channels supplied.");

        const features: FeatureSet = plugin.extractor.process(request.processInput);
        return {handle: request.handle, features: features};
    }

    finish(request: FinishRequest): FinishResponse {
        const handle: ExtractorHandle = request.handle;
        if (!this.loaded.has(handle) && !this.configured.has(handle))
            throw new Error("Invalid plugin handle.");
        const plugin: DescribedFeatureExtractor = this.configured.get(handle) || this.loaded.get(handle);
        const features: FeatureSet = plugin.extractor.finish();
        this.loaded.delete(handle);
        this.configured.delete(handle);
        return {handle: handle, features: features};
    }

    private static sanitiseStaticData(factories: FeatureExtractorFactory[]): void {
        // TODO this is to parse the InputDomain field as Enums, and really belongs in the compiling code
        factories.forEach(plugin => {
            if (typeof plugin.metadata.inputDomain === "string") {
                plugin.metadata.inputDomain = InputDomain[plugin.metadata.inputDomain as any] as any;
            }
        });
    }
}
export class FakeAsyncService implements Service {
    protected service: SynchronousService;

    constructor(service: SynchronousService) {
        this.service = service;
    }

    list(request: ListRequest): Promise<ListResponse> {
        return this.request(request, (req: any) => this.service.list(req));
    }

    load(request: LoadRequest): Promise<LoadResponse> {
        return this.request(request, (req: any) => this.service.load(req));
    }

    configure(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.request(request, (req: any) => this.service.configure(req));
    }

    process(request: ProcessRequest): Promise<ProcessResponse> {
        return this.request(request, (req: any) => this.service.process(req));
    }

    finish(request: FinishRequest): Promise<FinishResponse> {
        return this.request(request, (req: any) => this.service.finish(req));
    }

    protected request(request: any, handler: Function): Promise<any> {
        return new Promise((res, rej) => {
            try {
                res(handler(request));
            } catch (err) {
                rej(err);
            }
        });
    }
}


export class FeatureExtractorService extends FakeAsyncService {
    constructor(fftFactory: RealFftFactory, ...factories: FeatureExtractorFactory[]) {
        super(new FeatureExtractorSynchronousService(fftFactory, ...factories));
    }
}
