/**
 * Created by lucas on 26/08/2016.
 */
/// <reference path="../typings/globals/mocha/index.d.ts" />
/// <reference path="../typings/modules/chai/index.d.ts" />

import {ZeroCrossings} from "../src/ZeroCrossings";
import {should} from 'chai';
should();

describe('ZeroCrossings', () => {
    describe('.process()', () => {
        it('Should return a count of zero for a buffer of zeros', () => {
            let zc = new ZeroCrossings();
            let block = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]);
            let features = zc.process(block);
            features[0].values[0].should.equal(0);
        });

        it('Should return a count of 5 for small ', () => {
            let zc = new ZeroCrossings();
            let block = new Float32Array([0, 1, -1, 0, 1, -1, 0, 1]);
            let features = zc.process(block);
            features[0].values[0].should.equal(5);
        });
    })
});