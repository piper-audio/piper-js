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
    private doRequest: Function;
    private freeJson: Function;

    constructor() {
        this.server = ExampleModule();
        this.doRequest = this.server.cwrap('vampipeRequestJson', 'number', ['number']);
        this.freeJson = this.server.cwrap('vampipeFreeJson', 'void', ['number']);
    }

    private request(request: Request): Response { // TODO this should be a Promise of a Request as this is the async work
        const jsonStr = JSON.stringify(request);
        const inCstr = this.server.allocate(this.server.intArrayFromString(jsonStr), 'i8', Allocator.ALLOC_NORMAL);
        const outCstr = this.doRequest(inCstr);
        this.server._free(inCstr);
        var response = JSON.parse(this.server.Pointer_stringify(outCstr));
        this.freeJson(outCstr);
        return <Response>response;
    }

    listPlugins(): Promise<StaticData[]> {
        return new Promise<StaticData[]>((resolve, reject) => { // TODO .then chain of this.request
            const response: Response = this.request(<Response>{"type": "list"});
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


