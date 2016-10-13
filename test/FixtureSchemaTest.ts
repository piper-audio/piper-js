/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");

import {LoadResponse, ListResponse, ConfigurationResponse} from "../src/Piper";

import fs = require("fs");

const tv4 = require("tv4");

chai.should();
chai.use(chaiAsPromised);

describe("FixtureSchema", () => {

    // Really this is just a roundabout way of validating the
    // ClientServer interfaces against the Vamp JSON Schema. I wonder
    // how we can do that more directly.

    //!!! dup, refactor, or find similar in mocha etc
    const loadFixture = (name : string) => {
	return JSON.parse( 
	    fs.readFileSync(
		__dirname + "/fixtures/" + name + ".json",
		"utf8"));
    };

    const vampSchemaBase = "http://vamp-plugins.org/json/schema/";
    const vampSchemaFileBase = __dirname + "/schema/";

    const loadSchema = () => {
        const vampSchema = [
            "basic",
            "configuration",
            "configurationrequest",
            "configurationresponse",
            "configuredoutputdescriptor",
            "enums",
            "error",
            "extractorstaticdata",
            "feature",
            "featureset",
            "finishrequest",
            "finishresponse",
            "listrequest",
            "listresponse",
            "loadrequest",
            "loadresponse",
            "outputdescriptor",
            "parameterdescriptor",
            "processinput",
            "processrequest",
            "processresponse",
            "realtime",
            "rpcrequest",
            "rpcresponse",
            "serialisedarray",
            "valueextents"
        ];
        vampSchema.map(name => {
            tv4.addSchema(JSON.parse(
                fs.readFileSync(
                    vampSchemaFileBase + name + ".json",
                    "utf8")));
        });
    };

    const preload = loadSchema();
    
    const configurationResponse =
        loadFixture("expected-configuration-response") as ConfigurationResponse;

    const loadResponse =
        loadFixture("expected-load-response") as LoadResponse;

    const listResponse =
        loadFixture("expected-plugin-list") as ListResponse;

    const report = function(e : any) : string {
	return "Error: \"" + e.message + "\" at data path " + e.dataPath
	    + " and schema path " + e.schemaPath;
    };

    it("Validates configuration response", function(done) {
        if (!tv4.validate(configurationResponse,
		          vampSchemaBase + "configurationresponse#")) {
            throw new Error(report(tv4.error));
        } 
        done();
    });
    
    it("Validates load response", function(done) {
        if (!tv4.validate(loadResponse,
		          vampSchemaBase + "loadresponse#")) {
            throw new Error(report(tv4.error));
        }
        done();
    });
    
    it("Validates list response", function(done) {
        if (!tv4.validate(listResponse,
		          vampSchemaBase + "listresponse#")) {
            throw new Error(report(tv4.error));
        }
        done();
    });
});


	 
