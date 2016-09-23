/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');

import {FeatsModuleClient} from "../src/FeatsModuleClient";

import {
    Response, StaticData, LoadRequest, AdapterFlags, LoadResponse,
    ConfigurationRequest, Configuration, ConfigurationResponse,
    ProcessRequest, ProcessInput
} from "../src/ClientServer";

import {Feature} from "../src/Feature";
import {Timestamp,frame2timestamp} from "../src/Timestamp";
import {batchProcess} from "../src/AudioUtilities";

import VampExamplePlugins = require("../ext/VampExamplePlugins");
import {EmscriptenModuleRequestHandler} from "../src/EmscriptenModuleRequestHandler";

chai.should();
chai.use(chaiAsPromised);

describe('ProcessTimings', () => {

    const server = new FeatsModuleClient(
        new EmscriptenModuleRequestHandler(VampExamplePlugins()));

    const iterations = 1000;
    
    const runProcessTest = function (key : string,
                                     outputId : string,
				     done : MochaDone) {

        const rate : number = 44100;
        
        server.loadPlugin({
            pluginKey : key,
            inputSampleRate : rate,
            adapterFlags : [AdapterFlags.AdaptAllSafe]
        }).then(response => {
            const centroidHandle : number = response.pluginHandle;
            let stepSize : number = response.defaultConfiguration.stepSize;
            let blockSize : number = response.defaultConfiguration.blockSize;
	    if (blockSize === 0) {
		blockSize = 1024;
		stepSize = blockSize;
	    }
            server.configurePlugin({
                pluginHandle : centroidHandle,
                configuration : {
                    blockSize : blockSize,
                    stepSize : stepSize,
                    channelCount : 1
                }
            }).then(response => {
                const makeBlock = ((n : number) => { 
                    return {
                        timestamp : frame2timestamp(n * blockSize, rate),
                        inputBuffers : [
                          { values : new Float32Array(
                              Array.from(Array(blockSize).keys(),
                                         n => n / blockSize)) }
                        ],
                    }
                });
                const blocks : ProcessInput[] =
                    Array.from(Array(iterations).keys(), makeBlock);
                const results = batchProcess(
                    blocks,
                    b => server.process({
                        pluginHandle : centroidHandle,
                        processInput : b
                    }));
                results.then(features => {
                    let sum = features.get(outputId).reduce(
                        (acc, f) => {
                            return acc + f.values.reduce((acc, v) => acc + v, 0.0);
                        }, 0.0);
                    if (sum === 0) throw("This should not happen");
                    done();
                }, err => { console.log("failure: " + err); })
	    })
	})
    };

    it('Process ' + iterations + ' freq-domain blocks', function (done) {
        this.timeout(0); // Suppress the timeout. Only possible when
			 // using a classic function rather than arrow
	runProcessTest ("vamp-example-plugins:spectralcentroid", "logcentroid", done);
    });

    it('Process ' + iterations + ' time-domain blocks', function (done) {
        this.timeout(0);
	runProcessTest ("vamp-example-plugins:zerocrossing", "counts", done);
    });

    it('Process ' + iterations + ' spectrogram blocks', function (done) {
        this.timeout(0);
	runProcessTest ("vamp-example-plugins:powerspectrum", "powerspectrum", done);
    });

    it('Process ' + iterations + ' freq-domain blocks [second run]', function (done) {
        this.timeout(0);
	runProcessTest ("vamp-example-plugins:spectralcentroid", "logcentroid", done);
    });

    it('Process ' + iterations + ' time-domain blocks [second run]', function (done) {
        this.timeout(0);
	runProcessTest ("vamp-example-plugins:zerocrossing", "counts", done);
    });

    it('Process ' + iterations + ' spectrogram blocks [second run]', function (done) {
        this.timeout(0);
	runProcessTest ("vamp-example-plugins:powerspectrum", "powerspectrum", done);
    });

});

