/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {PiperVampService} from "../src/PiperVampService";
import VampTestPlugin from '../ext/VampTestPluginModule';
import {AdapterFlags} from "../src/FeatureExtractor";
import {LoadResponse, LoadRequest} from "../src/Piper";
import {fromSeconds, fromFrames} from "../src/Timestamp";
import {Feature, FeatureList} from "../src/Feature";

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
    const stepSize = blockSize;
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
            expect(resp.handle).a('number');
        })
    });

    const client = new PiperSimpleClient(service);

    const makeRequest = ((n: number, output: string) => {
        const buf = inputData(n);
        const request : SimpleRequest = {
            audioData: [buf],
            audioFormat: { channelCount: 1, sampleRate: rate },
            key: key,
            outputId: output,
            blockSize,
            stepSize,
        };
        return request;
    });
    
    it("can collect output at all using simple client", () => {
        const request = makeRequest(blockSize * 10, "input-timestamp");
        client.collect(request).then(response => {
            expect(response.features).exist;
        });
    });

    it("properly communicates parameter setting", () => {
        const blocks = 10;
        const request = makeRequest(blockSize * blocks, "input-summary");

        request.parameterValues = new Map([["produce_output", 0]]);
        client.collect(request).then(response => {
            expect(response.features.shape).eql("vector");
            const collected = response.features.collected as VectorFeatures;
            expect(collected.data).empty;
            
            request.parameterValues.set("produce_output", 1);
            client.collect(request).then(response => {
                expect(response.features.shape).eql("vector");
                const collected = response.features.collected as VectorFeatures;
                expect(collected.data).not.empty;
            });
        });
    });

    it("returns expected collected features for one-sample-per-step vector output", () => {
        const blocks = 10;
        const request = makeRequest(blockSize * blocks, "input-timestamp");
        const expected: VectorFeatures = {
            stepDuration: stepSize / rate,
            data: new Float32Array(blocks)
        };
        for (let i = 0; i < blocks; ++i) {
            // The timestamp should be the frame number of the first
            // frame in the input buffer, for each block
            expected.data[i] = i * stepSize;
        }
        client.collect(request).then(response => {
            expect(response.features.shape).eql("vector");
            const collected = response.features.collected as VectorFeatures;
            expect(collected).eql(expected);
        });
    });
    
    it("returns expected collected features for one-sample-per-step matrix output", () => {
        const blocks = 10;
        const request = makeRequest(blockSize * blocks, "grid-oss");
        client.collect(request).then(response => {
            expect(response.features.shape).eql("matrix");
            const collected = response.features.collected as MatrixFeatures;
            expect(collected.stepDuration).eql(stepSize / rate);
            expect(collected.data.length).eql(10);
            for (let i = 0; i < 10; ++i) {
                const column = new Float32Array(10);
                for (let j = 0; j < 10; ++j) {
                    column[j] = (j + i + 2.0) / 30.0;
                }
                expect(collected.data[i]).eql(column);
            }
        });
    });

    it("returns expected collected features for fixed-sample-rate vector output", () => {
        const blocks = 10;
        const request = makeRequest(blockSize * blocks, "curve-fsr");
        const expected: VectorFeatures = {
            stepDuration: 0.4,
            data: new Float32Array(blocks)
        };
        for (let i = 0; i < blocks; ++i) {
            expected.data[i] = i * 0.1;
        }
        client.collect(request).then(response => {
            expect(response.features.shape).eql("vector");
            const collected = response.features.collected as VectorFeatures;
            expect(collected).eql(expected);
        });
    });
    
    it("returns expected collected features for fixed-sample-rate tracks output", () => {
        const blocks = 10;
        const request = makeRequest(blockSize * blocks, "curve-fsr-timed");
        const expectedStarts = [ 0.0, 0.0, 0.0, 2.0, 2.0, 2.0, 4.0, 4.0 ];
        const expectedValues = [ [ 0.0 ], [ 0.1 ], [ 0.2, 0.3 ],
                                 [ 0.4 ], [ 0.5 ], [ 0.6, 0.7 ],
                                 [ 0.8 ], [ 0.9 ] ];
        const expected: TrackFeatures = [];
        for (let i = 0; i < expectedStarts.length; ++i) {
            expected.push({
                startTime: expectedStarts[i],
                stepDuration: 0.4,
                data: new Float32Array(expectedValues[i])
            });
        }
        client.collect(request).then(response => {
            expect(response.features.shape).eql("tracks");
            const collected = response.features.collected as TrackFeatures;
            expect(collected).eql(expected);
        });
    });
    
    it("returns expected collected features for variable-sample-rate output", () => {
        const blocks = 10;
        const request = makeRequest(blockSize * blocks, "curve-vsr");
        client.collect(request).then(response => {
            expect(response.features.shape).eql("list");
            const collected = response.features.collected as FeatureList;
            expect(collected.length).eql(10);
            for (let i = 0; i < 10; ++i) {
                expect(collected[i].timestamp).eql(fromSeconds(i * 0.75));
                expect(collected[i].featureValues).eql(new Float32Array([i * 0.1]));
            }
        });
    });
    
    
});


