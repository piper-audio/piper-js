/**
 * Created by lucas on 07/11/2016.
 */
import {
    ProcessInput} from "./core";
import {
    AdapterFlags, Configuration, ConfiguredOutputDescriptor,
    ExtractorHandle,
    Feature,
    FeatureList,
    FeatureSet,
    ListRequest,
    ListResponse,
    LoadResponse, OutputDescriptor, OutputIdentifier, Parameters, SampleType,
    Service
} from "./core";
import {toSeconds} from "./time";
import {
    createFeatureTimeAdjuster} from "./adjusters";
import {Client} from "./core";
import {
    AudioData,
    AudioStreamFormat,
    segment,
    toProcessInputStream
} from './audio';
import {FeatureTimeAdjuster} from './adjusters';

// Note, these interfaces represent time using a simple number, in
// seconds. They don't use the Piper API Timestamp as the raw feature
// does. That's only really there for protocol compatibility.

//!!! question: is Float32Array really sensible (rather than just
//!!! number[]) for feature values?

export interface VectorFeature {
    startTime: number;
    stepDuration: number;
    data: Float32Array;
}

export interface MatrixFeature {
    startTime: number;
    stepDuration: number;
    data: Float32Array[];
}

export type TracksFeature = VectorFeature[];

export type FeatureCollectionShape = "matrix" | "vector" | "tracks" | "list";

export type FeatureCollection = {
    shape: FeatureCollectionShape;
    collected: VectorFeature | MatrixFeature | TracksFeature | FeatureList;
}

// TODO should format be passed in or derived by the callback?
// TODO does this even make any sense? This only exists because the extractor can inform the buffer size, so one might want to stream at that size


export interface OneShotExtractionRequest {
    audioData: AudioData;
    audioFormat: AudioStreamFormat;
    key: string;
    outputId?: OutputIdentifier;
    parameterValues?: Parameters;
    stepSize?: number;
    blockSize?: number;
}

export interface OneShotExtractionResponse {
    features: FeatureCollection;
    outputDescriptor: OutputDescriptor;
}

export interface OneShotExtractionService {
    list(request: ListRequest): Promise<ListResponse>;
    process(request: OneShotExtractionRequest): Promise<OneShotExtractionResponse>;
    collect(request: OneShotExtractionRequest): Promise<OneShotExtractionResponse>;
}

interface OptionalConfiguration {
    channelCount?: number;
    blockSize?: number;
    stepSize?: number;
    parameterValues?: Parameters;
}

function determineConfiguration(defaultConfig: Configuration,
                                overrides?: OptionalConfiguration): Configuration {
    let blockSize: number = overrides.blockSize || defaultConfig.framing.blockSize || 1024;
    let stepSize: number = overrides.stepSize || defaultConfig.framing.stepSize || blockSize;
    let channelCount: number = overrides.channelCount || defaultConfig.channelCount || 1; // TODO is 1 okay?

    let config: Configuration = {
        channelCount: channelCount,
        framing: {
            blockSize: blockSize,
            stepSize: stepSize
        }
    };

    if (overrides.parameterValues && overrides.parameterValues.size > 0)
        config["parameterValues"] = overrides.parameterValues;

    return config;
}

function deduceShape(descriptor: ConfiguredOutputDescriptor): FeatureCollectionShape {
    const isList = descriptor.hasDuration
        || descriptor.sampleType === SampleType.VariableSampleRate
        || !descriptor.binCount;
    const isVector = descriptor.binCount === 1;
    if (isList) return "list";
    if (isVector) return "vector";
    return "matrix";
}

