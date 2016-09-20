/**
 * Created by lucast on 20/09/2016.
 */
import chai = require("chai");
import chaiAsPromised = require("chai-as-promised");
import {FeatureExtractor} from "../src/FeatureExtractor";
import {ModuleAdapter} from "../src/ModuleAdapter";
import {StaticData} from "../src/ClientServer";
import {ZeroCrossings} from "../plugins/example-module/zero-crossings/src/ZeroCrossings";
chai.should();

describe("ModuleAdapter", () => {
    it("Should return an instance of the Feature Extractor it adapts", () => {
        const adaptor: ModuleAdapter = new ModuleAdapter((sampleRate: number) => new ZeroCrossings(sampleRate), {} as StaticData);
        const extractor: FeatureExtractor = adaptor.createFeatureExtractor(44100);
        return (extractor instanceof ZeroCrossings).should.be.true;
    });
});