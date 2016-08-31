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
import ExampleModule = require('../ext/ExampleModule');
import {Allocator, EmscriptenModule} from "./Emscripten";

export class EmscriptenPluginServer implements PluginServer {
    private server: EmscriptenModule;
    private doRequest: (ptr: number) => number;
    private freeJson: (ptr: number) => void;

    constructor() {
        this.server = ExampleModule();
        this.doRequest = this.server.cwrap('vampipeRequestJson', 'number', ['number']) as (ptr: number) => number;
        this.freeJson =  this.server.cwrap('vampipeFreeJson', 'void', ['number']) as (ptr: number) => void;
    }

    private request(request: Request): Response { // TODO this should be a Promise of a Request as this is the async work
        const requestJson: string = JSON.stringify(request);
        const requestJsonPtr: number = this.server.allocate(this.server.intArrayFromString(requestJson), 'i8', Allocator.ALLOC_NORMAL);
        const responseJsonPtr: number = this.doRequest(requestJsonPtr);
        this.server._free(requestJsonPtr);
        var response: Response = JSON.parse(this.server.Pointer_stringify(responseJsonPtr));
        this.freeJson(responseJsonPtr);
        return response;
    }

    listPlugins(): Promise<StaticData[]> {
        return new Promise<StaticData[]>((resolve, reject) => { // TODO .then chain of this.request
            const response: Response = this.request({"type": "list"} as Response);
            if (!response.success) reject(response.errorText);

            const pluginList: StaticData[] = response.content.plugins; // TODO this isn't declared in any type
            resolve(pluginList);
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


