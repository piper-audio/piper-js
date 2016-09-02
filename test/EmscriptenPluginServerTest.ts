/**
 * Created by lucast on 30/08/2016.
 */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {EmscriptenPluginServer} from "../src/EmscriptenPluginServer";
import {
    Response, StaticData, LoadRequest, AdapterFlags, LoadResponse, ConfigurationRequest,
    Configuration, ConfigurationResponse, ProcessRequest, ProcessBlock
} from "../src/PluginServer";
import {Feature} from "../src/Feature";
import {Timestamp} from "../src/Timestamp";
chai.should();
chai.use(chaiAsPromised);

describe('EmscriptenPluginServer', () => {
    const server = new EmscriptenPluginServer();

    it('Can list available plugins in the module', () => {
        const expectedList: StaticData[] = require('./fixtures/expected-plugin-list.json') as StaticData[];
        return server.listPlugins().should.eventually.deep.equal(expectedList);
    });

    const loadResponse: Promise<LoadResponse> = server.listPlugins().then((plugins) => {
        const loadRequest: LoadRequest = {
            pluginKey: plugins.pop().pluginKey,
            inputSampleRate: 16,
            adapterFlags: [AdapterFlags.AdaptAllSafe]
        } as LoadRequest;
        return server.loadPlugin(loadRequest);
    });

    it('Can load an available plugin', () => {
        const expectedResponse = require('./fixtures/expected-load-response.json');
        return loadResponse.should.eventually.deep.equal(expectedResponse);
    });

    const pluginHandles: number[] = [];
    const config = (): Promise<ConfigurationResponse> => {
        return loadResponse.then((response) => {
            pluginHandles.push(response.pluginHandle);
            const configRequest: ConfigurationRequest = {
                pluginHandle: response.pluginHandle,
                configuration: {
                    blockSize: 8,
                    channelCount: 1,
                    stepSize: 8
                } as Configuration
            } as ConfigurationRequest;
            return server.configurePlugin(configRequest);
        });
    };

    const configResponse: Promise<ConfigurationResponse> = config();

    it('Can configure a loaded plugin', () => {
        const expectedResponse = require('./fixtures/expected-configuration-response.json');
        return configResponse.should.eventually.deep.equal(expectedResponse);
    });

    it('Reports an error when trying to configure an already configured plugin', () => {
        const batchConfig = Promise.all([config(), config()]);
        return batchConfig.should.be.rejected;
    });

    it('Can process a single block', () => {
        const expectedFeatures: {one: any, two: any} = require('./fixtures/expected-feature-sets');
        const features: Promise<Feature[][]> = server.process({
            pluginHandle: pluginHandles[0],
            processInput: {
                timestamp: {s: 0, n: 0} as Timestamp,
                inputBuffers: [{values: [new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])]}]
            } as ProcessBlock
        } as ProcessRequest);
        return features.should.eventually.deep.equal(expectedFeatures.one);
    });


    it('Can process multiple blocks of audio, consecutively', () => {
        const expectedFeatures: {one: any, two: any} = require('./fixtures/expected-feature-sets');
        const blocks: ProcessBlock[] = [];

        blocks.push({
            timestamp: {s: 0, n: 0} as Timestamp,
            inputBuffers: [{values: [new Float32Array([0,1,-1,0,1,-1,0,1])]}]
        } as ProcessBlock);

        blocks.push({
            timestamp: {s: 0, n: 500000000} as Timestamp,
            inputBuffers: [{values: [new Float32Array([0,1,-1,0,1,-1,0,1])]}]
        } as ProcessBlock);

        const concatFeatures = (running: Feature[][], nextBlock: Promise<Feature[][]>) => {
            return nextBlock.then((block) => {
                return running.concat(block);
            });
        };

        const features: Promise<Feature[][]> = server.process({
            pluginHandle: pluginHandles[0],
            processInput: blocks[0]
        } as ProcessRequest)
        .then((prevBlockFeatures) => {
            return concatFeatures(prevBlockFeatures, server.process({
                pluginHandle: pluginHandles[0],
                processInput: blocks[1]
            } as ProcessRequest));
        });
        return features.should.eventually.deep.equal(expectedFeatures.one.concat(expectedFeatures.two));
    });

    it('Can get the remaining features and clean up the plugin', () => {
        const remainingFeatures: Promise<Feature[][]> = server.finish(pluginHandles[0]);
        const expectedFeatures: Feature[][] = [];
        return remainingFeatures.should.eventually.deep.equal(expectedFeatures);
    });
});