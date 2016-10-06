/**
 * Created by lucast on 16/09/2016.
 */
import {EmscriptenModule, Allocator} from "./Emscripten";
import {RpcResponse, RpcRequest, ModuleRequestHandler, ProcessRequest, ProcessEncoding} from "./ClientServer";

type Pointer = number;
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

    handle(request: RpcRequest): Promise<RpcResponse> {
        return new Promise<RpcResponse>((resolve, reject) => {

	    const responseJson: Pointer =
                (request.method === "process") ? this.processRaw(request.params) : this.processRequest(request);

            const responseJstr = this.server.Pointer_stringify(responseJson);
            const response: RpcResponse = JSON.parse(responseJstr);
            this.freeJson(responseJson);

            response.result ? resolve(response) : reject(response.error.message);
        });
    }

    getProcessEncoding(): ProcessEncoding {
        return ProcessEncoding.Raw;
    }

    private processRequest(request: RpcRequest): Pointer {
        const requestJson: Pointer = this.server.allocate(
            this.server.intArrayFromString(JSON.stringify(request)), "i8",
            Allocator.ALLOC_NORMAL);

        const responseJson: Pointer = this.doRequest(requestJson);
        this.server._free(requestJson);
        return responseJson;
    }

    private processRaw(request: ProcessRequest): Pointer {
        const nChannels: number = request.processInput.inputBuffers.length;
        const nFrames: number = request.processInput.inputBuffers[0].length;

        const buffersPtr: Pointer = this.server._malloc(nChannels * 4);
        const buffers: Uint32Array = new Uint32Array(
            this.server.HEAPU8.buffer, buffersPtr, nChannels);

        for (let i = 0; i < nChannels; ++i) {
            const framesPtr: Pointer = this.server._malloc(nFrames * 4);
            const frames: Float32Array = new Float32Array(
                this.server.HEAPU8.buffer, framesPtr, nFrames);
            frames.set(request.processInput.inputBuffers[i]);
            buffers[i] = framesPtr;
        }

        const responseJson: Pointer = this.doProcess(
            request.handle,
            buffersPtr,
            request.processInput.timestamp.s,
            request.processInput.timestamp.n);

        for (let i = 0; i < nChannels; ++i) {
            this.server._free(buffers[i]);
        }
        this.server._free(buffersPtr);

        return responseJson;
    }
}