function reshapeVector(features: Iterable<Feature>,
                       stepDuration: number,
                       descriptor: ConfiguredOutputDescriptor) : FeatureCollection {

    // Determine whether a purported vector output (fixed spacing, one
    // bin per feature) should actually be returned as multiple
    // tracks, because it has gaps between features or feature timings
    // that overlap
    
    const tracks : TracksFeature = [];
    let currentTrack : number[] = [];
    let currentStartTime = 0;
    let n = -1;

    const outputArr = features instanceof Array ? features : [...features];

    for (let i = 0; i < outputArr.length; ++i) {

        const f = outputArr[i];
        n = n + 1;

        if (descriptor.sampleType == SampleType.FixedSampleRate &&
            typeof(f.timestamp) !== 'undefined') {
            const m = Math.round(toSeconds(f.timestamp) / stepDuration);
            if (m !== n) {
                if (currentTrack.length > 0) {
                    tracks.push({
                        startTime: currentStartTime,
                        stepDuration,
                        data: new Float32Array(currentTrack)
                    });
                    currentTrack = [];
                    n = m;
                }
                currentStartTime = m * stepDuration;
            }
        }

        currentTrack.push(f.featureValues[0]);
    }

    if (tracks.length > 0) {
        if (currentTrack.length > 0) {
            tracks.push({
                startTime: currentStartTime,
                stepDuration,
                data: new Float32Array(currentTrack)
            });
        }
        return {
            shape: "tracks",
            collected: tracks
        };
    } else {
        return {
            shape: "vector",
            collected: {
                startTime: currentStartTime,
                stepDuration,
                data: new Float32Array(currentTrack)
            }
        }
    }
}

function reshapeMatrix(features: Iterable<Feature>,
                       stepDuration: number,
                       descriptor: ConfiguredOutputDescriptor) : FeatureCollection
{
    const outputArr = features instanceof Array ? features : [...features];

    if (outputArr.length === 0) {
        return {
            shape: "matrix",
            collected: {
                startTime: 0,
                stepDuration,
                data: []
            }
        }
    } else {
        const firstFeature : Feature = outputArr[0];
        let startTime = 0;
        if (descriptor.sampleType == SampleType.FixedSampleRate &&
            typeof(firstFeature.timestamp) !== 'undefined') {
            const m = Math.round(toSeconds(firstFeature.timestamp) /
                                 stepDuration);
            startTime = m * stepDuration;
        }
        return {
            shape: "matrix",
            collected: {
                startTime,
                stepDuration,
                data: outputArr.map(feature =>
                                    new Float32Array(feature.featureValues))
            }
        };
    }
}

function reshapeList(features: Iterable<Feature>,
                     adjuster?: FeatureTimeAdjuster): FeatureCollection {
    return {
        shape: "list",
        collected: [...features].map(feature => {
            if (adjuster) {
                adjuster.adjust(feature);
            }
            return feature;
        })
    }
}

export function reshape(features: Iterable<Feature>,
                        inputSampleRate: number,
                        stepSize: number,
                        descriptor: ConfiguredOutputDescriptor,
                        adjustTimestamps: boolean = true) : FeatureCollection {
    const shape: FeatureCollectionShape = deduceShape(descriptor);
    const stepDuration: number = getFeatureStepDuration(
        inputSampleRate,
        stepSize,
        descriptor
    );
    const adjuster: FeatureTimeAdjuster = createFeatureTimeAdjuster(
        descriptor,
        stepDuration
    );

    switch (shape) {
        case "vector":
            // NB this could return either "vector" or "tracks" shape,
            // depending on the feature data
            return reshapeVector(features, stepDuration, descriptor);
        
        case "matrix":
            return reshapeMatrix(features, stepDuration, descriptor);

        case "list":
            return reshapeList(features, adjustTimestamps ? adjuster : null);
        default:
            // Assumption here that deduceShape can't return "tracks",
            // because it can't tell the difference between vector and
            // tracks without looking at potentially all the data
            throw new Error("A valid shape could not be deduced.");
    }
}

function getFeatureStepDuration(inputSampleRate: number,
                                stepSize: number,
                                descriptor: ConfiguredOutputDescriptor) {
    switch (descriptor.sampleType) {
        case SampleType.OneSamplePerStep:
            return stepSize / inputSampleRate;
        case SampleType.FixedSampleRate:
            return 1.0 / descriptor.sampleRate;
        default:
            return 1.0;
    }
}

export function batchProcess(blocks: Iterable<ProcessInput>,
                             process: (block: ProcessInput) => Promise<FeatureSet>,
                             finish: () => Promise<FeatureSet>)
: Promise<FeatureSet> {

    const processThunks: (() => Promise<FeatureSet>)[] =
        [...blocks].map(block => () => process(block))
            .concat([finish]);

    return processThunks.reduce((runningFeatures, nextBlock) => {
        return runningFeatures.then((features) => {
            return concatFeatures(features, nextBlock());
        });
    }, Promise.resolve(new Map() as FeatureSet));
}

