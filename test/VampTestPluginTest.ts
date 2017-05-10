/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {PiperVampService} from "../src/PiperVampService";
import VampTestPlugin from '../ext/VampTestPluginModule';
import {AdapterFlags} from "../src/FeatureExtractor";
import {LoadResponse, LoadRequest} from "../src/Piper";

//!!! todo review which of these are actually necessary
import {
    processConfiguredExtractor,
    segment,
    process,
    collect,
    AudioStreamFormat,
    AudioData,
    CreateFeatureExtractorFunction,
    CreateAudioStreamFunction, PiperSimpleClient, FeatureCollection,
    SimpleRequest,
    VectorFeatures, MatrixFeatures, TrackFeatures
} from "../src/HigherLevelUtilities";

var expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);

describe('VampTestPlugin', () => {

    const rate = 44100;
    const blockSize = 1024;
    const eps = 1e-6;

    const key = "vamp-test-plugin:vamp-test-plugin";
    const keyFreq = "vamp-test-plugin:vamp-test-plugin-freq";

    const inputData = ((n : number) => {
        const buf = new Float32Array(n);
        // start at 1, not 0 so that all elts are non-zero
        for (let i = 0; i < n; ++i) buf[i] = i + 1;
        return buf;
    });
    
    const service = new PiperVampService(VampTestPlugin());

    const loadResponse: Promise<LoadResponse> =
        service.list({}).then((resp) => {
            return service.load({
                key: resp.available[0].key, // time-domain
                inputSampleRate: 44100,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            } as LoadRequest);
        });

    it("can load test plugin using service", () => {
        loadResponse.then(resp => {
            expect(resp.handle).to.be.a('number');
        })
    });

    const client = new PiperSimpleClient(service);

    const makeRequest = ((n: number, output: string) => {
        const buf = inputData(n);
        const request : SimpleRequest = {
            audioData: [buf],
            audioFormat: {
                channelCount: 1,
                sampleRate: rate
            },
            key: key,
            outputId: output,
            blockSize,
            stepSize: blockSize
        };
        return request;
    });
    
    it("can collect output using simple client", () => {
        const request = makeRequest(blockSize * 10, "input-timestamp");
        client.collect(request).then(response => {
            expect(response.features).to.exist;
        });
    });

});


