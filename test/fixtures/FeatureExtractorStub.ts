import {
    ProcessInput} from "../../src/core";
import {
    Configuration,
    ConfiguredOutputDescriptor, ExtractorConfiguration,
    FeatureExtractor, FeatureSet, InputDomain, OutputIdentifier,
    SampleType, StaticData
} from "../../src/core";
import {Feature} from '../../src/core';

export class FeatureExtractorStub implements FeatureExtractor {
    private cumulativeSum: number;
    private includeConditionalOutput: boolean;
    constructor(includeConditionalOutput = false) {
        this.cumulativeSum = 0;
        this.includeConditionalOutput = includeConditionalOutput;
    }

    configure(configuration: Configuration): ExtractorConfiguration {
        const descriptor: ConfiguredOutputDescriptor = {
            binCount: 1,
            sampleType: SampleType.OneSamplePerStep,
            hasDuration: false
        };
        return {
            outputs: new Map<OutputIdentifier, ConfiguredOutputDescriptor>([
                ["sum", descriptor],
                ["cumsum", descriptor],
                ["conditional", descriptor],
                ["passthrough", {
                    binCount: configuration.framing.blockSize,
                    sampleType: SampleType.OneSamplePerStep,
                    hasDuration: false
                }],
                ["finish", {
                    binCount: 1,
                    sampleType: SampleType.VariableSampleRate,
                    hasDuration: false
                }]
            ]),
            framing: configuration.framing
        };
    }

    getDefaultConfiguration(): Configuration {
        return {
            channelCount: 1,
            framing: {
                blockSize: 0,
                stepSize: 0
            }
        };
    }

    process(block: ProcessInput): FeatureSet {
        const sum = block.inputBuffers[0].reduce((total, current) => total + current);
        this.cumulativeSum += sum;
        let outputs = new Map();
        if (this.includeConditionalOutput)
            outputs.set("conditional", [{featureValues: new Float32Array([666])}]);

        outputs.set("sum", [{featureValues: new Float32Array([sum])}]);
        outputs.set("passthrough", [{featureValues: Float32Array.from(
            block.inputBuffers[0]
        )}]);
        outputs.set("cumsum", [{featureValues: new Float32Array([this.cumulativeSum])}]);
        return outputs;
    }

    finish(): FeatureSet {
        const feature: Feature = {
            featureValues: new Float32Array([1969]),
            timestamp: {s: 0, n: 0}
        };
        return new Map([["finish", [feature]]]);
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
        },
        {
            description: "The first channel as provided to process",
            identifier: "passthrough",
            name: "Pass-Through"
        },
        {
            description: "An output which is only included sometimes",
            identifier: "conditional",
            name: "Conditional number"
        },
        {
            description: "An output which returns features in the finish call",
            identifier: "finish",
            name: "Final number"
        }
    ],
    staticOutputInfo: new Map([
        ["sum", {
            typeURI: "http://example.com/test/uri"
        }]
    ]),
    inputDomain: InputDomain.TimeDomain,
    maxChannelCount: 1,
    minChannelCount: 1,
    key: "stub:sum",
    version: 1
};
