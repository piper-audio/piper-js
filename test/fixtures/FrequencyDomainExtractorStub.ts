import {
    Configuration, ConfiguredOutputs, FeatureExtractor, ProcessInput, StaticData, InputDomain, OutputIdentifier,
    ConfiguredOutputDescriptor, SampleType
} from "feats/FeatureExtractor";
import {FeatureSet} from "feats/Feature";

export class FrequencyDomainExtractorStub implements FeatureExtractor {
    private binCount;

    constructor() {
        this.binCount = 0;
    }

    configure(configuration: Configuration): ConfiguredOutputs {
        this.binCount = 1 + 0.5 * configuration.blockSize;
        const descriptor: ConfiguredOutputDescriptor = {
            binCount: this.binCount,
            sampleType: SampleType.OneSamplePerStep,
            hasDuration: false
        };
        return new Map<OutputIdentifier, ConfiguredOutputDescriptor>([
            ["spectrum", descriptor]
        ]);
    }

    getDefaultConfiguration(): Configuration {
        return {channelCount: 1, blockSize: 0, stepSize: 0};
    }

    process(block: ProcessInput): FeatureSet {
        const complex = block.inputBuffers[0]; // complex data is always in the first buffer?
        const magnitude: Float32Array = new Float32Array(this.binCount);

        for (let i = 0; i < this.binCount; ++i) {
            const real: number = complex[i * 2];
            const imaginary: number = complex[i * 2 + 1];
            magnitude.set(i, real * real + imaginary * imaginary);
        }
        return new Map([
            ["spectrum", [{featureValues: magnitude}]]
        ]);
    }

    finish(): FeatureSet {
        return new Map();
    }
}

export const MetaDataStub: StaticData = {
    basic: {
        description: "A stub, return power spectrum.",
        identifier: "stub-freq",
        name: "Frequency Domain Stub"
    },
    basicOutputInfo: [
        {
            description: "The power spectrum",
            identifier: "spectrum",
            name: "Power Spectrum"
        }
    ],
    inputDomain: InputDomain.FrequencyDomain,
    maxChannelCount: 1,
    minChannelCount: 1,
    key: "stub-freq:spectrum",
    version: 1
};