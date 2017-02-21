/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {PiperVampService} from "../src/PiperVampService";
import VampTestPlugin from '../ext/VampTestPluginModule';
import {AdapterFlags} from "../src/FeatureExtractor";
import {LoadResponse, LoadRequest} from "../src/Piper";

chai.should();
chai.use(chaiAsPromised);

describe('VampTestPlugin', () => {
    const client = new PiperVampService(VampTestPlugin());

    const loadResponse: Promise<LoadResponse> =
        client.list({}).then((resp) => {
            return client.load({
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


