/**
 * Created by lucast on 31/08/2016.
 */

import {
    PluginServer,
    StaticData,
    LoadRequest, LoadResponse,
    ConfigurationRequest, ConfigurationResponse,
    ProcessRequest,
    Response, Request, AdapterFlags
} from './PluginServer';

import {Timestamp} from "./Timestamp";
import {Feature} from "./Feature";
import VamPipeServer = require('../ext/ExampleModule');
import {Allocator, EmscriptenModule} from "./Emscripten";
import base64 = require('base64-js');

interface WireFeature {
    timestamp?: Timestamp,
    duration?: Timestamp,
    label?: string,
    values?: Float32Array,
    b64values?: string,
}

export class EmscriptenPluginServer implements PluginServer {
    private server: EmscriptenModule;
    private doRequest: (ptr: number) => number;
    private doProcess: (handle: number, bufs: number, sec: number, nsec: number) => number;
    private freeJson: (ptr: number) => void;

    constructor() {
        this.server = VamPipeServer();
        this.doRequest = this.server.cwrap('vampipeRequestJson', 'number', ['number']) as (ptr: number) => number;
	this.doProcess = this.server.cwrap('vampipeProcessRaw', 'number', ['number','number','number','number']) as (handle: number, bufs: number, sec: number, nsec: number) => number;
        this.freeJson = this.server.cwrap('vampipeFreeJson', 'void', ['number']) as (ptr: number) => void;
    }

    private requestJsonString(requestJson: string): Promise<Response> {
        return new Promise<Response>((resolve) => {
            const requestJsonPtr: number = this.server.allocate(this.server.intArrayFromString(requestJson), 'i8', Allocator.ALLOC_NORMAL);
            const responseJsonPtr: number = this.doRequest(requestJsonPtr);
            this.server._free(requestJsonPtr);
            var response: Response = JSON.parse(this.server.Pointer_stringify(responseJsonPtr));
            this.freeJson(responseJsonPtr);
	    
            if (!response.success) {
		throw new Error(response.errorText);
	    } else {
		resolve(response);
	    }
        });
    }

    private request(request: Request): Promise<Response> {
	return this.requestJsonString(JSON.stringify(request));
    }

    listPlugins(): Promise<StaticData[]> {
        return this.request({type: 'list'} as Request).then((response) => {
            return response.content.plugins as StaticData[];
        });
    }

    loadPlugin(request: LoadRequest): Promise<LoadResponse> {
        (request as any).adapterFlags = request.adapterFlags.map((flag) => AdapterFlags[flag]);
        return this.request({type: 'load', content: request} as Request).then((response) => {
            return response.content as LoadResponse;
        });
    }

    configurePlugin(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.request({type: 'configure', content: request}).then((response) => {
            return response.content as ConfigurationResponse;
        });
    }

    process(request: ProcessRequest): Promise<Feature[][]> {
	return this.processJson(request);
    }

    processJson(request: ProcessRequest): Promise<Feature[][]> {
        request.processInput.inputBuffers.forEach((val) => {
            (val as any).values = [...val.values]; // TODO is there a better way to change Float32Array's JSON representation
        });
        return this.request({type: 'process', content: request}).then((response) => {
            return EmscriptenPluginServer.responseToFeatureSet(response);
        });
    }

