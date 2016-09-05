/**
 * Created by lucas on 02/09/2016.
 */
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
chai.should();
chai.use(chaiAsPromised);
import {Feature} from '../src/Feature';
import {ZeroCrossings} from "../src/ZeroCrossings";
import {ProcessBlock} from '../src/PluginServer';
import {batchProcess} from '../src/AudioUtilities'
import {FeatureExtractor} from "../src/FeatureExtractor";

describe('BatchBlockProcess', () => {
    it('should aggregate features extracted from multiple blocks', () => {
        const expectedFeatures: Feature[][] = [];
        expectedFeatures.push([{values: [5]} as Feature]);
        expectedFeatures.push([{values: [6]} as Feature]);

        const blocks: ProcessBlock[] = [];

        blocks.push({
            timestamp: {s: 0, n: 0},
            inputBuffers: [{values: new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])}]
        });

        blocks.push({
            timestamp: {s: 0, n: 500000000},
            inputBuffers: [{values: new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])}]
        });

        const zc: FeatureExtractor = new ZeroCrossings();
        const features: Promise<Feature[][]> = batchProcess(blocks, (block) => zc.process(block));
        return features.should.eventually.deep.equal(expectedFeatures);
    });
});