/**
 * Created by lucas on 07/11/2016.
 */
import * as chai from "chai";
import {
    OneShotExtractionClient,
    FeatureCollection,
    OneShotExtractionRequest
} from "../src/one-shot";
import {fromFrames} from "../src/time"
import {FeatureList} from "../src/core";
import {KissRealFft} from "../src/fft";
import {
    FeatureExtractorService,
} from "../src/core";
import {
    FrequencyDomainExtractorStub,
    FrequencyMetaDataStub
} from "./fixtures/FrequencyDomainExtractorStub";
import {
    FeatureExtractorStub,
    MetaDataStub
} from "./fixtures/FeatureExtractorStub";
import {Feature} from '../src/core';
import {
    AudioData,
    segment
} from '../src/audio';
import {RealFftFactory} from '../src/fft';
import {KissFft} from '../src/fft/KissFftModule';
chai.should();

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

describe("OneShotExtractionClient", () => {
    const fftInitCallback: RealFftFactory = (size: number) => new KissRealFft(
        size,
        KissFft
    );
    const service = new FeatureExtractorService(
        fftInitCallback,
        {create: sr => new FrequencyDomainExtractorStub(), metadata: FrequencyMetaDataStub},
        {create: sr => new FeatureExtractorStub(), metadata: MetaDataStub}
    );
    const client = new OneShotExtractionClient(service);
    const sampleRate: number = 16;
    const blockSize: number = 4;
    const stepSize: number = 2;
    const frameRate: number = 1 / (stepSize / sampleRate);
    const audioData: Float32Array[] = [
        new Float32Array([
            -1, -1, -1, -1,
            0,  0,  0,  0,
            1,  1,  1,  1,
        ])
    ];
    const request: OneShotExtractionRequest  = {
        audioData: audioData,
        audioFormat: {
            channelCount: 1,
            sampleRate: sampleRate
        },
        key: "stub:sum",
        outputId: "sum",
        blockSize: blockSize,
        stepSize: stepSize
    };

    it("Can process an entire AudioStream, for a single output", () => {
        const toFeature = (frame: number, frameRate: number, values: number[]): Feature => {
            return {
                timestamp: fromFrames(frame, frameRate),
                featureValues: new Float32Array(values)
            };
        };

        return client.process(request).then(res => {
            const expectedFeatures = [
                toFeature(0, frameRate, [-4]),
                toFeature(1, frameRate, [-2]),
                toFeature(2, frameRate, [0]),
                toFeature(3, frameRate, [2]),
                toFeature(4, frameRate, [4]),
                toFeature(5, frameRate, [2]),
                // toFeature(6, frameRate, [0]) // TODO should there be one more buffer?
            ];

	    const collected = res.features.collected as FeatureList;
            collected.length.should.equal(expectedFeatures.length);
            collected.forEach((value, index) => {
                value.should.eql(expectedFeatures[index]);
            });
        });
    });

    it("can collect (reshape), features extracted from an entire AudioStream", () => {
        const expected: FeatureCollection = {
            shape: "vector",
	    collected: {
		startTime: 0,
		stepDuration: stepSize / sampleRate,
		data: new Float32Array([-4, -2, 0, 2, 4, 2])
	    }
        };
        return client.collect(request).then(response => {
            response.features.should.eql(expected);
            response.outputDescriptor.should.eql({
                basic: MetaDataStub.basicOutputInfo[0],
                configured: {
                    binCount: 1,
                    binNames: [],
                    hasDuration: false,
                    sampleRate: 0,
                    sampleType: 0
                },
                static: MetaDataStub.staticOutputInfo.get(
                    MetaDataStub.basicOutputInfo[0].identifier
                )
            })
        });
    });

    it("returns an empty list of features when requested output is empty", () => {
        const expected: FeatureCollection = {
            shape: "vector",
	    collected: {
		startTime: 0,
		stepDuration: stepSize / sampleRate,
		data: new Float32Array([])
	    }
        };
        return client.collect({
            audioData: audioData,
            audioFormat: {
                channelCount: 1,
                sampleRate: sampleRate
            },
            key: "stub:sum",
            outputId: "conditional",
            blockSize: blockSize,
            stepSize: stepSize
        }).then(actual => actual.features.should.eql(expected));
    });

});
