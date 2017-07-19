/**
 * Created by lucast on 30/08/2016.
 */
import {fromSeconds, Timestamp, toSeconds} from './time';
import {
    createFeatureTimeAdjuster,
    FeatureTimeAdjuster,
    FrequencyDomainAdapter,
    ProcessInputAdjustmentMethod
} from './adjusters';
import {RealFftFactory} from './fft';

// Types used in the application

export type ExtractorHandle = number;

export interface ListRequest {
    from?: string[];
}

export abstract class FeatureExtractor {
    abstract configure(configuration: Configuration): ExtractorConfiguration;
    abstract getDefaultConfiguration(): Configuration;
    abstract process(block: ProcessInput): FeatureSet;
    abstract finish(): FeatureSet;
}

export enum InputDomain {
    TimeDomain,
    FrequencyDomain
}

export enum SampleType {
    OneSamplePerStep,
    FixedSampleRate,
    VariableSampleRate
}

export enum AdapterFlags {
    AdaptNone,
    AdaptInputDomain,
    AdaptChannelCount,
    AdaptBufferSize,
    AdaptAllSafe,
    AdaptAll
}

export interface BasicDescriptor {
    identifier: string;
    name: string;
    description: string;
}

export interface ValueExtents {
    min: number;
    max: number;
}

export interface ParameterDescriptor {
    basic: BasicDescriptor;
    unit?: string;
    extents: ValueExtents;
    defaultValue: number;
    quantizeStep?: number;
    valueNames?: string[];
}

export type OutputIdentifier = string;

export interface StaticOutputDescriptor {
    typeURI?: string;
}

export interface ConfiguredOutputDescriptor {
    unit?: string;
    binCount?: number;
    binNames?: string[];
    extents?: ValueExtents;
    quantizeStep?: number;
    sampleType: SampleType;
    sampleRate?: number;
    hasDuration: boolean;
}

export interface StaticData {
    key: string;
    basic: BasicDescriptor;
    maker?: string;
    rights?: string;
    version: number;
    category?: string[];
    minChannelCount: number;
    maxChannelCount: number;
    parameters?: ParameterDescriptor[];
    programs?: string[];
    inputDomain: InputDomain;
    basicOutputInfo: BasicDescriptor[];
    staticOutputInfo?: Map<OutputIdentifier, StaticOutputDescriptor>;
}

export interface ExtractorConfiguration {
    outputs: Map<OutputIdentifier, ConfiguredOutputDescriptor>;
    framing: Framing;
}

export interface OutputDescriptor {
    basic: BasicDescriptor;
    static?: StaticOutputDescriptor;
    configured: ConfiguredOutputDescriptor;
}

export type OutputList = OutputDescriptor[];
export type ParameterIdentifier = string;
export type Parameters = Map<ParameterIdentifier, number>;

export interface Framing {
    stepSize: number;
    blockSize: number;
}

export interface Configuration {
    channelCount: number;
    framing: Framing;
    parameterValues?: Parameters;
    currentProgram?: string;
}

export interface ProcessInput {
    timestamp: Timestamp;
    inputBuffers: Float32Array[];
}

export interface ListResponse {
    available: StaticData[];
}

export interface LoadRequest {
    key: string;
    inputSampleRate: number;
    adapterFlags: AdapterFlags[];
}

export interface LoadResponse {
    handle: ExtractorHandle;
    staticData: StaticData;
    defaultConfiguration: Configuration;
}

export interface ConfigurationRequest {
    handle: ExtractorHandle;
    configuration: Configuration;
}

export interface ConfigurationResponse {
    handle: ExtractorHandle;
    outputList: OutputList;
    framing: Framing;
}

export interface ProcessRequest {
    handle: ExtractorHandle;
    processInput: ProcessInput;
}

export type FeatureList = Feature[];
export type FeatureSet = Map<string, FeatureList>;

export interface ProcessResponse {
    handle: ExtractorHandle;
    features: FeatureSet;
}

export interface FinishRequest {
    handle: ExtractorHandle;
}

export type FinishResponse = ProcessResponse;

//

export abstract class Service {
    abstract list(request: ListRequest): Promise<ListResponse>;
    abstract load(request: LoadRequest) : Promise<LoadResponse>;
    abstract configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    abstract process(request: ProcessRequest): Promise<ProcessResponse>;
    abstract finish(request: FinishRequest): Promise<FinishResponse>;
}

