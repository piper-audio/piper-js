/**
 * Created by lucast on 30/08/2016.
 */

import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import {FeatsModuleClient} from "../src/FeatsModuleClient";
import {
    StaticData, LoadRequest, AdapterFlags, LoadResponse, ConfigurationRequest,
    Configuration, ConfigurationResponse, ProcessRequest, ProcessBlock, SampleType
} from "../src/ClientServer";
import {FeatureSet, FeatureList} from "../src/Feature";
import {Timestamp} from "../src/Timestamp";
import {batchProcess} from "../src/AudioUtilities";
import VampExamplePlugins = require("../ext/VampExamplePlugins");
import {EmscriptenModuleRequestHandler} from "../src/EmscriptenModuleRequestHandler";
chai.should();
chai.use(chaiAsPromised);

describe("FeatsModuleClient", () => {
    const server = new FeatsModuleClient(new EmscriptenModuleRequestHandler(VampExamplePlugins()));

    it("Can list available plugins in the module", () => {
        const expectedList: StaticData[] = require("./fixtures/expected-plugin-list.json") as StaticData[];
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

    it("Can load an available plugin", () => {
        const expectedResponse = require("./fixtures/expected-load-response.json");
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

    it("Can configure a loaded plugin", () => {
        let expectedResponse = require("./fixtures/expected-configuration-response.json");
        expectedResponse.outputList.forEach((output: any) => output.sampleType = SampleType[output.sampleType]);
        return configResponse.should.eventually.deep.equal(expectedResponse);
    });

    it("Reports an error when trying to configure an already configured plugin", () => {
        const batchConfig = Promise.all([loadResponse.then(config), loadResponse.then(config)]);
        return batchConfig.should.be.rejected;
    });

    it("Can process a single block", () => {
        const expectedFeatures: {one: FeatureSet, two: FeatureSet, merged: FeatureSet} = require("./fixtures/expected-feature-sets");
        const expectedTimestamps = (expectedFeatures.one.get("zerocrossings") as FeatureList).map(feature => feature.timestamp);

        const features: Promise<FeatureSet> = server.process({
            pluginHandle: pluginHandles[0],
            processInput: {
                timestamp: {s: 0, n: 0} as Timestamp,
                inputBuffers: [{values: new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])}]
            } as ProcessBlock
        } as ProcessRequest);

        return features.then((features: FeatureSet) => {
            const timestamps = features.get("zerocrossings").map(feature => feature.timestamp);
            timestamps.should.deep.equal(expectedTimestamps);
            features.get("counts").should.deep.equal(expectedFeatures.one.get("counts"));
        });
    });

    it("Can get the remaining features and clean up the plugin", () => {
        const remainingFeatures: Promise<FeatureSet> = server.finish(pluginHandles[0]);
        return remainingFeatures.then(features => features.size.should.eql(0));
    });

    it("Can process multiple blocks of audio, consecutively", () => {
        const expectedFeatures: {one: FeatureSet, two: FeatureSet, merged: FeatureSet} = require("./fixtures/expected-feature-sets");
        const blocks: ProcessBlock[] = [];

        blocks.push({
            timestamp: {s: 0, n: 0} as Timestamp,
            inputBuffers: [{values: new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])}]
        } as ProcessBlock);

        blocks.push({
            timestamp: {s: 0, n: 500000000} as Timestamp,
            inputBuffers: [{values: new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])}]
        } as ProcessBlock);


        const processBlocks: () => Promise<FeatureSet> = () => {
            const zcHandle: number = pluginHandles[pluginHandles.length - 1];
            return batchProcess(blocks, (block) => server.process({pluginHandle: zcHandle, processInput: block}));
        };

        const features: Promise<FeatureSet> = loadZeroCrossings().then(config).then(processBlocks);
        const getTimestamps = (features: FeatureList) => features.map(feature => feature.timestamp);
        return features.then((features) => {
            features.get("counts").should.deep.equal(expectedFeatures.merged.get("counts"));
            getTimestamps(features.get("zerocrossings")).should.deep.equal(getTimestamps(expectedFeatures.merged.get("zerocrossings")));
        });
    });
});
