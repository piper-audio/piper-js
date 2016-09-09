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
    private doProcess: (handle: number, bufs: number, sec: number, nsec: number) => number;
    private freeJson: (ptr: number) => void;

    constructor() {
        this.server = VamPipeServer();
        this.doRequest = this.server.cwrap('vampipeRequestJson', 'number', ['number']) as (ptr: number) => number;
	this.doProcess = this.server.cwrap('vampipeProcess', 'number', ['number','number','number','number']) as (handle: number, bufs: number, sec: number, nsec: number) => number;
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
    
    processBase64(request: ProcessRequest): Promise<Feature[][]> {
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

    private fakevalues = "AAAAAAAAgDoAAAA7AABAOwAAgDsAAKA7AADAOwAA4DsAAAA8AAAQPAAAIDwAADA8AABAPAAAUDwAAGA8AABwPAAAgDwAAIg8AACQPAAAmDwAAKA8AACoPAAAsDwAALg8AADAPAAAyDwAANA8AADYPAAA4DwAAOg8AADwPAAA+DwAAAA9AAAEPQAACD0AAAw9AAAQPQAAFD0AABg9AAAcPQAAID0AACQ9AAAoPQAALD0AADA9AAA0PQAAOD0AADw9AABAPQAARD0AAEg9AABMPQAAUD0AAFQ9AABYPQAAXD0AAGA9AABkPQAAaD0AAGw9AABwPQAAdD0AAHg9AAB8PQAAgD0AAII9AACEPQAAhj0AAIg9AACKPQAAjD0AAI49AACQPQAAkj0AAJQ9AACWPQAAmD0AAJo9AACcPQAAnj0AAKA9AACiPQAApD0AAKY9AACoPQAAqj0AAKw9AACuPQAAsD0AALI9AAC0PQAAtj0AALg9AAC6PQAAvD0AAL49AADAPQAAwj0AAMQ9AADGPQAAyD0AAMo9AADMPQAAzj0AANA9AADSPQAA1D0AANY9AADYPQAA2j0AANw9AADePQAA4D0AAOI9AADkPQAA5j0AAOg9AADqPQAA7D0AAO49AADwPQAA8j0AAPQ9AAD2PQAA+D0AAPo9AAD8PQAA/j0AAAA+AAABPgAAAj4AAAM+AAAEPgAABT4AAAY+AAAHPgAACD4AAAk+AAAKPgAACz4AAAw+AAANPgAADj4AAA8+AAAQPgAAET4AABI+AAATPgAAFD4AABU+AAAWPgAAFz4AABg+AAAZPgAAGj4AABs+AAAcPgAAHT4AAB4+AAAfPgAAID4AACE+AAAiPgAAIz4AACQ+AAAlPgAAJj4AACc+AAAoPgAAKT4AACo+AAArPgAALD4AAC0+AAAuPgAALz4AADA+AAAxPgAAMj4AADM+AAA0PgAANT4AADY+AAA3PgAAOD4AADk+AAA6PgAAOz4AADw+AAA9PgAAPj4AAD8+AABAPgAAQT4AAEI+AABDPgAARD4AAEU+AABGPgAARz4AAEg+AABJPgAASj4AAEs+AABMPgAATT4AAE4+AABPPgAAUD4AAFE+AABSPgAAUz4AAFQ+AABVPgAAVj4AAFc+AABYPgAAWT4AAFo+AABbPgAAXD4AAF0+AABePgAAXz4AAGA+AABhPgAAYj4AAGM+AABkPgAAZT4AAGY+AABnPgAAaD4AAGk+AABqPgAAaz4AAGw+AABtPgAAbj4AAG8+AABwPgAAcT4AAHI+AABzPgAAdD4AAHU+AAB2PgAAdz4AAHg+AAB5PgAAej4AAHs+AAB8PgAAfT4AAH4+AAB/PgAAgD4AgIA+AACBPgCAgT4AAII+AICCPgAAgz4AgIM+AACEPgCAhD4AAIU+AICFPgAAhj4AgIY+AACHPgCAhz4AAIg+AICIPgAAiT4AgIk+AACKPgCAij4AAIs+AICLPgAAjD4AgIw+AACNPgCAjT4AAI4+AICOPgAAjz4AgI8+AACQPgCAkD4AAJE+AICRPgAAkj4AgJI+AACTPgCAkz4AAJQ+AICUPgAAlT4AgJU+AACWPgCAlj4AAJc+AICXPgAAmD4AgJg+AACZPgCAmT4AAJo+AICaPgAAmz4AgJs+AACcPgCAnD4AAJ0+AICdPgAAnj4AgJ4+AACfPgCAnz4AAKA+AICgPgAAoT4AgKE+AACiPgCAoj4AAKM+AICjPgAApD4AgKQ+AAClPgCApT4AAKY+AICmPgAApz4AgKc+AACoPgCAqD4AAKk+AICpPgAAqj4AgKo+AACrPgCAqz4AAKw+AICsPgAArT4AgK0+AACuPgCArj4AAK8+AICvPgAAsD4AgLA+AACxPgCAsT4AALI+AICyPgAAsz4AgLM+AAC0PgCAtD4AALU+AIC1PgAAtj4AgLY+AAC3PgCAtz4AALg+AIC4PgAAuT4AgLk+AAC6PgCAuj4AALs+AIC7PgAAvD4AgLw+AAC9PgCAvT4AAL4+AIC+PgAAvz4AgL8+AADAPgCAwD4AAME+AIDBPgAAwj4AgMI+AADDPgCAwz4AAMQ+AIDEPgAAxT4AgMU+AADGPgCAxj4AAMc+AIDHPgAAyD4AgMg+AADJPgCAyT4AAMo+AIDKPgAAyz4AgMs+AADMPgCAzD4AAM0+AIDNPgAAzj4AgM4+AADPPgCAzz4AANA+AIDQPgAA0T4AgNE+AADSPgCA0j4AANM+AIDTPgAA1D4AgNQ+AADVPgCA1T4AANY+AIDWPgAA1z4AgNc+AADYPgCA2D4AANk+AIDZPgAA2j4AgNo+AADbPgCA2z4AANw+AIDcPgAA3T4AgN0+AADePgCA3j4AAN8+AIDfPgAA4D4AgOA+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";
    
    processFake(request: ProcessRequest): Promise<Feature[][]> {
	const encoded = request.processInput.inputBuffers.map(channel => {
	    return { b64values: this.fakevalues }
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


