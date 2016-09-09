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
import {Feature} from "./Feature";
import VamPipeServer = require('../ext/ExampleModule');
import {Allocator, EmscriptenModule} from "./Emscripten";
import base64 = require('base64-js');

export class EmscriptenPluginServer implements PluginServer {
    private server: EmscriptenModule;
    private doRequest: (ptr: number) => number;
    private freeJson: (ptr: number) => void;

    constructor() {
        this.server = VamPipeServer();
        this.doRequest = this.server.cwrap('vampipeRequestJson', 'number', ['number']) as (ptr: number) => number;
        this.freeJson = this.server.cwrap('vampipeFreeJson', 'void', ['number']) as (ptr: number) => void;
    }

    private request(request: Request): Promise<Response> {
        return new Promise<Response>((resolve) => {
            const requestJson: string = JSON.stringify(request);
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
        request.processInput.inputBuffers.forEach((val) => {
            (val as any).values = [...val.values]; // TODO is there a better way to change Float32Array's JSON representation
        });
        return this.request({type: 'process', content: request}).then((response) => {
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
	return base64.fromByteArray(new Uint8Array(values.buffer));
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

    private static convertFeatureValues(feature: Feature): Feature {

	// Just converts b64values to values, does nothing else at this point
	
	if (feature.b64values == null || // NB double-equals intended,
	                                 // want to check for null or undef
	    feature.b64values === "") {
	    return feature; // must be using the values array, or have no values
	} else {
	    return {
		timestamp: feature.timestamp,
		duration: feature.duration,
		label: feature.label,
		values: EmscriptenPluginServer.fromBase64(feature.b64values)
	    }
	};
    }

    private static convertFeatureList(features: Feature[]): Feature[] {
	return features.map(EmscriptenPluginServer.convertFeatureValues);
    }
    
    processb64(request: ProcessRequest): Promise<Feature[][]> {
	const encoded = request.processInput.inputBuffers.map(channel => {
	    return { b64values: EmscriptenPluginServer.toBase64(channel.values) }
	});
	const encReq = {
	    pluginHandle: request.pluginHandle,
	    processInput: {
		timestamp: request.processInput.timestamp,
		inputBuffers: encoded
	    }
	};
        return this.request({type: 'process', content: encReq }).then((response) => {
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
	    key => EmscriptenPluginServer.convertFeatureList(
		response.content[key]));
    }
}


