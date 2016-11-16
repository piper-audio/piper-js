/**
 * Created by lucas on 07/11/2016.
 */
import * as chai from "chai";
import {
    processConfiguredExtractor,
    segment,
    process, ExtractorFactory, ExtractorFactoryArgs, collect,
    AudioStreamFormat, AudioStreamFactory,
    FixedSpacedFeatures, AudioData
} from "../src/HigherLevelUtilities";
import {FeatureExtractor} from "../src/FeatureExtractor";
import {makeTimestamp} from "../src/Timestamp"
import {
    EmscriptenFeatureExtractor
} from "../src/EmscriptenProxy";
import VampTestPluginModule = require('../ext/VampTestPlugin');
import {Feature} from "../src/Feature";
import {
    EmscriptenListenerCleaner,
    createEmscriptenCleanerWithNodeGlobal
} from "./TestUtilities";
chai.should();

const cleaner: EmscriptenListenerCleaner = createEmscriptenCleanerWithNodeGlobal();
const sampleRate = 44100;
const blockSize = 1024;
const extractorKey = "vamp-test-plugin:vamp-test-plugin";
const extractorFrequencyDomainKey = "vamp-test-plugin:vamp-test-plugin-freq";

function generateInputData(n: number): Float32Array {
    return Float32Array.from(Array(n).keys()).map(n => n + 1);
}

const streamFormat: AudioStreamFormat = {
    channelCount: 1,
    sampleRate: sampleRate
};

function createStreamFactory(numberOfChannels: number,
                             numberOfSamples: number): AudioStreamFactory {
    return (blockSize: number,
            stepSize: number,
            format: AudioStreamFormat) => {
        return {
            frames: segment(
                blockSize,
                stepSize,
                [...Array(numberOfChannels)].map(() => generateInputData(numberOfSamples))
            ),
            format: format
        }
    }
}

const extractorFactory: ExtractorFactory = (args: ExtractorFactoryArgs) => {
    return new EmscriptenFeatureExtractor(
        VampTestPluginModule(),
        args.sampleRate,
        args.key
    )
};

const delta: number = 1e-6;

describe("Segment", () => {
    const blockSize: number = 8;
    const stepSize: number = 4;
    const nBlocks: number = 4;
    const audioData: Float32Array = new Float32Array(nBlocks * blockSize);
    const fillBlocksWithConsecutiveIntegers = (audioData: Float32Array) => {
        for (let nBlock = 1; nBlock < nBlocks; ++nBlock)
            audioData.fill(nBlock, nBlock * blockSize, (nBlock * blockSize) + blockSize);
    };

    fillBlocksWithConsecutiveIntegers(audioData);
    let frames: IterableIterator<AudioData>;

    beforeEach("reset segment generator", () => {
        frames = segment(blockSize, stepSize, [audioData])
    });

    it('Can be used as an iterator', () => {
        frames.next().value.should.deep.equal([new Float32Array([0, 0, 0, 0, 0, 0, 0, 0])]);
        frames.next().value.should.deep.equal([new Float32Array([0, 0, 0, 0, 1, 1, 1, 1])]);
        frames.next().value.should.deep.equal([new Float32Array([1, 1, 1, 1, 1, 1, 1, 1])]);
        frames.next().value.should.deep.equal([new Float32Array([1, 1, 1, 1, 2, 2, 2, 2])]);
        frames.next().value.should.deep.equal([new Float32Array([2, 2, 2, 2, 2, 2, 2, 2])]);
        frames.next().value.should.deep.equal([new Float32Array([2, 2, 2, 2, 3, 3, 3, 3])]);
        frames.next().value.should.deep.equal([new Float32Array([3, 3, 3, 3, 3, 3, 3, 3])]);
        frames.next().value.should.deep.equal([new Float32Array([3, 3, 3, 3, 0, 0, 0, 0])]);
        return frames.next().done.should.be.true;
    });

    it('Can be looped over', () => {
        const expectedBlocks: number[][] = [
            [ 0, 0, 0, 0, 0, 0, 0, 0 ],
            [ 0, 0, 0, 0, 1, 1, 1, 1 ],
            [ 1, 1, 1, 1, 1, 1, 1, 1 ],
            [ 1, 1, 1, 1, 2, 2, 2, 2 ],
            [ 2, 2, 2, 2, 2, 2, 2, 2 ],
            [ 2, 2, 2, 2, 3, 3, 3, 3 ],
            [ 3, 3, 3, 3, 3, 3, 3, 3 ],
            [ 3, 3, 3, 3, 0, 0, 0, 0 ]
        ];
        let i = 0;
        for (let block of frames)
            Array.from(block[0]).should.deep.equal(expectedBlocks[i++]);
    });

    it("should zero pad all blocks less than block size", () => {
        const frames = segment(4, 1, [new Float32Array([1, 1, 1, 1])]);
        const expectedFrames = [
            Float32Array.from([1, 1, 1, 1]),
            Float32Array.from([1, 1, 1, 0]),
            Float32Array.from([1, 1, 0, 0]),
            Float32Array.from([1, 0, 0, 0])
        ];
        [...frames][0].forEach((frame, i) => frame.should.eql(expectedFrames[i]));
    })
});

