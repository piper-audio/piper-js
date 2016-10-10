/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {FeatsModuleClient} from "FeatureExtractionClient.ts";
import {LoadRequest, LoadResponse} from "Piper.ts";
import {EmscriptenModuleRequestHandler} from "../src/EmscriptenModuleRequestHandler";
import VampTestPlugin = require('../ext/VampTestPlugin');
import {AdapterFlags} from "../src/FeatureExtractor";

chai.should();
chai.use(chaiAsPromised);

describe('VampTestPlugin', () => {
    const server = new FeatsModuleClient(new EmscriptenModuleRequestHandler(VampTestPlugin()));

    const loadResponse: Promise<LoadResponse> =
	server.list({}).then((resp) => {
            return server.load({
                key: resp.available[0].key, // time-domain
                inputSampleRate: 44100,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            } as LoadRequest);
        });

    it('Can load test plugin', () => {
        // yuk
        loadResponse.then(resp => {
            resp.handle.should.equal(1);
        })
    });
    
});


