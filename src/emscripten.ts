/**
 * Created by lucast on 16/09/2016.
 */
import {
    ProcessRequest,
    ListRequest,
    ListResponse,
    LoadResponse,
    LoadRequest,
    ConfigurationRequest,
    ConfigurationResponse,
    ProcessResponse,
    FinishResponse,
    FinishRequest,
    ExtractorHandle,
    SynchronousService,
    FeatureExtractor,
    AdapterFlags,
    ConfiguredOutputDescriptor,
    ExtractorConfiguration,
    Configuration
} from "./core";
import {
    Serialise, Parse
} from "./protocols/json";
import {
    ProcessInput} from "./core";
import {FeatureSet} from "./core";
import {FakeAsyncService} from "./core";

export interface EmscriptenModule {
    cwrap(ident: string, returnType: string, argTypes: string[]): Function;
    ccall(ident: string, returnType: string, argTypes: string[], args: any[]): any;
    intArrayFromString(stringy: string): number[];
    _malloc(sz: number): number;
    _free(ptr: number): void;
    HEAPU8: Uint8Array;
    allocate(slab: number[], type: string, allocator: Allocator): number;
    Pointer_stringify(ptr: number): string;
}

export enum Allocator {
    ALLOC_NORMAL,
    ALLOC_STACK,
    ALLOC_STATIC,
    ALLOC_DYNAMIC,
    ALLOC_NONE
}

export class EmscriptenFeatureExtractor extends FeatureExtractor {
    private module: EmscriptenModule;
    private handle: ExtractorHandle;
    private defaultConfig: Configuration;

    constructor(module: EmscriptenModule, sampleRate: number, pluginKey?: string) {
        super();
        this.module = module;
        pluginKey = pluginKey ? pluginKey : list(module, {}).available[0].key;
        const response: LoadResponse = Parse.LoadResponse(
            jsonRequest(module, Serialise.LoadRequest({
                key: pluginKey,
                inputSampleRate: sampleRate,
                adapterFlags: [AdapterFlags.AdaptAllSafe]
            }))
        );
        this.defaultConfig = response.defaultConfiguration;
        this.handle = response.handle;
    }

    configure(configuration: Configuration): ExtractorConfiguration {
        const response: ConfigurationResponse = Parse.ConfigurationResponse(
            jsonRequest(this.module, Serialise.ConfigurationRequest({
                handle: this.handle,
                configuration: configuration
            }))
        );
        return {
            outputs: new Map(
                response.outputList
                    .map(output => [output.basic.identifier, output.configured]) as any
            ) as Map<string, ConfiguredOutputDescriptor>,
            framing: response.framing
        };
    }

    getDefaultConfiguration(): Configuration {
        return this.defaultConfig;
    }

    process(block: ProcessInput): FeatureSet {
        return Parse.ProcessResponse(
            rawProcess(this.module, {
                handle: this.handle,
                processInput: block
            })
        ).features;
    }

    finish(): FeatureSet {
        const response: FinishResponse = Parse.FinishResponse(
            jsonRequest(this.module, Serialise.FinishRequest({handle: this.handle}))
        );
        return response.features;
    }
}

export class EmscriptenSynchronousService implements SynchronousService {
    private module: EmscriptenModule;

    constructor(module: EmscriptenModule) {
        this.module = module;
    }

    list(request: ListRequest): ListResponse {
        return list(this.module, request);
    }

    load(request: LoadRequest): LoadResponse {
        return Parse.LoadResponse(
            jsonRequest(this.module, Serialise.LoadRequest(request))
        );
    }

    configure(request: ConfigurationRequest): ConfigurationResponse {
        return Parse.ConfigurationResponse(
            jsonRequest(this.module, Serialise.ConfigurationRequest(request))
        );
    }

    process(request: ProcessRequest): ProcessResponse {
        return Parse.ProcessResponse(rawProcess(this.module, request));
    }

    finish(request: FinishRequest): ProcessResponse {
        return Parse.FinishResponse(
            jsonRequest(this.module, Serialise.FinishRequest(request))
        );
    }
}

export class EmscriptenService extends FakeAsyncService {
    constructor(module: EmscriptenModule) {
        super(new EmscriptenSynchronousService(module));
    }
}

export function list(module: EmscriptenModule, request: ListRequest): ListResponse {
    return Parse.ListResponse(jsonRequest(module, Serialise.ListRequest(request)));
}

const freeJson = (module: EmscriptenModule, ptr: Pointer): void => module.ccall(
    "piperFreeJson",
    "void",
    ["number"],
    [ptr]
);

type Pointer = number;

function jsonRequest(emscripten: EmscriptenModule, request: string): string {
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
    return jsonString;
}

function rawProcess(module: EmscriptenModule, request: ProcessRequest): string {
    const doProcess = module.cwrap(
        "piperProcessRaw",
        "number",
        ["number", "number", "number", "number"]
    ) as (handle: number, bufs: number, sec: number, nsec: number) => number;

    const nChannels: number = request.processInput.inputBuffers.length;
    const nFrames: number = request.processInput.inputBuffers[0].length;
    const buffersPtr: Pointer = module._malloc(nChannels * 4);
    const buffers: Uint32Array = new Uint32Array(
        module.HEAPU8.buffer, buffersPtr, nChannels);

    for (let i = 0; i < nChannels; ++i) {
        const framesPtr: Pointer = module._malloc(nFrames * 4);
        const frames: Float32Array = new Float32Array(
            module.HEAPU8.buffer, framesPtr, nFrames);
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
        module._free(buffers[i]);
    }

    module._free(buffersPtr);

    const jsonString: string = module.Pointer_stringify(responseJson);
    freeJson(module, responseJson);
    return jsonString;
}