
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');

import {EmscriptenPluginServer} from "../src/EmscriptenPluginServer";

import {
    Response, StaticData, LoadRequest, AdapterFlags, LoadResponse,
    ConfigurationRequest, Configuration, ConfigurationResponse,
    ProcessRequest, ProcessBlock
} from "../src/PluginServer";

import {Feature} from "../src/Feature";
import {Timestamp,frame2timestamp} from "../src/Timestamp";
import {batchProcess} from "../src/AudioUtilities";

chai.should();
chai.use(chaiAsPromised);

describe('ProcessPerformanceTest', () => {

    const server = new EmscriptenPluginServer();

    it('Can process a load of stuff', (done) => {

	const rate : number = 44100;
	
	server.loadPlugin({
	    pluginKey : "vamp-example-plugins:spectralcentroid",
	    inputSampleRate : rate,
	    adapterFlags : [AdapterFlags.AdaptAllSafe]
	}).then(response => {
	    const centroidHandle : number = response.pluginHandle;
	    const stepSize : number = response.defaultConfiguration.stepSize;
	    const blockSize : number = response.defaultConfiguration.blockSize;
	    server.configurePlugin({
		pluginHandle : centroidHandle,
		configuration : {
		    blockSize : blockSize,
		    stepSize : stepSize,
		    channelCount : 1
		}
	    }).then(response => {
		const blockCount = 100;
		const theBuffer = new Float32Array(
		    Array.from(Array(blockSize).keys(),
			       n => 1.1));
		const theOtherBuffer = new Float32Array(blockSize);
		const makeBlock = ((n : number) => { 
		    return {
			timestamp : frame2timestamp(n * blockSize, rate),
			inputBuffers : [

			    { values : theBuffer }

//			    { values : new Float32Array(blockSize) }
//			    { values : new Float32Array(
//				Array.from(Array(blockSize).keys(),
//					   n => n / blockSize)) }
			],
		    }
		});
		const blocks : ProcessBlock[] =
		    //!!! shurely there is a better way to tabulate an array
		    Array.from(Array(blockCount).keys(), makeBlock);
		const results = batchProcess(
		    blocks,
		    b => server.process({
			pluginHandle : centroidHandle,
			processInput : b
		    }));
		results.then(features => {
		    console.log("have " + features.length + " feature(s)");
		    done();
		});
	    })
	}) 
    });
    
    
});