export abstract class SynchronousService {
    abstract list(request: ListRequest): ListResponse;
    abstract load(request: LoadRequest) : LoadResponse;
    abstract configure(request: ConfigurationRequest): ConfigurationResponse;
    abstract process(request: ProcessRequest): ProcessResponse;
    abstract finish(request: FinishRequest): FinishResponse;
}

export interface Feature {
    timestamp?: Timestamp;
    duration?: Timestamp;
    label?: string;
    featureValues?: Float32Array;
}

export class Client implements Service {
    private timeAdjusters: Map<string, FeatureTimeAdjuster>;
    private handleToSampleRate: Map<ExtractorHandle, number>;
    private handleToStaticData: Map<ExtractorHandle, StaticData>;
    private handleToAdapterFlags: Map<ExtractorHandle, AdapterFlags[]>;
    private handleToConfiguration: Map<ExtractorHandle, Configuration>;
    private service: Service;

    constructor(service: Service) {
        this.timeAdjusters = new Map();
        this.handleToSampleRate = new Map();
        this.handleToStaticData = new Map();
        this.handleToAdapterFlags = new Map();
        this.handleToConfiguration = new Map();
        this.service = service;
    }

    public list(request: ListRequest): Promise<ListResponse> {
        return this.service.list(request);
    }

    public load(request: LoadRequest): Promise<LoadResponse> {
        return this.service.load(request)
            .then(response => {
                this.handleToSampleRate.set(response.handle, request.inputSampleRate);
                this.handleToStaticData.set(response.handle, response.staticData);
                this.handleToAdapterFlags.set(response.handle, request.adapterFlags);
                return response;
            });
    }

    public configure(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.service.configure(request)
            .then(response => {
                this.handleToConfiguration.set(response.handle, request.configuration);
                for (let output of response.outputList) {
                    this.timeAdjusters.set(output.basic.identifier, createFeatureTimeAdjuster(
                        output.configured, request.configuration.framing.stepSize / this.handleToSampleRate.get(request.handle))
                    );
                }
                return response;
            });
    }

    public process(request: ProcessRequest): Promise<ProcessResponse> {
        if (!Client.isInputDomainAdapted(this.handleToAdapterFlags.get(request.handle))) {
            this.convertProcessInputToFrequencyDomain(request.processInput);
        }

        return this.service.process(request).then(response => {
            this.adjustFeatureTimes(
                response.features,
                response.handle,
                request.processInput.timestamp
            );

            return {
                handle: request.handle,
                features: response.features
            };
        });
    }

    public finish(request: FinishRequest): Promise<FinishResponse> {
        return this.service.finish(request).then(response => {
            this.adjustFeatureTimes(
                response.features,
                response.handle
            );

            this.handleToSampleRate.delete(request.handle);
            return {
                handle: request.handle,
                features: response.features
            };
        });
    }

    private adjustFeatureTimes(features: FeatureSet,
                               handle: ExtractorHandle,
                               inputTimestamp?: Timestamp) {

        for (let [i, featureList] of features.entries()) {
            const adjuster: FeatureTimeAdjuster = this.timeAdjusters.get(i);
            featureList.map((feature: Feature) => {
                adjuster.adjust(feature, inputTimestamp);

                if (this.isFrequencyDomainExtractor(handle)) {
                    const offset = this.handleToConfiguration.get(handle)
                        .framing.blockSize * 0.5 / this.handleToSampleRate.get(handle);
                    feature.timestamp = fromSeconds(toSeconds(feature.timestamp) + offset);
                }
            });
        }
    }

    private static isInputDomainAdapted(adapterFlags: AdapterFlags[]): boolean {
        return adapterFlags.length > 0
            && (
                adapterFlags.includes(AdapterFlags.AdaptAll)
                || adapterFlags.includes(AdapterFlags.AdaptAllSafe)
                || adapterFlags.includes(AdapterFlags.AdaptInputDomain)
            );
    }

    private convertProcessInputToFrequencyDomain(processInput: ProcessInput): void {
        // TODO if frequency domain extractor not loaded with AdaptInputDomain, process FFT
        throw new Error("FFT not implemented, load extractor with AdaptInputDomain.");
    }

