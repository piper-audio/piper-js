/**
 * Created by lucast on 24/10/2016.
 */
import * as chai from "chai";
import {
    ProcessInput
} from "../src/FeatureExtractor";
import {FeatureList, Feature} from "../src/Feature";
import {PassThroughExtractor} from "./fixtures/FrequencyDomainExtractorStub";
import {
    FrequencyDomainAdapter,
    ProcessInputAdjustmentMethod
} from "../src/FrequencyDomainAdapter";
import {KissRealFft} from "../src/fft/RealFft";
import {fromSeconds} from "../src/Timestamp";
chai.should();

function crudeBuffering(input: Float32Array,
                        sampleRate: number,
                        stepSize: number,
                        blockSize: number): ProcessInput[] {
    let blocks: ProcessInput[] = [];
    const stepSizeSeconds = stepSize / sampleRate;
    // crude buffering
    for (let i = 0, n = 0; i <= input.length; i += stepSize, ++n) {
        let buffer: Float32Array = input.subarray(i, i + blockSize);

        // TODO is zero padding the last buffer the responsibility of the adjuster, or buffering / calling code?
        if (buffer.length < blockSize) {
            buffer = new Float32Array(blockSize);
            buffer.set(input.subarray(i, i + blockSize));
        }

        blocks.push({
            timestamp: fromSeconds(n * stepSizeSeconds),
            inputBuffers: [buffer]
        });
    }
    return blocks;
}

describe("FrequencyDomainAdapter", () => {
    it("Produces the same output as Sonic Annotator", () => {
        const fullInput: Float32Array = new Float32Array([
            -1.0, -1.0, -1.0, -1.0,
            -0.5, -0.5, -0.5, -0.5,
            0.0, 0.0, 0.0, 0.0,
            0.5, 0.5, 0.5, 0.5,
            1.0, 1.0, 1.0, 1.0
        ]);
        const sampleRate: number = 16;
        const blockSize: number = 4;
        const stepSize: number = 2;
        let extractor = new FrequencyDomainAdapter(
            new PassThroughExtractor(),
            (size: number) => new KissRealFft(size),
            sampleRate,
            ProcessInputAdjustmentMethod.Buffer
        );
        extractor.configure(extractor.getDefaultConfiguration());

        const expectedFeatures: FeatureList = [
            {
                timestamp: {s: 0, n: 0},
                featureValues: new Float32Array([-1.5, 0, -1, 0.5, -0.5, 0])
            },
            {
                timestamp: {s: 0, n: 125000000},
                featureValues: new Float32Array([-2, 0, -1, 1.66533e-16, 0, 0])
            },
            {
                timestamp: {s: 0, n: 250000000},
                featureValues: new Float32Array([-1.25, 0, -0.5, -0.25, 0.25, 0])
            },
            {
                timestamp: {s: 0, n: 375000000},
                featureValues: new Float32Array([-1, 0, -0.5, 8.32667e-17, 0, 0])
            },
            {
                timestamp: {s: 0, n: 500000000},
                featureValues: new Float32Array([-0.25, 0, 0, -0.25, 0.25, 0])
            },
            {
                timestamp: {s: 0, n: 625000000},
                featureValues: new Float32Array([0, 0, 0, 0, 0, 0])
            },
            {
                timestamp: {s: 0, n: 750000000},
                featureValues: new Float32Array([0.75, 0, 0.5, -0.25, 0.25, 0])
            },
            {
                timestamp: {s: 0, n: 875000000},
                featureValues: new Float32Array([1, 0, 0.5, -8.32667e-17, 0, 0])
            },
            {
                timestamp: {s: 1, n: 0},
                featureValues: new Float32Array([1.75, 0, 1, -0.25, 0.25, 0])
            },
            {
                timestamp: {s: 1, n: 125000000},
                featureValues: new Float32Array([2, 0, 1, -1.66533e-16, 0, 0])
            },
            {
                timestamp: {s: 1, n: 250000000},
                featureValues: new Float32Array([0.5, 0, 0, 0.5, -0.5, 0])
            }
        ];

        const process: (block: ProcessInput) => FeatureList
            = (block: ProcessInput): FeatureList => {
            return extractor.process(block).get("passthrough");
        };


        const actualFeatures: FeatureList = crudeBuffering(
            fullInput,
            sampleRate,
            stepSize,
            blockSize
        ).reduce((acc, features) => acc.concat(process(features)), []);

        actualFeatures.forEach((feature: Feature, i: number) => {
            feature.featureValues.forEach((actual: number, j: number) => {
                const expected: number = expectedFeatures[i].featureValues[j];
                chai.assert.approximately(actual, expected, 0.1e-14);
            })
        });
    });
});