describe("processConfiguredExtractor()", function () {
    afterEach(() => {
        cleaner.clean();
    });
    const data: Float32Array = new Float32Array([
        -1.0, -1.0, -1.0, -1.0,
        -0.5, -0.5, -0.5, -0.5,
        0.0, 0.0, 0.0, 0.0,
        0.5, 0.5, 0.5, 0.5,
        1.0, 1.0, 1.0, 1.0
    ]);

    it("works at all", () => {
        const stepSize: number = 2;
        const blockSize: number = 4;
        const sampleRate: number = 16;
        const frames = segment(blockSize, stepSize, [data]);

        const extractor: FeatureExtractor = new EmscriptenFeatureExtractor(
            VampTestPluginModule(),
            sampleRate,
            "vamp-test-plugin:vamp-test-plugin"
        );

        extractor.configure({
            channelCount: 1,
            stepSize: stepSize,
            blockSize: blockSize
        });

        const features = processConfiguredExtractor(
            frames,
            sampleRate,
            stepSize,
            extractor,
            ["curve-fsr"]
        );

        [...features].length.should.equal(data.length / stepSize);
    });
});

describe("process()", () => {
    afterEach(() => {
        cleaner.clean();
    });
    it("can process time domain extractors", () => {
        [...process(
            createStreamFactory(1, blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "input-summary"
        )].length.should.equal(1);
    });

    it("can process frequency domain extractors", () => {
        [...process(
            createStreamFactory(1, blockSize),
            streamFormat,
            extractorFactory,
            extractorFrequencyDomainKey,
            "input-summary"
        )].length.should.equal(2); // one complete block starting at zero, one half-full
    });

    it("will use the first output if no output identifier provided", () => {
        const features = process(
            createStreamFactory(1, blockSize),
            streamFormat,
            extractorFactory,
            extractorKey
        );
        let i = 0;
        for (let feature of features)
            feature.timestamp.should.eql(makeTimestamp(i++ * 1.5));
    });

    it("can configure the extractor with provided parameters", () => {
        [...process(
            createStreamFactory(1, blockSize * 10),
            streamFormat,
            extractorFactory,
            extractorKey,
            "input-summary",
            new Map([["produce_output", 0]])
        )].length.should.equal(0);
    });

    it("can process with a specified block and step size", () => {
        const features = process(
            createStreamFactory(1, blockSize * 10),
            streamFormat,
            extractorFactory,
            extractorKey,
            "input-timestamp",
            new Map(),
            {blockSize: blockSize * 2, stepSize: blockSize * 0.5}
        );
        let i = 0;
        for (let feature of features)
            feature.featureValues[0].should.equal((i++ * blockSize) * 0.5);
    });

    it("produces valid output for time domain (input-summary)", () => {
        const features = [...process(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "input-summary"
        )];
        features.length.should.equal(10);
        features.forEach((feature, i) => {
            feature.featureValues[0].should.equal(blockSize + i * blockSize + 1);
        });
    });

    it("produces valid output for frequency domain (input-summary)", () => {
        const features = [...process(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorFrequencyDomainKey,
            "input-summary"
        )];
        features.length.should.equal(20);
        features.forEach((feature, i) => {
            let expected = (i === features.length - 1)
                ? 0
                : i * blockSize * 0.5 + blockSize * 0.5 + 1;
            expected = expected + blockSize - 1;
            Math.abs(feature.featureValues[0] - expected).should.be.approximately(0, delta);
        });
    });
});

describe("collect()", function () {
    afterEach(() => {
        cleaner.clean();
    });

    it("produces output", () => {
        return collect(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "input-summary"
        ).should.exist;
    });

    it("produces valid output for one sample per step features", () => {
        const features = collect(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "input-timestamp"
        );
        features.shape.should.eql("vector");
        // TODO downcasting doesn't seem particularly desirable - but perhaps doesn't matter
        Math.abs((features as FixedSpacedFeatures).stepDuration - (blockSize / sampleRate))
            .should.be.approximately(0.0, delta);
        features.data.length.should.equal(10);
        (features.data as Float32Array) // TODO compiler cannot infer the type because it is a union type - perhaps better encode the the matrix / list / vector types
            .forEach((feature: number, i: number) => feature.should.equal(i * blockSize))
    });

    it("produces valid vector shape for known extractor (Vamp Plugin Test input-summary)", () => {
        let features = collect(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "input-summary",
            new Map([["produce_output", 0]])
        );
        features.shape.should.equal("vector");
        features.data.length.should.equal(0);
        features = collect(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "input-summary",
            new Map([["produce_output", 1]])
        );
        features.data.length.should.be.greaterThan(0);
    });

    it("can accept custom block and step sizes", () => {
        const blockSize = 8;
        const stepSize = 4;
        const sampleRate = 16;
        const features = collect(
            createStreamFactory(1, 10 * blockSize),
            {
                channelCount: 1,
                sampleRate: sampleRate
            },
            extractorFactory,
            extractorKey,
            "input-summary",
            undefined, // TODO consider revising the function signature for these optional arguments - seems awkward and not very idiomatic JS, I've been too directly influenced from the Python code here
            {blockSize: blockSize, stepSize: stepSize}
        );
        features.data[0].should.equal(blockSize + 1); // because the first sample in the first block is 1
        features.shape.should.equal("vector");
        (features as FixedSpacedFeatures).stepDuration.should.equal(stepSize / sampleRate);
    });

    it("produces valid matrix shape for known extractor (Vamp Plugin Test grid-oss)", () => {
        const features = collect(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "grid-oss"
        );
        features.shape.should.equal("matrix");
        features.data.length.should.equal(10);
        Math.abs((features as FixedSpacedFeatures).stepDuration - (blockSize) / sampleRate)
            .should.be.approximately(0.0, delta);
        (features.data as Float32Array[]).forEach((featureBin: Float32Array, i: number) => {
            featureBin.filter((value, j) => value - (j + i + 2.0) / 30.0 < delta ).length.should.equal(10);
        });
    });

    it("produces valid list shape for variable sample rate extractor (Vamp Plugin Test curve-vsr)", () => {
        const features = collect(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "curve-vsr"
        );
        (features.data as Float32Array).forEach((feature: Feature, i: number) => {
            feature.timestamp.should.eql(makeTimestamp(i * 0.75));
            (Math.abs(feature.featureValues[0] - i * 0.1) < delta).should.be.true
        });
    });

    it("throws an exception when an invalid output identifier is requested", () => {
        chai.expect(() => collect(
            createStreamFactory(1, 10 * blockSize),
            streamFormat,
            extractorFactory,
            extractorKey,
            "non-existent-output"
            )
        ).to.throw(Error, "Invalid output identifier.");
    });
});

