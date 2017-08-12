import {
    Configuration,
    ConfiguredOutputDescriptor,
    ExtractorConfiguration,
    Feature,
    FeatureExtractor,
    FeatureSet,
    ProcessInput,
    SampleType
} from './core';
import {fromFrames, fromSeconds, Timestamp, toSeconds} from './time';
import {RealFftFactory} from './fft';
import {applyHannWindowTo, cyclicShiftInPlace, RealFft} from './fft';

export interface ProcessInputAdjuster {
    adjust(input: ProcessInput): ProcessInput;
}

export class ProcessInputBuffersAdjuster implements ProcessInputAdjuster {
    private buffers: Float32Array[];
    private offset: number;
    private blockSize: number;
    private stepSize: number;

    constructor(config: Configuration) {
        this.blockSize = config.framing.blockSize;
        this.stepSize = config.framing.stepSize;
        this.offset = Math.floor(0.5 * this.blockSize);
        this.buffers = [...Array(config.channelCount)].map(
            () => new Float32Array(this.blockSize + this.offset)
        );
    }

    adjust(input: ProcessInput): ProcessInput {
        return {
            timestamp: input.timestamp,
            inputBuffers: input.inputBuffers.map((buffer, i) => {
                this.buffers[i].copyWithin(
                    0,
                    this.stepSize,
                    this.blockSize + this.offset
                );
                this.buffers[i].set(
                    buffer.subarray(0, this.blockSize),
                    this.offset
                );
                return this.buffers[i].slice(0, this.blockSize);
            })
        };
    }
}

export class ProcessInputTimestampAdjuster implements ProcessInputAdjuster {
    private adjustmentSeconds: number;

    constructor(blockSize: number, sampleRate: number) {
        this.adjustmentSeconds = 0.5 * (blockSize / sampleRate);
    }

    adjust(input: ProcessInput): ProcessInput {
        return {
            timestamp: fromSeconds(
                toSeconds(input.timestamp) + this.adjustmentSeconds
            ),
            inputBuffers: input.inputBuffers
        }
    }
}

export interface FeatureTimeAdjuster {
    adjust(feature: Feature, inputTimestamp?: Timestamp): void;
}

export class VariableSampleRateFeatureTimeAdjuster implements FeatureTimeAdjuster {
    constructor(private descriptor: ConfiguredOutputDescriptor) {}

    adjust(feature: Feature): void {
        if (!feature.hasOwnProperty("timestamp")) {
            throw new Error("Feature must have a timestamp");
        }
        const hasSampleRate: boolean = this.descriptor.hasOwnProperty(
            "sampleRate"
        ) && this.descriptor.sampleRate !== 0.0;
        if (!feature.hasOwnProperty("duration")) {
            feature.duration = hasSampleRate ?
                fromFrames(1, this.descriptor.sampleRate) : {s: 0, n: 0};
        }
    }
}

export class FixedSampleRateFeatureTimeAdjuster implements FeatureTimeAdjuster {
    private lastFeatureIndex: number;

    constructor(private descriptor: ConfiguredOutputDescriptor) {
        if (!descriptor.hasOwnProperty("sampleRate")
            || descriptor.sampleRate === 0.0) {
            throw new Error("OutputDescriptor must provide a sample rate.");
        }
        this.lastFeatureIndex = -1;
    }

    adjust(feature: Feature): void {
        const sr: number = this.descriptor.sampleRate;
        const featureIndex: number = feature.hasOwnProperty("timestamp") ?
            Math.round(toSeconds(feature.timestamp) * sr) :
            this.lastFeatureIndex + 1;
        feature.timestamp = fromFrames(featureIndex, sr);
        feature.duration = feature.hasOwnProperty("duration") ?
            fromFrames(Math.round(toSeconds(feature.duration) * sr), sr) :
            {s: 0, n: 0};
        this.lastFeatureIndex = featureIndex;
    }
}

export class OneSamplePerStepFeatureTimeAdjuster implements FeatureTimeAdjuster {
    private stepSizeSeconds: number;
    private lastFeatureIndex: number;

    constructor(stepSizeSeconds: number) {
        if (stepSizeSeconds == null) {
            throw new Error("Host must provide the step size (seconds).");
        }
        this.stepSizeSeconds = stepSizeSeconds;
        this.lastFeatureIndex = -1;
    }

    adjust(feature: Feature, inputTimestamp: Timestamp): void {
        const isValidTimestamp = inputTimestamp &&
            inputTimestamp.hasOwnProperty("s") &&
            inputTimestamp.hasOwnProperty("n");
        feature.timestamp = isValidTimestamp ?
            inputTimestamp : this.calculateNextTimestamp();
        if (isValidTimestamp) {
            this.lastFeatureIndex = Math.round(
                toSeconds(feature.timestamp) / this.stepSizeSeconds
            );
        }
        delete feature.duration; // host should ignore duration
    }

    private calculateNextTimestamp() {
        return fromSeconds(
            ++this.lastFeatureIndex * this.stepSizeSeconds
        );
    }
}

export function
createFeatureTimeAdjuster(descriptor: ConfiguredOutputDescriptor,
                          stepSizeSeconds?: number): FeatureTimeAdjuster {

    switch (descriptor.sampleType) {
        case SampleType.OneSamplePerStep:
            return new OneSamplePerStepFeatureTimeAdjuster(stepSizeSeconds);
        case SampleType.VariableSampleRate:
            return new VariableSampleRateFeatureTimeAdjuster(descriptor);
        case SampleType.FixedSampleRate:
            return new FixedSampleRateFeatureTimeAdjuster(descriptor);
    }
    throw new Error("No valid FeatureTimeAdjuster could be constructed.");
}

export enum ProcessInputAdjustmentMethod {
    Timestamp,
    Buffer
}

export class FrequencyDomainAdapter implements FeatureExtractor {
    private wrapped: FeatureExtractor;
    private fft: RealFft;
    private fftFactory: RealFftFactory;
    private adjuster: ProcessInputAdjuster;
    private sampleRate: number;
    private adjustmentMethod: ProcessInputAdjustmentMethod;

    constructor(extractor: FeatureExtractor,
                fftFactory: RealFftFactory,
                sampleRate: number,
                adjustmentMethod: ProcessInputAdjustmentMethod) {
        this.wrapped = extractor;
        this.fftFactory = fftFactory;
        this.sampleRate = sampleRate;
        this.adjustmentMethod = adjustmentMethod;
    }

    configure(configuration: Configuration): ExtractorConfiguration {
        this.fft = this.fftFactory(configuration.framing.blockSize); // TODO verify power of 2?
        this.adjuster = this.adjustmentMethod === ProcessInputAdjustmentMethod.Buffer
            ? new ProcessInputBuffersAdjuster(configuration)
            : new ProcessInputTimestampAdjuster(
                configuration.framing.blockSize,
                this.sampleRate
            );
        return this.wrapped.configure(configuration);
    }

    getDefaultConfiguration(): Configuration {
        return this.wrapped.getDefaultConfiguration();
    }

    process(block: ProcessInput): FeatureSet {
        const forwardFft: (channel: Float32Array) => Float32Array =
            (channel) => this.fft.forward(
                cyclicShiftInPlace(applyHannWindowTo(channel))
            );
        const timeAdjustedBlock: ProcessInput = this.adjuster.adjust(block);
        return this.wrapped.process({
            timestamp: timeAdjustedBlock.timestamp,
            inputBuffers: timeAdjustedBlock.inputBuffers.map(forwardFft)
        });
    }

    finish(): FeatureSet {
        this.fft.dispose();
        return this.wrapped.finish();
    }
}