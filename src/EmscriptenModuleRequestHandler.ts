/**
 * Created by lucast on 16/09/2016.
 */
import {EmscriptenModule, Allocator} from "./Emscripten";
import {Response, Request, ModuleRequestHandler, ProcessRequest} from "./ClientServer";

type ResponsePointer = number;
export class EmscriptenModuleRequestHandler implements ModuleRequestHandler {

    private server: EmscriptenModule;
    private doRequest: (ptr: number) => number;
    private doProcess: (handle: number, bufs: number, sec: number, nsec: number) => number;
    private freeJson: (ptr: number) => void;

    constructor(pluginModule: EmscriptenModule) {
        this.server = pluginModule;
        this.doRequest = this.server.cwrap("vampipeRequestJson", "number", ["number"]) as (ptr: number) => number;
        this.doProcess = this.server.cwrap("vampipeProcessRaw", "number", ["number", "number", "number", "number"]) as (handle: number, bufs: number, sec: number, nsec: number) => number;
        this.freeJson = this.server.cwrap("vampipeFreeJson", "void", ["number"]) as (ptr: number) => void;
    }

    handle(request: Request): Promise<Response> {
        return new Promise<Response>((resolve, reject) => {
            const responseJson: ResponsePointer =
                (request.type === "process") ? this.processRaw(request.content) : this.processRequest(request);

            const response: Response = JSON.parse(
                this.server.Pointer_stringify(responseJson));
            this.freeJson(responseJson);

            if (response.success) {
                resolve(response);
            } else {
                reject(response.errorText);
            }
        });
    }

    private processRequest(request: Request): ResponsePointer {
        const requestJson: string = JSON.stringify(request);
        const requestJsonPtr: number = this.server.allocate(
            this.server.intArrayFromString(requestJson), "i8",
            Allocator.ALLOC_NORMAL);

        const responseJsonPtr: number = this.doRequest(requestJsonPtr);
        this.server._free(requestJsonPtr);
        return responseJsonPtr;
    }

    private processRaw(request: ProcessRequest): ResponsePointer {
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

        return responseJsonPtr;
    }

}