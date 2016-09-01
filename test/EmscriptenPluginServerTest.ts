/**
 * Created by lucast on 30/08/2016.
 */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {EmscriptenPluginServer} from "../src/EmscriptenPluginServer";
import {
    Response, StaticData, LoadRequest, AdapterFlags, LoadResponse, ConfigurationRequest,
    Configuration, ConfigurationResponse
} from "../src/PluginServer";
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

    const config = (): Promise<ConfigurationResponse> => {
        return loadResponse.then((response) => {
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

    it('Can configure a loaded plugin', () => {
        const expectedResponse = require('./fixtures/expected-configuration-response.json');
        return config().should.eventually.deep.equal(expectedResponse);
    });

    it('Reports an error when trying to configure an already configured plugin', () => {
        const batchConfig = Promise.all([config(), config()]);
        return batchConfig.should.be.rejected;
    })
});