/**
 * Created by lucast on 24/10/2016.
 */
import {RealFft, RealFftFactory} from "./fft/RealFft";
import {
    ProcessInput, FeatureExtractor, Configuration,
    ExtractorConfiguration
} from "./FeatureExtractor";
import {FeatureSet} from "./Feature"
import {cyclicShiftInPlace, applyHannWindowTo} from "./FftUtilities";
import {
    ProcessInputBuffersAdjuster,
    ProcessInputAdjuster, ProcessInputTimestampAdjuster
} from "./ProcessInputAdjuster";

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
                        : new ProcessInputTimestampAdjuster(configuration.framing.blockSize, this.sampleRate);
        return this.wrapped.configure(configuration);
    }

    getDefaultConfiguration(): Configuration {
        return this.wrapped.getDefaultConfiguration();
    }

    process(block: ProcessInput): FeatureSet {
        const forwardFft: (channel: Float32Array) => Float32Array =
            (channel) => this.fft.forward(cyclicShiftInPlace(applyHannWindowTo(channel)));
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