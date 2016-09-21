/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");

import {
    StaticData, LoadRequest, AdapterFlags, LoadResponse, ConfigurationRequest,
    Configuration, ConfigurationResponse, ProcessRequest, ProcessInput, SampleType
} from "../src/ClientServer";

const validator = require('json-schema-remote');

chai.should();
chai.use(chaiAsPromised);

describe("FixtureSchema", () => {

    // Really this is just a roundabout way of validating the
    // ClientServer interfaces against the Vamp JSON Schema. I wonder
    // how we can do that more directly.
    
    const configurationResponse = require(
	"./fixtures/expected-configuration-response.json") as ConfigurationResponse;

    const loadResponse = require(
	"./fixtures/expected-load-response.json") as LoadResponse;

    const schemaBase = "http://vamp-plugins.org/json/schema/";

    const report = function(verr : any) : string {
	return verr.errors.map((e : any) => {
	    return "Error: \"" + e.message + "\" at data path " + e.dataPath
		+ " and schema path " + e.schemaPath;
	}).join("\n");
    }
    
    it("Validates configuration response", function(done) {
	validator.validate(configurationResponse,
			   schemaBase + "configurationresponse#")
	    .then(() => done())
	    .catch((verr: any) => {
		throw (new Error(report(verr)));
	    });
    });
    
    it("Validates load response", function(done) {
	validator.validate(loadResponse,
			   schemaBase + "loadresponse#")
	    .then(() => done())
	    .catch((verr: any) => {
		throw (new Error(report(verr)));
	    });
    });
});


	 
