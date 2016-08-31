/**
 * Created by lucast on 30/08/2016.
 */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {EmscriptenPluginServer} from "../src/EmscriptenPluginServer";
import {Response, StaticData} from "../src/PluginServer";
chai.should();
chai.use(chaiAsPromised);

describe('EmscriptenPluginServer', () => {
    const server = new EmscriptenPluginServer();

    it('Can list available plugins in the module', () => {
        const expectedList: StaticData[] = <StaticData[]>require('./fixtures/expected-plugin-list.json');
        return server.listPlugins().should.eventually.deep.equal(expectedList);
    });
});