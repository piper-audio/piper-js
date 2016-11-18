/**
 * Created by lucas on 07/11/2016.
 */
import {
    Parameters, OutputIdentifier, FeatureExtractor, Configuration,
    ConfiguredOutputs, ConfiguredOutputDescriptor,
    SampleType
} from "./FeatureExtractor";
import {Feature, FeatureSet, FeatureList} from "./Feature";
import {fromFrames} from "./Timestamp";
import {
    FeatureTimeAdjuster,
    createFeatureTimeAdjuster
} from "./FeatureTimeAdjuster";

export type AudioData = Float32Array[];
export type Output = {[key: string]: Feature}; // TODO rename / re-think
export type FramedAudio = IterableIterator<AudioData>;

export interface AudioStreamFormat {
    channelCount: number;
    sampleRate: number;
}

export interface AudioStream {
    frames: FramedAudio;
    format: AudioStreamFormat;
}

export type FeatureCollectionShape = "matrix" | "vector" | "list";
// TODO consider revising
export interface FeatureCollection {
    shape: FeatureCollectionShape;
    data: FeatureList | Float32Array | Float32Array[];
}

export interface FixedSpacedFeatures extends FeatureCollection {
    stepDuration: number;
}
export type KeyValueObject = {[key: string]: any};
export type CreateFeatureExtractorFunction = (sampleRate: number,
                                       key: string,
                                       additionalArgs?: KeyValueObject) => FeatureExtractor;

// TODO should format be passed in or derived by the callback?
// TODO does this even make any sense? This only exists because the extractor can inform the buffer size, so one might want to stream at that size
export type CreateAudioStreamFunction = (blockSize: number,
                                         stepSize: number,
                                         format: AudioStreamFormat,
                                         additionalArgs?: KeyValueObject) => AudioStream;

export function* segment(blockSize: number,
                         stepSize: number,
                         audioData: AudioData): IterableIterator<AudioData> {
    let nStep: number = 0;
    const nSteps: number = audioData[0].length / stepSize;
    while (nStep < nSteps) {
        const start: number = nStep++ * stepSize;
        const stop: number = start + blockSize;
        yield audioData.map(channelData => {
            const block = channelData.subarray(start, stop);
            return block.length === blockSize
                ? channelData.subarray(start, stop)
                : Float32Array.of(...block, ...new Float32Array(blockSize - block.length));
        })
    }
}

export function loadAndConfigure(extractor: FeatureExtractor,
                                 channelCount: number,
                                 params: Parameters = new Map(),
                                 args: KeyValueObject = {}): [Configuration, ConfiguredOutputs] {
    const defaultConfig: Configuration = extractor.getDefaultConfiguration();
    let blockSize: number = (args)["blockSize"] || defaultConfig.blockSize || 1024;
    let stepSize: number = (args)["stepSize"] || defaultConfig.stepSize || blockSize;

    let config: Configuration = {
        channelCount: channelCount,
        blockSize: blockSize,
        stepSize: stepSize
    };
    if (params.size) config["parameterValues"] = params;
    return [config, extractor.configure(config)];
}

