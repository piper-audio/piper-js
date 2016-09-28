import {
    Configuration, ConfiguredOutputs, FeatureExtractor, ProcessInput, StaticData, InputDomain, OutputIdentifier,
    ConfiguredOutputDescriptor, SampleType
} from "../../src/FeatureExtractor";
import {FeatureSet} from "../../src/Feature";

export class FeatureExtractorStub implements FeatureExtractor {
    private cumulativeSum: number;
    constructor() {
        this.cumulativeSum = 0;
    }

    configure(configuration: Configuration): ConfiguredOutputs {
        const descriptor: ConfiguredOutputDescriptor = {
            binCount: 1,
            sampleType: SampleType.OneSamplePerStep,
            hasDuration: false
        };
        return new Map<OutputIdentifier, ConfiguredOutputDescriptor>([
            ["sum", descriptor],
            ["cumsum", descriptor]
        ]);
    }

    getDefaultConfiguration(): Configuration {
        return {channelCount: 1, blockSize: 0, stepSize: 0};
    }

    process(block: ProcessInput): FeatureSet {
        const sum = block.inputBuffers[0].reduce((total, current) => total + current);
        this.cumulativeSum += sum;
        return new Map([
            ["sum", [{featureValues: new Float32Array([sum])}]],
            ["cumsum", [{featureValues: new Float32Array([this.cumulativeSum])}]]
        ]);
    }

    finish(): FeatureSet {
        return new Map();
    }
}

export const MetaDataStub: StaticData = {
    basic: {
        description: "A stub, returns sum of samples in process block and keeps a cumulative sum.",
        identifier: "stub",
        name: "Stub"
    },
    basicOutputInfo: [
        {
            description: "The sum of the samples in the input block",
            identifier: "sum",
            name: "Sum"
        },
        {
            description: "The cumulative sum over all input blocks",
            identifier: "cumsum",
            name: "Cumulative Sum"
        }
    ],
    inputDomain: InputDomain.TimeDomain,
    maxChannelCount: 1,
    minChannelCount: 1,
    pluginKey: "stub:sum",
    pluginVersion: 1
};