    private makeProcessCall(request: ProcessRequest): Promise<Response> {
	return new Promise<Response>((resolve) => {

	    const nchannels = request.processInput.inputBuffers.length;
	    const nframes = request.processInput.inputBuffers[0].values.length;

	    const bufsPtr = this.server._malloc(nchannels * 4);
	    const bufs = new Uint32Array(
		this.server.HEAPU8.buffer, bufsPtr, nchannels);
	    
	    for (let i = 0; i < nchannels; ++i) {
		const framesPtr = this.server._malloc(nframes * 4);
		const frames = new Float32Array(
		    this.server.HEAPU8.buffer, framesPtr, nframes);
		frames.set(request.processInput.inputBuffers[i].values);
		bufs[i] = framesPtr;
	    }
		
	    const responseJsonPtr: number = this.doProcess(
		request.pluginHandle,
		bufsPtr,
		request.processInput.timestamp.s,
		request.processInput.timestamp.n);

	    for (let i = 0; i < nchannels; ++i) {
		this.server._free(bufs[i]);
	    }
	    this.server._free(bufsPtr);
	    
            var response: Response = JSON.parse(
		this.server.Pointer_stringify(responseJsonPtr));
            this.freeJson(responseJsonPtr);
	    
            if (!response.success) {
		throw new Error(response.errorText);
	    } else {
		resolve(response);
	    }
	});
    }
    
    processRaw(request: ProcessRequest): Promise<Feature[][]> {
        return this.makeProcessCall(request).then((response) => {
	    return EmscriptenPluginServer.responseToFeatureSet(response);
        });
    }
	
    private static toBase64(values: Float32Array) : string {
	// We want a base-64 encoding of the raw memory backing the
	// typed array. We assume byte order will be the same when the
	// base-64 stuff is decoded, but I guess that might not be
	// true in a network situation. The Float32Array docs say "If
	// control over byte order is needed, use DataView instead" so
	// I guess that's a !!! todo item
	const b64 = base64.fromByteArray(new Uint8Array(values.buffer));
	return b64;
    }

    private static fromBase64(b64: string): Float32Array {
	// The base64 module expects input to be padded to a
	// 4-character boundary, but the C++ VampJson code does not do
	// that, so let's do it here
	while (b64.length % 4 > 0) {
	    b64 += "=";
	}
	//!!! endianness, as above.
	return new Float32Array(base64.toByteArray(b64).buffer);
    }

    private static convertWireFeature(wfeature: WireFeature): Feature {
	let out : Feature = {};
	if (wfeature.timestamp != null) {
	    out.timestamp = wfeature.timestamp;
	}
	if (wfeature.duration != null) {
	    out.duration = wfeature.duration;
	}
	if (wfeature.label != null) {
	    out.label = wfeature.label;
	}
	if (wfeature.b64values != null && wfeature.b64values !== "") {
	    out.values = EmscriptenPluginServer.fromBase64(wfeature.b64values);
	} else if (wfeature.values != null) {
	    out.values = new Float32Array(wfeature.values);
	}
	return out;
    }

    private static convertWireFeatureList(wfeatures: WireFeature[]): Feature[] {
	return wfeatures.map(EmscriptenPluginServer.convertWireFeature);
    }
    
    processBase64(request: ProcessRequest): Promise<Feature[][]> {
	let requestJson : string =
	    '{"type":"process","content":{"pluginHandle":' + request.pluginHandle +
	    ',"processInput":{"inputBuffers":[';
	requestJson += 
	    request.processInput.inputBuffers.map(channel => {
		return '{"b64values":"' +
		    EmscriptenPluginServer.toBase64(channel.values) +
		    '"}';
	    }).join();
	requestJson += '],"timestamp":{"s":' +
	    request.processInput.timestamp.s +
	    ',"n":' + request.processInput.timestamp.n + '}}}}';
        return this.requestJsonString(requestJson).then((response) => {
            return EmscriptenPluginServer.responseToFeatureSet(response);
        });
    }

    finish(pluginHandle: number): Promise<Feature[][]> {
        return this.request({type: 'finish', content: {pluginHandle: pluginHandle}}).then((response) => {
            return EmscriptenPluginServer.responseToFeatureSet(response);
        });
    }
    
    private static responseToFeatureSet(response: Response): Feature[][] {
	//!!! not right, this will fail if the feature set has any "holes"
	// e.g. { "0": [{"values": []}], "2": [{"values": []}]}
        return Object.keys(response.content).map(
	    key => EmscriptenPluginServer.convertWireFeatureList(
		response.content[key]));
    }
}


