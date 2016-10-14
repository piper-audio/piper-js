/**
 * Created by lucast on 16/09/2016.
 */
import {EmscriptenModule, Allocator} from "./Emscripten";
import {
    ProcessRequest,
    ServiceFunc, Service, ListRequest, ListResponse, LoadResponse, LoadRequest,
    ConfigurationRequest, ConfigurationResponse, ProcessResponse,
    FinishResponse, FinishRequest, compose
} from "./Piper";
import {
    deserialiseJsonListResponse,
    serialiseJsonListRequest, deserialiseJsonLoadResponse,
    serialiseJsonLoadRequest, deserialiseJsonConfigurationResponse,
    serialiseJsonConfigurationRequest, deserialiseJsonProcessResponse,
    deserialiseJsonFinishResponse, serialiseJsonFinishRequest
} from "./JsonProtocol";

export class EmscriptenProxy implements Service {
    private module: EmscriptenModule;

    constructor(module: EmscriptenModule) {
        this.module = module;
    }

    list(request: ListRequest): Promise<ListResponse> {
        return compose(
            deserialiseJsonListResponse, compose(
                serialiseJsonListRequest, emscriptenService(this.module)
            )
        )(request);
    }

    load(request: LoadRequest): Promise<LoadResponse> {
        return compose(
            deserialiseJsonLoadResponse, compose(
                serialiseJsonLoadRequest, emscriptenService(this.module)
            )
        )(request);
    }

    configure(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return compose(
            deserialiseJsonConfigurationResponse, compose(
                serialiseJsonConfigurationRequest, emscriptenService(this.module)
            )
        )(request);
    }

    process(request: ProcessRequest): Promise<ProcessResponse> {
        return compose(
            deserialiseJsonProcessResponse,
            emscriptenProcess(this.module)
        )(request);
    }

    finish(request: FinishRequest): Promise<FinishResponse> {
        return compose(
            deserialiseJsonFinishResponse, compose(
                serialiseJsonFinishRequest, emscriptenService(this.module)
            )
        )(request);
    }
}

const freeJson = (emscripten: EmscriptenModule, ptr: Pointer): void => emscripten.ccall(
    "piperFreeJson",
    "void",
    ["number"],
    [ptr]
);

type Pointer = number;

function emscriptenService(emscripten: EmscriptenModule)
: ServiceFunc<string, string> {
    return (request: string): Promise<string> => {

        const doRequest = emscripten.cwrap(
            "piperRequestJson",
            "number",
            ["number"]
        ) as (ptr: number) => number;

        const requestJson: Pointer = emscripten.allocate(
            emscripten.intArrayFromString(request), "i8",
            Allocator.ALLOC_NORMAL);

        const responseJson: Pointer = doRequest(requestJson);
        emscripten._free(requestJson);

        const jsonString: string = emscripten.Pointer_stringify(responseJson);
        freeJson(emscripten, responseJson);
        return Promise.resolve(jsonString);
    }
}

const emscriptenProcess
    : (emscripten: EmscriptenModule) => ServiceFunc<ProcessRequest, string>
    = (emscripten: EmscriptenModule) =>
    (request: ProcessRequest): Promise<string> => {

        const doProcess = emscripten.cwrap(
            "piperProcessRaw",
            "number",
            ["number", "number", "number", "number"]
        ) as (handle: number, bufs: number, sec: number, nsec: number) => number;

        const nChannels: number = request.processInput.inputBuffers.length;
        const nFrames: number = request.processInput.inputBuffers[0].length;
        const buffersPtr: Pointer = emscripten._malloc(nChannels * 4);
        const buffers: Uint32Array = new Uint32Array(
            emscripten.HEAPU8.buffer, buffersPtr, nChannels);

        for (let i = 0; i < nChannels; ++i) {
            const framesPtr: Pointer = emscripten._malloc(nFrames * 4);
            const frames: Float32Array = new Float32Array(
                emscripten.HEAPU8.buffer, framesPtr, nFrames);
            frames.set(request.processInput.inputBuffers[i]);
            buffers[i] = framesPtr;
        }

        const responseJson: Pointer = doProcess(
            request.handle,
            buffersPtr,
            request.processInput.timestamp.s,
            request.processInput.timestamp.n
        );

        for (let i = 0; i < nChannels; ++i) {
            emscripten._free(buffers[i]);
        }

        emscripten._free(buffersPtr);

        const jsonString: string = emscripten.Pointer_stringify(responseJson);
        freeJson(emscripten, responseJson);
        return Promise.resolve(jsonString);
    };