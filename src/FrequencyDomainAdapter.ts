/**
 * Created by lucast on 24/10/2016.
 */
import {RealFft, KissRealFft} from "./fft/RealFft";
import {
    ProcessInput, FeatureExtractor, Configuration,
    ConfiguredOutputs
} from "feats";
import {FeatureSet} from "feats/Feature"
import {cyclicShiftInPlace, applyHannWindowTo} from "./FftUtilities";
import {ProcessInputBuffersAdjuster} from "./ProcessInputAdjuster";

export class FrequencyDomainAdapter implements FeatureExtractor {
    private wrapped: FeatureExtractor;
    private fft: RealFft;
    private adjuster: ProcessInputBuffersAdjuster;

    constructor(extractor: FeatureExtractor, ) {
        this.wrapped = extractor;
    }

    configure(configuration: Configuration): ConfiguredOutputs {
        this.fft = new KissRealFft(configuration.blockSize); // TODO verify power of 2? And use a factory
        this.adjuster = new ProcessInputBuffersAdjuster(configuration);
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