/**
 * Created by lucas on 25/08/2016.
 */
import {
    FeatureExtractor, ConfiguredOutputs,
    Configuration, OutputIdentifier, ConfiguredOutputDescriptor, SampleType,
    ProcessInput
} from "../FeatureExtractor";
import {FeatureSet, FeatureList} from "../Feature";
import {frame2timestamp} from "../Timestamp";


export default class ZeroCrossings implements FeatureExtractor {
    private previousSample: number;
    private inputSampleRate: number;

    constructor(inputSampleRate: number) {
        this.inputSampleRate = inputSampleRate;
        this.previousSample = 0;
    }

    configure(configuration: Configuration): ConfiguredOutputs {
        return new Map<OutputIdentifier, ConfiguredOutputDescriptor>([
            ["counts", {
                binCount: 1,
                quantizeStep: 1.0,
                sampleType: SampleType.OneSamplePerStep,
                hasDuration: false,
                unit: "crossings"
            }],
            ["crossings", {
                binCount: 0,
                quantizeStep: 1,
                sampleType: SampleType.VariableSampleRate,
                sampleRate: this.inputSampleRate,
                hasDuration: false,
                unit: "",
            }]
        ])
    }

    getDefaultConfiguration(): Configuration {
        return {channelCount: 1, blockSize: 0, stepSize: 0};
    }

    process(block: ProcessInput): FeatureSet {
        let count: number = 0;
        let returnFeatures: FeatureSet = new Map();
        let crossingPoints: FeatureList = [];

        const channel = block.inputBuffers[0]; // ignore stereo channels
        channel.forEach((sample, nSample) => {
            if (this.hasCrossedAxis(sample)) {
                ++count;
                crossingPoints.push({timestamp: frame2timestamp(nSample, this.inputSampleRate)});
            }
            this.previousSample = sample;
        });

        returnFeatures.set("counts", [{featureValues: new Float32Array([count])}]);
        if (crossingPoints.length > 0) returnFeatures.set("crossings", crossingPoints);
        return returnFeatures;
    }

    finish(): FeatureSet {
        return new Map();
    }

    private hasCrossedAxis(sample: number) {
        const hasCrossedFromAbove = this.previousSample > 0.0 && sample <= 0.0;
        const hasCrossedFromBelow = this.previousSample <= 0.0 && sample > 0.0;
        return hasCrossedFromBelow || hasCrossedFromAbove;
    }
}
