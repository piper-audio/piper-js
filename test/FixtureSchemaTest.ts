/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");

import {
    StaticData, LoadRequest, AdapterFlags, LoadResponse, ConfigurationRequest,
    Configuration, ConfigurationResponse, ProcessRequest, ProcessInput, SampleType
} from "../src/ClientServer";

import fs = require("fs");

const validator = require('json-schema-remote');

validator.preload(
	    fs.readFileSync(
		__dirname + "/../../vamp-json-schema/schema/configurationresponse.json",
		"utf8"));

console.log("preloaded");

const schemaBase = "http://vamp-plugins.org/json/schema/";

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
    
    const configurationResponse =
        loadFixture("expected-configuration-response") as ConfigurationResponse;

    const loadResponse =
        loadFixture("expected-load-response") as LoadResponse;

    const report = function(verr : any) : string {
	return verr.errors.map((e : any) => {
	    return "Error: \"" + e.message + "\" at data path " + e.dataPath
		+ " and schema path " + e.schemaPath;
	}).join("\n");
    }
    
    it("Validates configuration response", function(done) {
	validator.tv4Validate(configurationResponse,
			   schemaBase + "configurationresponse#")
	    .then(() => done())
	    .catch((verr: any) => {
		throw (new Error(report(verr)));
	    });
    });
    
    it("Validates load response", function(done) {
	validator.tv4Validate(loadResponse,
                           schemaBase + "loadresponse#")
	    .then(() => done())
	    .catch((verr: any) => {
		throw (new Error(report(verr)));
	    });
    });
});


	 
