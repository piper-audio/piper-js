/**
 * Created by lucast on 30/08/2016.
 */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {EmscriptenPluginServer} from "../src/EmscriptenPluginServer";
import {
    Response, StaticData, LoadRequest, AdapterFlags, LoadResponse, ConfigurationRequest,
    Configuration, ConfigurationResponse, ProcessRequest, ProcessBlock, SampleType, OutputDescriptor
} from "../src/PluginServer";
import {Feature, FeatureSet, AggregateFeatureSet, FeatureList} from "../src/Feature";
import {Timestamp} from "../src/Timestamp";
import {batchProcess} from "../src/AudioUtilities";
chai.should();
chai.use(chaiAsPromised);

describe('EmscriptenPluginServer', () => {
    const server = new EmscriptenPluginServer();

    it('Can list available plugins in the module', () => {
        const expectedList: StaticData[] = require('./fixtures/expected-plugin-list.json') as StaticData[];
        return server.listPlugins().should.eventually.deep.equal(expectedList);
    });

    const loadZeroCrossings = (): Promise<LoadResponse> => {
        return server.listPlugins().then((plugins) => {
            return server.loadPlugin({
                pluginKey: plugins[plugins.length - 1].pluginKey, // zero crossings
                inputSampleRate: 16,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            } as LoadRequest);
        });
    };

    const loadResponse: Promise<LoadResponse> = loadZeroCrossings();

    it('Can load an available plugin', () => {
        const expectedResponse = require('./fixtures/expected-load-response.json');
        return loadResponse.should.eventually.deep.equal(expectedResponse);
    });

    const pluginHandles: number[] = [];
    const config = (response: LoadResponse): Promise<ConfigurationResponse> => {
        pluginHandles.push(response.pluginHandle);
        return server.configurePlugin({
            pluginHandle: response.pluginHandle,
            configuration: {
                blockSize: 8,
                channelCount: 1,
                stepSize: 8
            } as Configuration
        } as ConfigurationRequest);
    };

    const configResponse: Promise<ConfigurationResponse> = loadResponse.then(config);

    it('Can configure a loaded plugin', () => {
        let expectedResponse = require('./fixtures/expected-configuration-response.json');
        expectedResponse.outputList.forEach((output: any) => output.sampleType = SampleType[output.sampleType]);
        return configResponse.should.eventually.deep.equal(expectedResponse);
    });

    it('Reports an error when trying to configure an already configured plugin', () => {
        const batchConfig = Promise.all([loadResponse.then(config), loadResponse.then(config)]);
        return batchConfig.should.be.rejected;
    });

    it('Can process a single block', () => {
        const expectedFeatures: {one: FeatureSet, two: FeatureSet, merged: AggregateFeatureSet} = require('./fixtures/expected-feature-sets');
        const expectedTimestamps = (expectedFeatures.one.get(1) as FeatureList).map(feature => feature.timestamp);

        const features: Promise<Feature[][]> = server.process({
            pluginHandle: pluginHandles[0],
            processInput: {
                timestamp: {s: 0, n: 0} as Timestamp,
                inputBuffers: [{values: new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])}]
            } as ProcessBlock
        } as ProcessRequest);

        return features.then((features: Feature[][]) => {
            const timestamps = features[1].map(feature => feature.timestamp);
            timestamps.should.deep.equal(expectedTimestamps);
            features[0].should.deep.equal(expectedFeatures.one.get(0));
        })
    });

    it('Can get the remaining features and clean up the plugin', () => {
        const remainingFeatures: Promise<Feature[][]> = server.finish(pluginHandles[0]);
        const expectedFeatures: Feature[][] = [];
        return remainingFeatures.should.eventually.deep.equal(expectedFeatures);
    });

    it('Can process multiple blocks of audio, consecutively', () => {
        const expectedFeatures: {one: FeatureSet, two: FeatureSet, merged: AggregateFeatureSet} = require('./fixtures/expected-feature-sets');
        const blocks: ProcessBlock[] = [];

        blocks.push({
            timestamp: {s: 0, n: 0} as Timestamp,
            inputBuffers: [{values: new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])}]
        } as ProcessBlock);

        blocks.push({
            timestamp: {s: 0, n: 500000000} as Timestamp,
            inputBuffers: [{values: new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])}]
        } as ProcessBlock);


        const processBlocks: () => Promise<AggregateFeatureSet> = () => {
            const zcHandle: number = pluginHandles[pluginHandles.length - 1];
            return batchProcess(blocks, (block) => server.process({pluginHandle: zcHandle, processInput: block}));
        };

        const features: Promise<AggregateFeatureSet> = loadZeroCrossings().then(config).then(processBlocks);
        const getTimestamps = (features: FeatureList[]) => features.map(list => list.map(feature => feature.timestamp));
        return features.then((aggregateFeatures) => {
            aggregateFeatures.get(0).should.deep.equal(expectedFeatures.merged.get(0));
            getTimestamps(aggregateFeatures.get(1)).should.deep.equal(getTimestamps(expectedFeatures.merged.get(1)));
        });
    });
});