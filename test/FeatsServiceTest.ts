/**
 * Created by lucast on 21/09/2016.
 */

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {
    LoadResponse, ConfigurationResponse,
    ConfigurationRequest, ProcessRequest, ProcessResponse, LoadRequest, Service
} from "../src/Piper";
import {PluginFactory, FeatureExtractorFactory, FeatsService} from "../src/FeatsService";
import {StaticData, Configuration, AdapterFlags} from "feats/FeatureExtractor";
import {FeatureExtractorStub, MetaDataStub} from "./fixtures/FeatureExtractorStub";
import {
    FrequencyDomainExtractorStub,
    FrequencyMetaDataStub
} from "./fixtures/FrequencyDomainExtractorStub";
import {FeatureSet} from "feats/Feature";
chai.should();
chai.use(chaiAsPromised);

describe("FeatsService", () => {
    const metadata: StaticData = MetaDataStub;
    const factory: FeatureExtractorFactory = sr => new FeatureExtractorStub();
    const plugins: PluginFactory[] = [];
    plugins.push({extractor: factory, metadata: metadata});
    plugins.push({
        extractor: sr => new FrequencyDomainExtractorStub(),
            metadata: FrequencyMetaDataStub
    });

    describe("List request handling", () => {
        it("Resolves to a response whose content body is {available: StaticData[]}", () => {
            const service: FeatsService = new FeatsService(...plugins);
            return service.list({}).then(response => {
                response.should.eql({available: [metadata, FrequencyMetaDataStub]});
            });
        });
    });

    describe("Load request handling", () => {
        const service: Service = new FeatsService(...plugins);
        it("Rejects when the request contains an invalid plugin key", () => {
            const response: Promise<LoadResponse> = service.load({
                key: "not-a-real:plugin",
                inputSampleRate: 666,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            });
            return response.should.eventually.be.rejected;
        });

        it("Resolves to a response where the content body is a LoadResponse", () => {
            const expectedResponse: LoadResponse = require('./fixtures/expected-load-response-js.json');
            const response: Promise<LoadResponse> = service.load({
                key: "stub:sum",
                inputSampleRate: 16,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            });
            return response.then(response => {
                response.should.eql(expectedResponse);
            });
        })
    });

    describe("Configure request handling", () => {
        const config: Configuration = {blockSize: 8, channelCount: 1, stepSize: 8};
        const configRequest: ConfigurationRequest = {handle: 1, configuration: config};
        const loadRequest: LoadRequest = {
            key: "stub:sum",
            inputSampleRate: 16,
            adapterFlags: [AdapterFlags.AdaptAllSafe]
        };

        it("Rejects when the request contains an invalid plugin handle", () => {
            const service: FeatsService = new FeatsService(...plugins);
            return service.configure(configRequest).should.eventually.be.rejected;
        });

        it("Rejects when the plugin mapping to the handle in the request has already been configured", () => {
            const service: FeatsService = new FeatsService(...plugins);
            const loadResponse: Promise<LoadResponse> = service.load(loadRequest);
            const configure = (response: LoadResponse): Promise<ConfigurationResponse> => {
                return service.configure({
                    handle: response.handle,
                    configuration: config
                });
            };
            return Promise.all([loadResponse.then(configure), loadResponse.then(configure)]).should.be.rejected;
        });

        it("Resolves to a response whose content body is a ConfigurationResponse", () => {
            const expectedResponse: ConfigurationResponse = require('./fixtures/expected-configuration-response-js.json');
            const service: FeatsService = new FeatsService(...plugins);
            return service.load(loadRequest).then(response => {
                const configResponse: Promise<ConfigurationResponse> = service.configure({
                    handle: response.handle,
                    configuration: config
                });
                return configResponse.then(response => response.should.eql(expectedResponse));
            });
        });
    });

    describe("Process and Finish request handling", () => {
        const service: FeatsService = new FeatsService(...plugins);
        const config: (key: string) => Promise<ConfigurationResponse> = (key) => {
            return service.load({
                key: key,
                inputSampleRate: 16,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            }).then(loadResponse => {
                return service.configure({
                    handle: loadResponse.handle,
                    configuration: {blockSize: 8, channelCount: 1, stepSize: 8}
                })
            });
        };

        it("Rejects when the wrong number of channels are supplied", () => {
            return config("stub:sum").then(response => {
                const request: ProcessRequest = {
                    handle: response.handle,
                    processInput: {
                        timestamp: {s: 0, n: 0},
                        inputBuffers: []
                    }
                };
                return service.process(request);
            }).should.eventually.be.rejected;
        });

        it("Rejects when the plugin handle is not valid", () => {
            const request: ProcessRequest = {
                handle: 666,
                processInput: {
                    timestamp: {s: 0, n: 0},
                    inputBuffers: []
                }
            };
            return service.process(request).should.eventually.be.rejected;
        });


        it("Resolves to a response whose content body contains the extracted features", () => {
            const expected: Map<string, FeatureSet> = new Map([
                ["stub:sum", new Map([
                    ["sum", [{featureValues: new Float32Array([8])}]],
                    ["cumsum", [{featureValues: new Float32Array([8])}]]
                ])],
                ["stub-freq:spectrum", new Map([
                    ["spectrum", [{featureValues: new Float32Array([64, 0, 0, 0, 0])}]]
                ])]
            ]);

            const responses: Promise<ProcessResponse>[] = [...expected.keys()].map(key =>
                config(key).then(response => {
                    return service.process({
                        handle: response.handle,
                        processInput: {
                            timestamp: {s:0, n: 0},
                            inputBuffers: [new Float32Array([1, 1, 1, 1, 1, 1, 1, 1])]
                        }
                    });
                }));

            return Promise.all(responses).then(responses => {
                const expectedValues: FeatureSet[] = [...expected.values()];
                responses.forEach((response: ProcessResponse, i: number) => {
                    [...response.features.keys()].should.eql([...expectedValues[i].keys()]);
                    [...response.features.values()].should.eql([...expectedValues[i].values()]);
                });
            });
        });

        it("Finish - Returns the remaining features and clears up the plugin", () => {
            const expected: any = {features: {}, handle: 1};
            return config("stub:sum")
                .then(response => service.finish({handle: response.handle}))
                .then(response => {
                    if (!response.should.eql(expected)) {
                        return Promise.reject("Finish did not return expected FeatureSet."); // did not pass
                    }
                    return service.finish({handle: response.handle}).should.eventually.be.rejected;
                });
        });
    });
});