export function* processConfiguredExtractor(frames: FramedAudio,
                                            sampleRate: number,
                                            stepSize: number,
                                            extractor: FeatureExtractor,
                                            outputs: OutputIdentifier[]): IterableIterator<Output> {
    let nFrame: number = 0;
    const lazyOutput = function* (features: FeatureSet) {
        for (let output of outputs) {
            if (features.has(output))
                for (let feature of features.get(output))
                    yield {[output]: feature};
        }
    };

    for (let frame of frames) {
        const features: FeatureSet = extractor.process({
            timestamp: fromFrames(nFrame, sampleRate),
            inputBuffers: frame
        });

        for (let output of lazyOutput(features))
            yield output;

        nFrame += stepSize;
    }

    for (let output of lazyOutput(extractor.finish()))
        yield output;
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

function reshape(outputs: IterableIterator<Output>,
                 id: OutputIdentifier,
                 stepDuration: number,
                 descriptor: ConfiguredOutputDescriptor): FeatureCollection | FixedSpacedFeatures {
    const shape: FeatureCollectionShape = deduceShape(descriptor);
    const adjuster: FeatureTimeAdjuster = createFeatureTimeAdjuster(descriptor, stepDuration);

    // TODO switch suggests that matrix and list could be types, dynamically dispatch to a .data() method or similar
    switch(shape) {
        case "vector":
            return {
                shape: shape,
                stepDuration: stepDuration,
                data: new Float32Array([...outputs].map(output => output[id].featureValues[0]))
            };
        case "matrix":
            return {
                shape: shape,
                stepDuration: stepDuration,
                data: [...outputs].map(output => new Float32Array(output[id].featureValues))
            };
        case "list":
            return {
                shape: shape,
                data: [...outputs].map(output => {
                    const feature: Feature = output[id];
                    adjuster.adjust(feature);
                    return feature;
                })
            };
        default:
            throw new Error("A valid shape could not be deduced.");
    }
}

function getFeatureStepDuration(sampleRate: number,
                                stepSize: number,
                                descriptor: ConfiguredOutputDescriptor) {
    switch (descriptor.sampleType) {
        case SampleType.OneSamplePerStep:
            return stepSize / sampleRate;
        case SampleType.FixedSampleRate:
            return 1.0 / descriptor.sampleRate;
        default:
            return 1.0;
    }
}

// TODO revise "factories"
export function collect(createAudioStreamCallback: CreateAudioStreamFunction,
                        streamFormat: AudioStreamFormat,
                        createFeatureExtractorCallback: CreateFeatureExtractorFunction,
                        extractorKey: string,
                        outputId?: OutputIdentifier,
                        params?: Parameters,
                        args: KeyValueObject = {}): FeatureCollection {
    // TODO reduce duplication with process - only issue stopping calling process directly here for lazyOutputs is that ConfiguredOutputs and Configuration are needed
    const extractor = createFeatureExtractorCallback(
        streamFormat.sampleRate,
        extractorKey
    );

    const [config, outputs] = loadAndConfigure(extractor, streamFormat.channelCount, params, args);
    const stream: AudioStream = createAudioStreamCallback(
        config.blockSize,
        config.stepSize,
        streamFormat
    );
    outputId = outputId ? outputId : outputs.keys().next().value;

    if (!outputs.has(outputId)) throw Error("Invalid output identifier.");

    const descriptor: ConfiguredOutputDescriptor = outputs.get(outputId);
    const lazyOutputs = processConfiguredExtractor(
        stream.frames,
        stream.format.sampleRate,
        config.stepSize,
        extractor,
        [outputId]
    );
    return reshape(
        lazyOutputs,
        outputId,
        getFeatureStepDuration(stream.format.sampleRate, config.stepSize, descriptor),
        descriptor
    );
}

export function* process(createAudioStreamCallback: CreateAudioStreamFunction,
                         streamFormat: AudioStreamFormat,
                         createFeatureExtractorCallback: CreateFeatureExtractorFunction,
                         extractorKey: string,
                         outputId?: OutputIdentifier,
                         params?: Parameters,
                         args: KeyValueObject = {}): IterableIterator<Feature> {
    // TODO needs wrapping to handle input domain, channel and buffer adapter?
    // this is going to happen automatically in piper-vamp / emscripten extractors - Perhaps it should happen in the factory
    const extractor = createFeatureExtractorCallback(
        streamFormat.sampleRate,
        extractorKey
    );

    const [config, outputs] = loadAndConfigure(extractor, streamFormat.channelCount, params, args);
    const stream: AudioStream = createAudioStreamCallback(
        config.blockSize,
        config.stepSize,
        streamFormat
    );
    outputId = outputId ? outputId : outputs.keys().next().value;
    const descriptor: ConfiguredOutputDescriptor = outputs.get(outputId);
    const lazyOutputs = processConfiguredExtractor(
        stream.frames,
        stream.format.sampleRate,
        config.stepSize,
        extractor,
        [outputId]
    );

    const adjuster: FeatureTimeAdjuster = createFeatureTimeAdjuster(
        descriptor,
        getFeatureStepDuration(stream.format.sampleRate, config.stepSize, descriptor)
    );

    for (let output of lazyOutputs) {
        adjuster.adjust(output[outputId]);
        yield output[outputId];
    }
}
