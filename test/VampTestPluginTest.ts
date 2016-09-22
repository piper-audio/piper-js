/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');

import {EmscriptenPluginServer} from "../src/EmscriptenPluginServer";
import {
    StaticData, LoadRequest, AdapterFlags, LoadResponse, ConfigurationRequest,
    Configuration, ConfigurationResponse, ProcessRequest, ProcessBlock, SampleType
} from "../src/PluginServer";

import {FeatureSet, FeatureList} from "../src/Feature";
import {Timestamp} from "../src/Timestamp";
import {batchProcess} from "../src/AudioUtilities";

import VampTestPlugin = require('../ext/VampTestPlugin');

chai.should();
chai.use(chaiAsPromised);

describe('VampTestPlugin', () => {
    const server = new EmscriptenPluginServer(VampTestPlugin());

    const loadResponse: Promise<LoadResponse> =
	server.listPlugins().then((plugins) => {
            return server.loadPlugin({
                pluginKey: plugins[0].pluginKey, // time-domain
                inputSampleRate: 44100,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            } as LoadRequest);
        });

    it('Can load test plugin', () => {
        // yuk
        loadResponse.then(resp => {
            resp.pluginHandle.should.equal(1);
        })
    });
    
});


