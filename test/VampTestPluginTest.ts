/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');

import {FeatsModuleClient} from "../src/FeatsModuleClient";

import {
    StaticData, LoadRequest, AdapterFlags, LoadResponse, ConfigurationRequest,
    Configuration, ConfigurationResponse, ProcessRequest, ProcessInput, SampleType
} from "../src/ClientServer";

import {EmscriptenModuleRequestHandler} from "../src/EmscriptenModuleRequestHandler";
import {FeatureSet, FeatureList} from "../src/Feature";
import {Timestamp} from "../src/Timestamp";
import {batchProcess} from "../src/AudioUtilities";

import VampTestPlugin = require('../ext/VampTestPlugin');

chai.should();
chai.use(chaiAsPromised);

describe('VampTestPlugin', () => {
    const server = new FeatsModuleClient(new EmscriptenModuleRequestHandler(VampTestPlugin()));

    const loadResponse: Promise<LoadResponse> =
	server.listPlugins().then((resp) => {
            return server.loadPlugin({
                pluginKey: resp.plugins[0].pluginKey, // time-domain
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


