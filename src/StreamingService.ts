/**
 * Created by lucas on 31/03/2017.
 */
import {
    ListRequest,
    ListResponse,
    Service
} from "./Piper";
import {
    loadAndConfigure,
    reshape,
    segment,
    SimpleConfigurationResponse,
    SimpleRequest,
    SimpleResponse,
    toProcessInputStream
} from "./HigherLevelUtilities";
import {Observable, Observer} from "rxjs";
import {PiperClient} from "./PiperClient";
import {FeatureList, FeatureSet} from "./Feature";

export interface StreamingService {
    list(request: ListRequest): Promise<ListResponse>;
    process(request: SimpleRequest): Observable<SimpleResponse>;
    collect(request: SimpleRequest): Observable<SimpleResponse>;
}

type FeaturesExtractedHandler = (features: FeatureSet) => void;

// TODO try out AsyncIterator when TypeScript 2.3 released
// TODO export this? batchProcess could likely be re-implemented using it
async function segmentAndExtractAsync(request: SimpleRequest,
                                      service: Service,
                                      config: SimpleConfigurationResponse,
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

    // TODO this probably isn't quite correct.
    // The intent here is to only emit features from the finish call if
    // there actually are any.
    //
    // This highlights this method only works for returning a single output.
    // This is actually intended, but might not be sensible
    if (response.features.has(request.outputId)) {
        if (response.features)
        onFeaturesExtracted(response.features);
    }
    onComplete();
}

type FeatureStream = Observable<FeatureSet>;
function streamFeatures(request: SimpleRequest,
                        service: Service,
                        config: SimpleConfigurationResponse): FeatureStream {
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

export class PiperStreamingService implements StreamingService {
    private client: Service;

    constructor(service: Service) {
        this.client = new PiperClient(service); // TODO should this be injected?
    }

    list(request: ListRequest): Promise<ListResponse> {
        return this.client.list(request);
    }

    process(request: SimpleRequest): Observable<SimpleResponse> {
        return Observable.fromPromise(loadAndConfigure(
            request,
            this.client
        )).flatMap((config: SimpleConfigurationResponse) => {
            return streamFeatures(request, this.client, config)
                .map<FeatureSet, SimpleResponse>(features => {
                    const output: FeatureList = features.get(
                            config.configuredOutputId
                        ) || [];
                    return {
                        features: {
                            shape: "list",
                            data: output
                        },
                        outputDescriptor: config.outputDescriptor
                    };
                })
        });
    }

    collect(request: SimpleRequest): Observable<SimpleResponse> {
        return Observable.fromPromise(loadAndConfigure(
            request,
            this.client
        )).flatMap((config: SimpleConfigurationResponse) => {
            return streamFeatures(request, this.client, config)
                .map<FeatureSet, SimpleResponse>(features => {
                    const output: FeatureList = features.get(
                            config.configuredOutputId
                        ) || [];
                    return {
                        features: reshape(/*
                             TODO reduce dupe - this is from HigherLevelUtils
                             */
                            output.map(feature => {
                                return {
                                    [config.configuredOutputId]: feature
                                }
                            }), // map FeatureList to {outputId: Feature}[]
                            config.configuredOutputId,
                            config.inputSampleRate,
                            config.configuredStepSize,
                            config.outputDescriptor.configured,
                            false
                        ),
                        outputDescriptor: config.outputDescriptor
                    };
                })
        });
    }
}

