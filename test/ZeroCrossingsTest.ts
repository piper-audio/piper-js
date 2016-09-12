/**
 * Created by lucas on 26/08/2016.
 */
/// <reference path="../typings/globals/mocha/index.d.ts" />
/// <reference path="../typings/modules/chai/index.d.ts" />

import {ZeroCrossings} from "../src/ZeroCrossings";
import {Feature, FeatureSet} from "../src/Feature"
import chai = require('chai');
import {Timestamp} from "../src/Timestamp";
import {ProcessBlock} from "../src/PluginServer";
chai.should();

describe('ZeroCrossings', () => {
    const toProcessBlock = (buffer: Float32Array) => {
        return {
            timestamp: {s: 0, n: 0} as Timestamp,
            inputBuffers: [{values: buffer}]
        } as ProcessBlock;
    };

    describe('.process()', () => {
        it('Should return a count of zero for a buffer of zeros', () => {
            let zc = new ZeroCrossings();
            let block = toProcessBlock(new Float32Array(8));
            let features: FeatureSet = zc.process(block);
            features.get(0).should.deep.equal([{values: new Float32Array([0])}]);
        });

        it('Should return a count of 5 for an input which crosses 5 times', () => {
            let zc = new ZeroCrossings();
            let block = toProcessBlock(new Float32Array([0, 1, -1, 0, 1, -1, 0, 1]));
            let features: FeatureSet = zc.process(block);
            features.get(0).should.deep.equal([{values: new Float32Array([5])}]);
        });

        it('Should keep the last sample from the previous block', () => {
            let zc = new ZeroCrossings();
            let block = toProcessBlock(new Float32Array([1, 1, 1, 1, 1, 1, 1, 1]));
            zc.process(block);
            block.inputBuffers[0].values.fill(0);
            let features: FeatureSet = zc.process(block);
            return features.get(0).should.deep.equal([{values: new Float32Array([1])}]);
        });
    })
});
