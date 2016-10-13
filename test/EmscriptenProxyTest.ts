/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */
/**
 * Created by lucast on 30/08/2016.
 */

import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import {FeatureSet, FeatureList} from "../src/Feature";
import {Timestamp} from "../src/Timestamp";
import {batchProcess} from "../src/AudioUtilities";
import VampExamplePlugins = require("../ext/VampExamplePlugins");
import {EmscriptenProxy} from "../src/EmscriptenProxy";
import fs = require("fs");
import {SampleType, ProcessInput, StaticData, AdapterFlags, InputDomain} from "../src/FeatureExtractor";
import {LoadResponse, LoadRequest, ConfigurationResponse, Service} from "../src/Piper";
import {PiperClient} from "../src/PiperClient";

chai.should();
chai.use(chaiAsPromised);

describe("EmscriptenProxyTest", () => {
    const client: Service = new PiperClient(new EmscriptenProxy(VampExamplePlugins()));

    const loadFixture = (name : string) => {
	// avoid sharing things through use of require
	return JSON.parse( 
	    fs.readFileSync(
		__dirname + "/fixtures/" + name + ".json",
		"utf8"));
    };

    it("Can list available plugins in the module", () => {
        const expectedList: StaticData[] = loadFixture("expected-plugin-list").available
            .map((data: any) => Object.assign({}, data as any, {inputDomain: InputDomain[data.inputDomain]}));
        return client.list({}).then(available => available.available.should.eql(expectedList));
    });

    const loadZeroCrossings = (): Promise<LoadResponse> => {
        return client.list({}).then((resp) => {
            return client.load({
                key: resp.available[resp.available.length - 1].key, // zero crossings
                inputSampleRate: 16,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            } as LoadRequest);
        });
    };

    const loadResponse: Promise<LoadResponse> = loadZeroCrossings();

    it("Can load an available plugin", () => {
        const expectedResponse = loadFixture("expected-load-response");
        expectedResponse.staticData.inputDomain = InputDomain[expectedResponse.staticData.inputDomain];
        return loadResponse.should.eventually.deep.equal(expectedResponse);
    });

    const handles: number[] = [];
    const config = (response: LoadResponse): Promise<ConfigurationResponse> => {
        handles.push(response.handle);
        return client.configure({
            handle: response.handle,
            configuration: {
                blockSize: 8,
                channelCount: 1,
                stepSize: 8
            }
        });
    };

    it("Can configure a loaded plugin", () => {
    const configResponse: Promise<ConfigurationResponse> = loadResponse.then(config);
	let expectedResponse = loadFixture("expected-configuration-response");
        expectedResponse.outputList.forEach((output: any) => output.configured.sampleType = SampleType[output.configured.sampleType]);
        return configResponse.should.eventually.deep.equal(expectedResponse);
    });

    it("Reports an error when trying to configure an already configured plugin", () => {
        const batchConfig = Promise.all([loadResponse.then(config), loadResponse.then(config)]);
        return batchConfig.should.be.rejected;
    });

    it("Can process a single block", () => { // TODO depends on previous tests, fix
        const expectedFeatures: {one: FeatureSet, two: FeatureSet, merged: FeatureSet} = require("./fixtures/expected-feature-sets"); // a js file, not a json one
        const expectedTimestamps = (expectedFeatures.one.get("zerocrossings") as FeatureList).map(feature => feature.timestamp);

        const features: Promise<FeatureSet> = client.process({
            handle: handles[0],
            processInput: {
                timestamp: {s: 0, n: 0} as Timestamp,
                inputBuffers: [new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])]
            }
        }).then(response => response.features);

        return features.then((features: FeatureSet) => {
            const timestamps = features.get("zerocrossings").map(feature => feature.timestamp);
            timestamps.should.deep.equal(expectedTimestamps);
            features.get("counts").should.deep.equal(expectedFeatures.one.get("counts"));
        });
    });

    it("Can get the remaining features and clean up the plugin", () => { // TODO depends on previous tests, fix
        const remainingFeatures: Promise<FeatureSet> = client.finish({handle: handles[0]}).then(response => response.features);
        return remainingFeatures.then(features => features.size.should.eql(0));
    });

    it("Can process multiple blocks of audio, consecutively", () => {
        const expectedFeatures: {one: FeatureSet, two: FeatureSet, merged: FeatureSet} = require("./fixtures/expected-feature-sets"); // a js file, not a json one
        const blocks: ProcessInput[] = [];

        blocks.push({
            timestamp: {s: 0, n: 0} as Timestamp,
            inputBuffers: [new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])]
        } as ProcessInput);

        blocks.push({
            timestamp: {s: 0, n: 500000000} as Timestamp,
            inputBuffers: [new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])]
        } as ProcessInput);


        const processBlocks: () => Promise<FeatureSet> = () => {
            const zcHandle: number = handles[handles.length - 1];
            return batchProcess(
                blocks,
                block => client.process({handle: zcHandle, processInput: block}).then(response => response.features),
                () => client.finish({handle: zcHandle}).then(response => response.features));
        };

        const features: Promise<FeatureSet> = loadZeroCrossings().then(config).then(processBlocks);
        const getTimestamps = (features: FeatureList) => features.map(feature => feature.timestamp);
        return features.then((features) => {
            features.get("counts").should.deep.equal(expectedFeatures.merged.get("counts"));
            getTimestamps(features.get("zerocrossings")).should.deep.equal(getTimestamps(expectedFeatures.merged.get("zerocrossings")));
        });
    });
});
