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
            if (!response.success) throw new Error(response.errorText);
            resolve(response);
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

    processb64(request: ProcessRequest): Promise<Feature[][]> {
	// Request.inputBuffers is an array of { values } where each
	// values is a Float32Array. We want an array of base-64
	// encodings of the raw memory backing these typed arrays. We
	// assume byte order will be the same when the base-64 stuff
	// is decoded, but I guess that might not be true in a network
	// situation. The Float32Array docs say "If control over byte
	// order is needed, use DataView instead" so I guess that's a
	// !!! todo
	const encoded = request.processInput.inputBuffers.map(channel => {
	    const b64 = base64.fromByteArray(new Uint8Array(channel.values.buffer));
	    return { b64values: b64 }
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
        return Object.keys(response.content).map(key => response.content[key]);
    }
}


