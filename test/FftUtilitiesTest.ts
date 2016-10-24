/**
 * Created by lucast on 21/10/2016.
 */
import * as chai from "chai";
import {
    cyclicShiftInPlace, applyHannWindowTo,
    memoise, hann
} from "../src/FftUtilities";
chai.should();

describe("Cyclic shift", () => {
    it("Shifts the zero-frequency component to the center of the buffer", () => {
        const buffer: Float32Array = new Float32Array([
            0, 1, 2, 3, 4, -5, -4, -3, -2, -1
        ]);
        cyclicShiftInPlace(buffer).should.eql(new Float32Array([
            -5, -4, -3, -2, -1, 0, 1, 2, 3, 4
        ]));
    });

    it("Can shift odd number of elements", () => {
        const three: Float32Array = new Float32Array([1,2,3]);
        cyclicShiftInPlace(three).should.eql(new Float32Array([3,1,2]));
        const five: Float32Array = new Float32Array([1,2,3,4,5]);
        cyclicShiftInPlace(five).should.eql(new Float32Array([4,5,1,2,3]));
    });
});

describe("Hann Windowing", () => {
    it("weights the input by a periodic taper, in the form of a hann weighted cosine", () => {
        const input: Float32Array = new Float32Array([1, 1, 1, 1]);
        applyHannWindowTo(input).should.eql(new Float32Array([0.0, 0.5, 1.0, 0.5]));
    });
});

describe("Memoise", () => {
    it("Returns a memoised function, given a pure function, which caches results for a given set of arguments", () => {
        const cachedHann: Function = memoise(hann);
        cachedHann(4).should.not.equal(hann(4)); // not the same reference
        cachedHann(4).should.equal(cachedHann(4)); // the same reference
    });
});