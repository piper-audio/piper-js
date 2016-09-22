/**
 * Created by lucast on 21/09/2016.
 */

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {
    ModuleRequestHandler, StaticData, Response, LoadResponse, ConfigurationResponse,
    ConfigurationRequest, Configuration, Request
} from "../src/ClientServer";
import {LocalModuleRequestHandler, Plugin, FeatureExtractorFactory} from "../src/LocalModuleRequestHandler";
import {ZeroCrossings} from "../plugins/example-module/zero-crossings/src/ZeroCrossings";
import {FeatsModuleClient} from "../src/FeatsModuleClient";
chai.should();
chai.use(chaiAsPromised);

describe("LocalModuleRequestHandler", () => {
    const zcMetadata: StaticData = require('../plugins/example-module/zero-crossings/feats-config.json').description;
    const zcFactory: FeatureExtractorFactory = sr => new ZeroCrossings(sr, zcMetadata);
    const plugins: Plugin[] = [];
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
            const client: FeatsModuleClient = new FeatsModuleClient(handler);
            return client.loadPlugin(loadRequest.content).then(response => {
                const configResponse: Promise<ConfigurationResponse> = client.configurePlugin({
                    pluginHandle: response.pluginHandle,
                    configuration: config
                });
                return configResponse.then(response => response.should.eql(expectedResponse));
            });
        });
    });
});