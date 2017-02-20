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

    const vampSchemaBase = "http://vamp-plugins.org/piper/json/schema/";
    const vampSchemaFileBase = __dirname + "/schema/";

    const loadSchema = () => {
        fs.readdirSync(vampSchemaFileBase)
            .filter(filename => filename.endsWith(".json"))
            .map(filename => filename.split(".json")[0])
            .forEach(name => {
                tv4.addSchema(JSON.parse(
                    fs.readFileSync(
                        vampSchemaFileBase + name + ".json",
                        "utf8")));
        });
    };

    loadSchema();

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

    const throwIfInvalid = (json: any, path: string) => {
        if (!tv4.validate(json, path) || tv4.missing.length) {
            const error = tv4.error ? report(tv4.error) : "Missing $refs";
            throw new Error(error);
        }
    };

    it("Validates configuration response", function(done) {
        throwIfInvalid(configurationResponse,
		          vampSchemaBase + "configurationresponse#");
        done();
    });

    it("Validates load response", function(done) {
        throwIfInvalid(loadResponse, vampSchemaBase + "loadresponse#");
        done();
    });

    it("Validates list response", function(done) {
        throwIfInvalid(listResponse, vampSchemaBase + "listresponse#");
        done();
    });
});


	 
