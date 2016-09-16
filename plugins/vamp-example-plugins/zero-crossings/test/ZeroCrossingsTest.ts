/**
 * Created by lucas on 26/08/2016.
 */

import {ZeroCrossings} from "../src/ZeroCrossings";
import {Feature, FeatureSet} from "../../../../src/Feature"
import chai = require('chai');
import {Timestamp, frame2timestamp} from "../../../../src/Timestamp";
import {ProcessBlock} from "../../../../src/PluginServer";
chai.should();

describe('ZeroCrossings', () => {
    const toProcessBlock = (buffer: Float32Array) => {
        return {
            timestamp: {s: 0, n: 0} as Timestamp,
            inputBuffers: [{values: buffer}]
        } as ProcessBlock;
    };

    describe('.process()', () => {
        it('Should return a count of zero for a buffer of zeros, and have no crossing points', () => {
            let zc = new ZeroCrossings(16);
            let block = toProcessBlock(new Float32Array(8));
            let features: FeatureSet = zc.process(block);
            features.get(0).should.deep.equal([{values: new Float32Array([0])}]);
            features.size.should.equal(1);
        });

        it('Should return a count of 5 for an input which crosses 5 times, with the locations of the crossings', () => {
            let zc = new ZeroCrossings(16);
            let block = toProcessBlock(new Float32Array([0, 1, -1, 0, 1, -1, 0, 1]));
            let features: FeatureSet = zc.process(block);
            features.get(0).should.deep.equal([{values: new Float32Array([5])}]);
            [1,2,4,5,7].forEach((frame, index) => frame2timestamp(frame, 16).should.eql(features.get(1)[index].timestamp));
        });

        it('Should keep the last sample from the previous block and thus cross once', () => {
            let zc = new ZeroCrossings(16);
            let block = toProcessBlock(new Float32Array([1, 1, 1, 1, 1, 1, 1, 1]));
            zc.process(block);
            block.inputBuffers[0].values.fill(0);
            let features: FeatureSet = zc.process(block);
            features.get(0).should.deep.equal([{values: new Float32Array([1])}]);
            features.get(1).length.should.equal(1);
        });
    })
});
