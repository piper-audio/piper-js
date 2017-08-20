/**
 * Created by lucas on 31/03/2017.
 */
import {
    FeatureList,
    ListRequest,
    ListResponse, OutputDescriptor,
    Service
} from "./core";
import {
    FeatureCollection,
    loadAndConfigure,
    OneShotConfigurationResponse,
    OneShotExtractionRequest,
    reshape
} from "./one-shot";
import {Observable, Observer} from "rxjs";
import {Client} from "./core";
import {FeatureSet} from "./core";
import {Framing} from './core';
import {segment, toProcessInputStream} from './audio';

export interface StreamingProgress {
    processedBlockCount: number;
    totalBlockCount?: number;
}

export interface StreamingConfiguration { // based on OneShotConfigurationResponse
    inputSampleRate: number;
    framing: Framing;
    outputDescriptor: OutputDescriptor;
}

export interface StreamingResponse {
    progress: StreamingProgress;
    features: FeatureList;
    configuration?: StreamingConfiguration;
}

export abstract class StreamingService {
    abstract list(request: ListRequest): Promise<ListResponse>;
    abstract process(request: OneShotExtractionRequest): Observable<StreamingResponse>;
}

type FeaturesExtractedHandler = (features: FeatureSet) => void;

// TODO try out AsyncIterator when TypeScript 2.3 released
// TODO export this? batchProcess could likely be re-implemented using it
async function segmentAndExtractAsync(request: OneShotExtractionRequest,
                                      service: Service,
                                      config: OneShotConfigurationResponse,
                                      onFeaturesExtracted: FeaturesExtractedHandler,
                                      onComplete: () => void): Promise<void> {

    // TODO revise types in HigherLevelUtilities
    // FramedAudio or AudioStream should contain the framing information.
    // Having to pass around an independent stepSize variable is silly

    // TODO AudioStream should be an async stream
    // This currently isn't the case. The fact it is a generator
    // just allows the consumption of the audio a block at a time,
    // each block being read in a synchronous fashion.
    // It should perhaps be modelled as an Observable or the return
    // of the Generator should be a IterableIterator<Promise<AudioData>>
    const processInputs = toProcessInputStream({
        frames: segment(
            config.configuredBlockSize,
            config.configuredStepSize,
            request.audioData
        ),
        format: request.audioFormat
    }, config.configuredStepSize);

    for (let processInput of processInputs) {
        const response = await service.process({
            handle: config.handle,
            processInput: processInput
        });
        onFeaturesExtracted(response.features);
    }
    const response = await service.finish({
        handle: config.handle
    });
    onFeaturesExtracted(response.features);
    onComplete();
}

type FeatureStream = Observable<FeatureSet>;
function streamFeatures(request: OneShotExtractionRequest,
                        service: Service,
                        config: OneShotConfigurationResponse): FeatureStream {
    return Observable.create((observer: Observer<FeatureSet>) => {
        segmentAndExtractAsync(
            request,
            service,
            config,
            (features: FeatureSet) => observer.next(features),
            () => observer.complete()
        ).catch(err => observer.error(err));
    });
}

export type ProgressCallback = (current: StreamingResponse) => any;
export function collect(featureStream: Observable<StreamingResponse>,
                        onNext?: ProgressCallback): Promise<FeatureCollection> {
    interface InterimNonsense {
        features: FeatureList,
        config: StreamingConfiguration
    }
    return featureStream
        .reduce<StreamingResponse, InterimNonsense>((acc, val) => {
            if (onNext) {
                onNext(val);
            }
            for (let i = 0, len = val.features.length; i < len; ++i) {
                acc.features.push(val.features[i]);
            }
            if (val.configuration) {
                acc.config = val.configuration;
            }
            return acc;
        }, {features: [], config: null})
        .map<InterimNonsense, FeatureCollection>(val => {
            return reshape(
                val.features,
                val.config.inputSampleRate,
                val.config.framing.stepSize,
                val.config.outputDescriptor.configured,
                false
            );
        }).toPromise();
}

export class PiperStreamingService implements StreamingService {
    private client: Service;

    constructor(service: Service) {
        this.client = new Client(service); // TODO should this be injected?
    }

    list(request: ListRequest): Promise<ListResponse> {
        return this.client.list(request);
    }

    process(request: OneShotExtractionRequest): Observable<StreamingResponse> {
        return this.createResponseObservable(
            request
        );
    }

    private createResponseObservable(request: OneShotExtractionRequest)
    : Observable<StreamingResponse> {
        return Observable.fromPromise(loadAndConfigure(
            request,
            this.client
        )).flatMap((config: OneShotConfigurationResponse) => {
            return streamFeatures(request, this.client, config)
                .map<FeatureSet, StreamingResponse>((features, i) => {
                    const output: FeatureList = features.get(
                            config.configuredOutputId
                        ) || [];
                    const nSamples: number | null = request.audioFormat.length;
                    const progress: StreamingProgress = nSamples != null ?
                        {
                            processedBlockCount: i + 1,
                            totalBlockCount: Math.ceil(
                                nSamples / config.configuredStepSize
                            ) + 1 /* Plus one for finish block */
                        } : {processedBlockCount: i + 1};
                    return i === 0 ? {
                        features: output,
                        progress: progress,
                        configuration: {
                            outputDescriptor: config.outputDescriptor,
                            framing: {
                                stepSize: config.configuredStepSize,
                                blockSize: config.configuredBlockSize
                            },
                            inputSampleRate: config.inputSampleRate
                        }
                    } : {features: output, progress: progress};
                })
        });
    }
}

