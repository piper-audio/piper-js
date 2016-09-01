/**
 * Created by lucast on 31/08/2016.
 */
import {
    PluginServer,
    StaticData,
    LoadRequest, LoadResponse,
    ConfigurationRequest, ConfigurationResponse,
    ProcessRequest,
    Response, Request
} from './PluginServer';
import {Feature} from "./Feature";
import VamPipeServer = require('../ext/ExampleModule');
import {Allocator, EmscriptenModule} from "./Emscripten";

export class EmscriptenPluginServer implements PluginServer {
    private server: EmscriptenModule;
    private doRequest: (ptr: number) => number;
    private freeJson: (ptr: number) => void;

    constructor() {
        this.server = VamPipeServer();
        this.doRequest = this.server.cwrap('vampipeRequestJson', 'number', ['number']) as (ptr: number) => number;
        this.freeJson =  this.server.cwrap('vampipeFreeJson', 'void', ['number']) as (ptr: number) => void;
    }

    private request(request: Request): Promise<Response> {
        return new Promise<Response>((resolve) => {
            const requestJson: string = JSON.stringify(request);
            const requestJsonPtr: number = this.server.allocate(this.server.intArrayFromString(requestJson), 'i8', Allocator.ALLOC_NORMAL);
            const responseJsonPtr: number = this.doRequest(requestJsonPtr);
            this.server._free(requestJsonPtr);
            var response: Response = JSON.parse(this.server.Pointer_stringify(responseJsonPtr));
            this.freeJson(responseJsonPtr);
            resolve(response);
        });
    }

    listPlugins(): Promise<StaticData[]> {
        return this.request({"type": "list"} as Request).then((response) => {
            if (!response.success) throw new Error(response.errorText);
            return response.content.plugins as StaticData[];
        });
    }

    loadPlugin(request: LoadRequest): Promise<LoadResponse> {
        return undefined;
    }

    configurePlugin(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return undefined;
    }

    process(request: ProcessRequest): Promise<Feature[]> {
        return undefined;
    }

    finish(pluginHandle: number): Promise<Feature[]> {
        return undefined;
    }
}