    private isFrequencyDomainExtractor(handle: ExtractorHandle) {
        return this.handleToStaticData
            .get(handle)
            .inputDomain === InputDomain.FrequencyDomain;
    }
}

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

    constructor(fftFactory: RealFftFactory,
                ...factories: FeatureExtractorFactory[]) {
        FeatureExtractorSynchronousService.sanitiseStaticData(factories);
        this.factories = new Map(factories.map(f => {
            return [f.metadata.key, f] as [string, FeatureExtractorFactory]
        }));
        this.loaded = new Map();
        this.configured = new Map();
        this.countingHandle = 0;
        this.fftFactory = fftFactory;
    }

    list(request: ListRequest): ListResponse {
        const factories = [...this.factories.values()];
        const available = request.from && request.from.length ?
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
        if (!this.factories.has(request.key)) {
            throw new Error("Invalid plugin key.");
        }
        const isInputDomainAdapted = request.adapterFlags.length > 0
            && (
                request.adapterFlags.includes(AdapterFlags.AdaptAll)
                || request.adapterFlags.includes(AdapterFlags.AdaptAllSafe)
                || request.adapterFlags.includes(AdapterFlags.AdaptInputDomain)
            );

        const factory: FeatureExtractorFactory = this.factories.get(request.key);
        const metadata: StaticData = factory.metadata;
        const extractor: FeatureExtractor =
            metadata.inputDomain === InputDomain.FrequencyDomain &&
            isInputDomainAdapted ?
                new FrequencyDomainAdapter(
                    factory.create(request.inputSampleRate),
                    this.fftFactory,
                    request.inputSampleRate,
                    ProcessInputAdjustmentMethod.Timestamp
                ) : factory.create(request.inputSampleRate);
        this.loaded.set(++this.countingHandle, {
            extractor: extractor,
            metadata: metadata
        }); // TODO should the first assigned handle be 1 or 0? currently 1

        const defaultConfiguration = extractor.getDefaultConfiguration();

        return {
            handle: this.countingHandle,
            staticData: metadata,
            defaultConfiguration: defaultConfiguration
        };
    }

    configure(request: ConfigurationRequest): ConfigurationResponse {
        if (!this.loaded.has(request.handle)) {
            throw new Error("Invalid plugin handle");
        }
        if (this.configured.has(request.handle)) {
            throw new Error("FeatureExtractorFactory is already configured");
        }

        const plugin: DescribedFeatureExtractor = this.loaded.get(request.handle);
        // TODO this is probably where the error handling for channel mismatch should be...
        const response: ExtractorConfiguration = plugin.extractor.configure(
            request.configuration
        );
        this.configured.set(request.handle, plugin);
        const outputList = plugin.metadata.basicOutputInfo.map(basic => {
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
        if (!this.configured.has(request.handle)) {
            throw new Error("Invalid plugin handle, or plugin not configured.");
        }

        const plugin: DescribedFeatureExtractor = this.configured.get(request.handle);
        const numberOfInputs: number = request.processInput.inputBuffers.length;
        const metadata: StaticData = plugin.metadata;

        // TODO is there a specific number of channels after configure is called?
        if (numberOfInputs < metadata.minChannelCount ||
            numberOfInputs > metadata.maxChannelCount) {
            throw new Error("wrong number of channels supplied.");
        }

        const features = plugin.extractor.process(request.processInput);
        return {
            handle: request.handle,
            features: features
        };
    }

    finish(request: FinishRequest): FinishResponse {
        const handle: ExtractorHandle = request.handle;
        if (!this.loaded.has(handle) && !this.configured.has(handle)) {
            throw new Error("Invalid plugin handle.");
        }
        const plugin = this.configured.get(handle) || this.loaded.get(handle);
        const features: FeatureSet = plugin.extractor.finish();
        this.loaded.delete(handle);
        this.configured.delete(handle);
        return {handle: handle, features: features};
    }

    private static sanitiseStaticData(factories: FeatureExtractorFactory[]): void {
        // TODO this is to parse the InputDomain field as Enums, and really belongs in the compiling code
        factories.forEach(plugin => {
            if (typeof plugin.metadata.inputDomain === "string") {
                plugin.metadata.inputDomain =
                    InputDomain[plugin.metadata.inputDomain as any] as any;
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
    constructor(fftFactory: RealFftFactory,
                ...factories: FeatureExtractorFactory[]) {
        super(new FeatureExtractorSynchronousService(fftFactory, ...factories));
    }
}