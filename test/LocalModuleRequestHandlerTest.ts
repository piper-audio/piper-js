/**
 * Created by lucast on 21/09/2016.
 */

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {
    ModuleRequestHandler, Response, LoadResponse, ConfigurationResponse,
    ConfigurationRequest, Request, ProcessRequest
} from "../src/ClientServer";
import {LocalModuleRequestHandler, PluginFactory, FeatureExtractorFactory} from "../src/LocalModuleRequestHandler";
import ZeroCrossings from "../plugins/example-module/zero-crossings/src/ZeroCrossings";
import {StaticData, Configuration} from "../src/FeatureExtractor";
chai.should();
chai.use(chaiAsPromised);

describe("LocalModuleRequestHandler", () => {
    const zcMetadata: StaticData = require('../plugins/example-module/zero-crossings/feats-config.json').description;
    const zcFactory: FeatureExtractorFactory = sr => new ZeroCrossings(sr);
    const plugins: PluginFactory[] = [];
    plugins.push({extractor: zcFactory, metadata: zcMetadata});

    describe("List request handling", () => {
        it("Resolves to a response whose content body is {plugins: StaticData[]}", () => {
            const handler: ModuleRequestHandler = new LocalModuleRequestHandler(...plugins);
            return handler.handle({type: "list"}).then(response => {
                response.content.should.eql({plugins: [zcMetadata]});
            });
        });
    });

    describe("Load request handling", () => {
        const handler: ModuleRequestHandler = new LocalModuleRequestHandler(...plugins);
        it("Rejects when the request contains an invalid plugin key", () => {
            const response: Promise<Response> = handler.handle({
                type: "load", content: {
                    pluginKey: "not-a-real:plugin",
                    inputSampleRate: 666,
                    adapterFlags: ["AdaptAllSafe"]
                }
            });
            return response.should.eventually.be.rejected;
        });

        it("Resolves to a response where the content body is a LoadResponse", () => {
            const expectedResponse: LoadResponse = require('./fixtures/expected-load-response-js.json');
            const response: Promise<Response> = handler.handle({
                type: "load", content: {
                    pluginKey: "example-module:zerocrossing",
                    inputSampleRate: 16,
                    adapterFlags: ["AdaptAllSafe"]
                }
            });
            return response.then(response => {
                response.content.should.eql(expectedResponse);
            });
        })
    });

    describe("Configure request handling", () => {
        const config: Configuration = {blockSize: 8, channelCount: 1, stepSize: 8};
        const configRequest: ConfigurationRequest = {pluginHandle: 1, configuration: config};
        const loadRequest: Request = {
            type: "load", content: {
                pluginKey: "example-module:zerocrossing",
                inputSampleRate: 16,
                adapterFlags: ["AdaptAllSafe"]
            }
        };

        it("Rejects when the request contains an invalid plugin handle", () => {
            const handler: ModuleRequestHandler = new LocalModuleRequestHandler(...plugins);
            return handler.handle({
                type: "configure",
                content: configRequest
            }).should.eventually.be.rejected;
        });

        it("Rejects when the plugin mapping to the handle in the request has already been configured", () => {
            const handler: ModuleRequestHandler = new LocalModuleRequestHandler(...plugins);
            const loadResponse: Promise<Response> = handler.handle(loadRequest);
            const configure = (response: Response): Promise<Response> => {
                return handler.handle({
                    type: "configure",
                    content: {
                        pluginHandle: response.content.pluginHandle,
                        configuration: config
                    }
                });
            };
            return Promise.all([loadResponse.then(configure), loadResponse.then(configure)]).should.be.rejected;
        });

        it("Resolves to a response whose content body is a ConfigurationResponse", () => {
            const expectedResponse: ConfigurationResponse = require('./fixtures/expected-configuration-response-js.json');
            const handler: ModuleRequestHandler = new LocalModuleRequestHandler(...plugins);
            return handler.handle(loadRequest).then(response => {
                const configResponse: Promise<Response> = handler.handle({
                    type: "configure",
                    content: {
                        pluginHandle: response.content.pluginHandle,
                        configuration: config
                    }
                });
                return configResponse.then(response => response.content.should.eql(expectedResponse));
            });
        });
    });

    describe("Process and Finish request handling", () => {
        const handler: ModuleRequestHandler = new LocalModuleRequestHandler(...plugins);
        const configResponse: Promise<Response> = handler.handle({
            type: "load", content: {
                pluginKey: "example-module:zerocrossing",
                inputSampleRate: 16,
                adapterFlags: ["AdaptAllSafe"]
            }
        }).then(loadResponse => {
            return handler.handle(
                {type: "configure",
                    content: {
                        pluginHandle: loadResponse.content.pluginHandle,
                        configuration: {blockSize: 8, channelCount: 1, stepSize: 8}
                    }
                })
        });

        it("Rejects when the wrong number of channels are supplied", () => {
            return configResponse.then(response => {
                const request: ProcessRequest = {
                    pluginHandle: response.content.pluginHandle,
                    processInput: {
                        timestamp: {s: 0, n: 0},
                        inputBuffers: []
                    }
                };
                return handler.handle({type: "process", content: request});
            }).should.eventually.be.rejected;
        });

        it("Rejects when the plugin handle is not valid", () => {
            const request: ProcessRequest = {
                pluginHandle: 666,
                processInput: {
                    timestamp: {s: 0, n: 0},
                    inputBuffers: []
                }
            };
            return handler.handle({type: "process", content: request}).should.eventually.be.rejected;
        });


        it("Resolves to a response whose content body contains the extracted features", () => {
            const expected: any = require("./fixtures/expected-process-response.json");
            const processResponse: Promise<Response> = configResponse.then(response => {
                return handler.handle({
                    type: "process",
                    content: {
                        pluginHandle: response.content.pluginHandle,
                        processInput: {
                            timestamp: {s:0, n: 0},
                            inputBuffers: [new Float32Array([0, 1, -1, 0, 1, -1, 0, 1])]
                        }
                    }
                });
            });
            return processResponse.then(response => response.content.should.eql(expected));
        });

        it("Finish - Returns the remaining features and clears up the plugin", () => {
            const expected: any = {features: {}, pluginHandle: 1};
            return configResponse
                .then(response => handler.handle({
                    type: "finish",
                    content: {pluginHandle: response.content.pluginHandle}
                }))
                .then(response => {
                    if (!response.content.should.eql(expected)) {
                        return Promise.reject("Finish did not return expected FeatureSet."); // did not pass
                    }
                    return handler.handle({
                        type: "finish",
                        content: {pluginHandle: response.content.pluginHandle}
                    }).should.eventually.be.rejected;
                });
        });
    });
});