function concatFeatures(running: FeatureSet, nextBlock: Promise<FeatureSet>): Promise<FeatureSet> {
    return nextBlock.then((block) => {
        for (let [i, feature] of block.entries()) {
            createOrConcat(feature, i, running);
        }
        return running;
    });
}

function createOrConcat(data: FeatureList, key: string, map: FeatureSet) {
    if (map.has(key)) {
        const a = map.get(key);
        a.push.apply(a, data);
    } else {
        map.set(key, data);
    }
}

export interface OneShotConfigurationResponse {
    handle: ExtractorHandle;
    inputSampleRate: number; // TODO this is here for convenience - might not belong here
    configuredOutputId: string;
    configuredBlockSize: number;
    configuredStepSize: number;
    outputDescriptor: OutputDescriptor;
}

export function loadAndConfigure(request: OneShotExtractionRequest,
                                 service: Service): Promise<OneShotConfigurationResponse> {
    
    const load = (request: OneShotExtractionRequest) => (response: ListResponse): Promise<LoadResponse> => {
        const metadata = response.available.filter(metadata => metadata.key === request.key);
        if (metadata.length !== 1) throw Error("Invalid key.");

        return service.load({
            key: request.key,
            inputSampleRate: request.audioFormat.sampleRate,
            adapterFlags: [AdapterFlags.AdaptAllSafe]
        });
    };

    const configure = (request: OneShotExtractionRequest) => (res: LoadResponse): Promise<OneShotConfigurationResponse> => {
        const config = determineConfiguration(
            res.defaultConfiguration,
            {
                blockSize: request.blockSize,
                stepSize: request.stepSize,
                channelCount: request.audioFormat.channelCount,
                parameterValues: request.parameterValues
            }
        );

        return service.configure({
            handle: res.handle,
            configuration: config
        }).then(res => {
            const outputId = request.outputId
                ? request.outputId
                : res.outputList[0].basic.identifier;

            if (res.outputList.filter(output => output.basic.identifier === outputId).length === 0)
                throw Error("Invalid output identifier.");

            return {
                handle: res.handle,
                inputSampleRate: request.audioFormat.sampleRate,
                configuredOutputId: outputId,
                configuredBlockSize: config.framing.blockSize,
                configuredStepSize: config.framing.stepSize,
                outputDescriptor: res.outputList
                    .find(output => output.basic.identifier === outputId)
            }
        });
    };

    // TODO come up with a mechanism for pipelining requests to reduce client-server round-trips
    return service.list({}) // TODO is the list really necessary? - prevents doing any processing if the extractor / output is not available
        .then(load(request))
        .then(configure(request))
}

export class OneShotExtractionClient implements OneShotExtractionService {
    private client: Service;

    constructor(service: Service) {
        this.client = new Client(service);
    }

    list(request: ListRequest): Promise<ListResponse> {
        return this.client.list(request);
    }

    process(request: OneShotExtractionRequest): Promise<OneShotExtractionResponse> {
        return loadAndConfigure(request, this.client).then(this.processAndFinish(request));
    }

    collect(request: OneShotExtractionRequest): Promise<OneShotExtractionResponse> {
        return loadAndConfigure(request, this.client).then(this.processAndFinish(request, false));
    }

    private processAndFinish(request: OneShotExtractionRequest,
                             forceList: boolean = true): (res: OneShotConfigurationResponse) => Promise<OneShotExtractionResponse> {

        // TODO implement something better than batchProcess?
        return (res: OneShotConfigurationResponse) => {
            const blocks = toProcessInputStream({
                frames: segment(
                    res.configuredBlockSize,
                    res.configuredStepSize,
                    request.audioData
                ),
                format: request.audioFormat
            }, res.configuredStepSize);

            return batchProcess(
                blocks,
                (block) => this.client.process({
                    handle: res.handle,
                    processInput: block
                }).then(response => response.features),
                () => this.client.finish({handle: res.handle}).then(res => res.features)
            ).then(featureSet => {
                const features: FeatureList = featureSet.get(res.configuredOutputId) || [];
                return forceList ? {
                    features: {
                        shape: "list" as FeatureCollectionShape,
                        collected: features
                    },
                    outputDescriptor: res.outputDescriptor
                } : {
                    features: reshape(
                        features,
                        res.inputSampleRate,
                        res.configuredStepSize,
                        res.outputDescriptor.configured,
                        false
                    ),
                    outputDescriptor: res.outputDescriptor
                }
            });
        }
    };
}
