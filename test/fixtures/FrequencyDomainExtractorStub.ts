

import {
    FeatureExtractor, ConfiguredOutputs,
    Configuration, ConfiguredOutputDescriptor, OutputIdentifier, SampleType,
    ProcessInput, StaticData, InputDomain
} from "../../src/FeatureExtractor";
import {FeatureSet, FeatureList} from "../../src/Feature";
export class FrequencyDomainExtractorStub implements FeatureExtractor {
    private binCount: number;

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
            magnitude[i] = real * real + imaginary * imaginary;
        }
        return new Map([
            ["spectrum", [{featureValues: magnitude}]]
        ]);
    }

    finish(): FeatureSet {
        return new Map();
    }
}

export const FrequencyMetaDataStub: StaticData = {
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

export class PassThroughExtractor implements FeatureExtractor {

    public static getMetaData(): StaticData {
        return {
            basic: {
                description: "A stub, returns the input to process",
                identifier: "stub",
                name: "PassThrough Stub"
            },
            basicOutputInfo: [
                {
                    description: "The input buffer",
                    identifier: "passthrough",
                    name: "Pass-through"
                }
            ],
            inputDomain: InputDomain.FrequencyDomain,
            maxChannelCount: 1,
            minChannelCount: 1,
            key: "stub:passthrough",
            version: 1
        };
    }

    configure(configuration: Configuration): ConfiguredOutputs {
        return new Map<string, ConfiguredOutputDescriptor>([
            ["passthrough", {
                binCount: configuration.blockSize + 2,
                sampleType: SampleType.OneSamplePerStep,
                hasDuration: false
            }]
        ]);
    }

    getDefaultConfiguration(): Configuration {
        return {channelCount: 1, blockSize: 4, stepSize: 2};
    }

    process(block: ProcessInput): FeatureSet {
        return new Map<string, FeatureList>([
            ["passthrough", [{
                timestamp: block.timestamp,
                featureValues: block.inputBuffers[0]
            }]]
        ]);
    }

    finish(): FeatureSet {
        return new Map();
    }
}