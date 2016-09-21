/**
 * Created by lucast on 21/09/2016.
 */

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {ModuleRequestHandler, StaticData, Response, LoadResponse} from "../src/ClientServer";
import {LocalModuleRequestHandler, Plugin, FeatureExtractorFactory} from "../src/LocalModuleRequestHandler";
import {ZeroCrossings} from "../plugins/example-module/zero-crossings/src/ZeroCrossings";
chai.should();
chai.use(chaiAsPromised);

describe("LocalModuleRequestHandler", () => {
    const zcFactory: FeatureExtractorFactory = sr => new ZeroCrossings(sr);
    const zcMetadata: StaticData = require('../plugins/example-module/zero-crossings/feats-config.json').description;
    const plugins: Plugin[] = [];
    plugins.push({extractor: zcFactory, metadata: zcMetadata});

    it("Handles list requests, with a response whose content body is {plugins: StaticData[]}", () => {
        const handler: ModuleRequestHandler = new LocalModuleRequestHandler(...plugins);
        return handler.handle({type: "list"}).then(response => {
            response.content.should.eql({plugins: [zcMetadata]});
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
            const expectedResponse: LoadResponse = require('./fixtures/expected-load-response.json');
            const response: Promise<Response> = handler.handle({
                type: "load", content: {
                    pluginKey: "example-module:zerocrossing",
                    inputSampleRate: 44100,
                    adapterFlags: ["AdaptAllSafe"]
                }
            });
            return response.then(response => {
                response.content.should.eql(expectedResponse);
            });
        })
    });
});