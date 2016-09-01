/**
 * Created by lucast on 30/08/2016.
 */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {EmscriptenPluginServer} from "../src/EmscriptenPluginServer";
import {Response, StaticData, LoadRequest, AdapterFlags, LoadResponse} from "../src/PluginServer";
chai.should();
chai.use(chaiAsPromised);

describe('EmscriptenPluginServer', () => {
    const server = new EmscriptenPluginServer();

    it('Can list available plugins in the module', () => {
        const expectedList: StaticData[] = require('./fixtures/expected-plugin-list.json') as StaticData[];
        return server.listPlugins().should.eventually.deep.equal(expectedList);
    });

    it('Can load an available plugin', () => {
        const expectedResponse = require('./fixtures/expected-load-response.json');
        const loadResponse: Promise<LoadResponse> = server.listPlugins().then((plugins) => {
            const loadRequest: LoadRequest = {
                pluginKey: plugins.pop().pluginKey,
                inputSampleRate: 16,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            } as LoadRequest;
            return server.loadPlugin(loadRequest);
        });
        return loadResponse.should.eventually.deep.equal(expectedResponse);
    });
});