/**
 * Created by lucast on 20/10/2016.
 */
import * as chai from "chai";
import {
    ProcessInputBuffersAdjuster,
    ProcessInputAdjuster
} from "../src/ProcessInputAdjuster";
import {Configuration} from "../src/FeatureExtractor";
import {makeTimestamp} from "../src/Timestamp";
chai.should();

describe("ProcessInputBuffersAdjuster", () => {
    const sampleRate: number = 16;
    const config: Configuration = {
        channelCount: 2,
        blockSize: 4,
        stepSize: 2
    };

    describe("returns a new, shifted, ProcessInput", () => {
        // Stereo audio with increasing integers every blockSize,
        // L starts at 1, R at 5
        // [
        //     1, 1, 1, 1,
        //     2, 2, 2, 2,
        //     3, 3, 3, 3,
        //     4, 4, 4, 4
        // ],
        // [
        //     5, 5, 5, 5,
        //     6, 6, 6, 6,
        //     7, 7, 7, 7,
        //     8, 8, 8, 8
        // ];

        it("zero pads the first block passed in, shifting half the block back", () => {
            new ProcessInputBuffersAdjuster(config).adjust({
                timestamp: {s: 0, n: 0},
                inputBuffers: [
                    new Float32Array([1, 1, 1, 1]),
                    new Float32Array([5, 5, 5, 5])
                ]
            }).should.eql({
                timestamp: {s: 0, n: 0},
                inputBuffers: [
                    new Float32Array([0, 0, 1, 1]),
                    new Float32Array([0, 0, 5, 5])
                ]
            });
        });

        it("Shifts remaining buffers back by half", () => {
            const adjuster: ProcessInputAdjuster = new ProcessInputBuffersAdjuster(config);
            const stepSizeSeconds: number = config.stepSize / sampleRate;
            // write all blocks out manually
            adjuster.adjust({
                timestamp: {s: 0, n: 0},
                inputBuffers: [
                    new Float32Array([1, 1, 1, 1]),
                    new Float32Array([5, 5, 5, 5])
                ]
            }).inputBuffers.should.eql([
                new Float32Array([0, 0, 1, 1]),
                new Float32Array([0, 0, 5, 5])
            ]);

            adjuster.adjust({
                timestamp: makeTimestamp(stepSizeSeconds),
                inputBuffers: [
                    new Float32Array([1, 1, 2, 2]),
                    new Float32Array([5, 5, 6, 6])
                ]
            }).inputBuffers.should.eql([
                new Float32Array([1, 1, 1, 1]),
                new Float32Array([5, 5, 5, 5])
            ]);

            adjuster.adjust({
                timestamp: makeTimestamp(2.0 * stepSizeSeconds),
                inputBuffers: [
                    new Float32Array([2, 2, 2, 2]),
                    new Float32Array([6, 6, 6, 6])
                ]
            }).inputBuffers.should.eql([
                new Float32Array([1, 1, 2, 2]),
                new Float32Array([5, 5, 6, 6])
            ]);

            adjuster.adjust({
                timestamp: makeTimestamp(3.0 * stepSizeSeconds),
                inputBuffers: [
                    new Float32Array([2, 2, 3, 3]),
                    new Float32Array([6, 6, 7, 7])
                ]
            }).inputBuffers.should.eql([
                new Float32Array([2, 2, 2, 2]),
                new Float32Array([6, 6, 6, 6])
            ]);

            adjuster.adjust({
                timestamp: makeTimestamp(4.0 * stepSizeSeconds),
                inputBuffers: [
                    new Float32Array([3, 3, 3, 3]),
                    new Float32Array([7, 7, 7, 7])
                ]
            }).inputBuffers.should.eql([
                new Float32Array([2, 2, 3, 3]),
                new Float32Array([6, 6, 7, 7])
            ]);

            adjuster.adjust({
                timestamp: makeTimestamp(5.0 * stepSizeSeconds),
                inputBuffers: [
                    new Float32Array([3, 3, 4, 4]),
                    new Float32Array([7, 7, 8, 8])
                ]
            }).inputBuffers.should.eql([
                new Float32Array([3, 3, 3, 3]),
                new Float32Array([7, 7, 7, 7])
            ]);

            adjuster.adjust({
                timestamp: makeTimestamp(6.0 * stepSizeSeconds),
                inputBuffers: [
                    new Float32Array([4, 4, 4, 4]),
                    new Float32Array([8, 8, 8, 8])
                ]
            }).inputBuffers.should.eql([
                new Float32Array([3, 3, 4, 4]),
                new Float32Array([7, 7, 8, 8])
            ]);

            adjuster.adjust({
                timestamp: makeTimestamp(7.0 * stepSizeSeconds),
                inputBuffers: [
                    new Float32Array([4, 4, 0, 0]),
                    new Float32Array([8, 8, 0, 0])
                ]
            }).inputBuffers.should.eql([
                new Float32Array([4, 4, 4, 4]),
                new Float32Array([8, 8, 8, 8])
            ]);
        });
    });
});