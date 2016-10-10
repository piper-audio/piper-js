/**
 * Created by lucast on 16/09/2016.
 */
import {EmscriptenModule, Allocator} from "./Emscripten";
import {
    ListRequest,
    ListResponse,
    LoadRequest,
    LoadResponse,
    ProcessRequest,
    ProcessResponse,
    ConfigurationRequest,
    ConfigurationResponse,
    FinishRequest,
    FinishResponse,
    Transport,
    TransportData,
    Protocol, Service
} from "./Piper";
import {JsonProtocol} from "./JsonProtocol";

type Pointer = number;

class EmscriptenForwardingTransport implements Transport {
    private emscripten: EmscriptenModule;
    private inData: Promise<TransportData>;
    private outData: TransportData;
    private freeJson: (ptr: number) => void;
    private doRequest: (ptr: number) => number;

    constructor(emscripten: EmscriptenModule) {
        this.emscripten = emscripten;
        this.freeJson = this.emscripten.cwrap("vampipeFreeJson", "void", ["number"]) as (ptr: number) => void;
        this.doRequest = this.emscripten.cwrap("vampipeRequestJson", "number", ["number"]) as (ptr: number) => number;
        this.inData = Promise.resolve("");
        this.outData = "";
    }

    read(): Promise<TransportData> {
        return this.inData.then(request => {
            const requestJson: Pointer = this.emscripten.allocate(
                this.emscripten.intArrayFromString(request), "i8",
                Allocator.ALLOC_NORMAL);

            const responseJson: Pointer = this.doRequest(requestJson);
            this.emscripten._free(requestJson);

            const jsonString: string = this.emscripten.Pointer_stringify(responseJson);
            this.freeJson(responseJson);
            return jsonString;
        });
    }

    write(data: TransportData): void {
        this.outData = data;
    }

    flush(): void {
        this.inData = Promise.resolve(this.outData);
    }

}

class JsonRawProcessProtocol extends JsonProtocol {
    writeProcessRequest(request: ProcessRequest): void {
        this.transport.write("");
    }
}

export class EmscriptenProxy implements Service {

    private emscripten: EmscriptenModule;
    private doProcess: (handle: number, bufs: number, sec: number, nsec: number) => number;
    private freeJson: (ptr: number) => void;
    private protocol: Protocol;

    constructor(pluginModule: EmscriptenModule) {
        this.emscripten = pluginModule;
        this.doProcess = this.emscripten.cwrap("vampipeProcessRaw", "number", ["number", "number", "number", "number"]) as (handle: number, bufs: number, sec: number, nsec: number) => number;
        this.freeJson = this.emscripten.cwrap("vampipeFreeJson", "void", ["number"]) as (ptr: number) => void;
        this.protocol = new JsonProtocol(new EmscriptenForwardingTransport(pluginModule));
    }

    list(request: ListRequest): Promise<ListResponse> {
        this.protocol.writeListRequest(request);
        this.protocol.transport.flush();
        return this.protocol.readListResponse();
    }

    load(request: LoadRequest): Promise<LoadResponse> {
        this.protocol.writeLoadRequest(request);
        this.protocol.transport.flush();
        return this.protocol.readLoadResponse();
    }

    configure(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        this.protocol.writeConfigurationRequest(request);
        this.protocol.transport.flush();
        return this.protocol.readConfigurationResponse();
    }

    process(request: ProcessRequest): Promise<ProcessResponse> {
        this.protocol.writeProcessRequest(request);
        this.protocol.transport.flush();
        return this.protocol.readProcessResponse();
    }

    finish(request: FinishRequest): Promise<FinishResponse> {
        this.protocol.writeFinishRequest(request);
        this.protocol.transport.flush();
        return this.protocol.readFinishResponse();
    }

    private handleRawProcess(request: ProcessRequest): Pointer {
        const nChannels: number = request.processInput.inputBuffers.length;
        const nFrames: number = request.processInput.inputBuffers[0].length;

        const buffersPtr: Pointer = this.emscripten._malloc(nChannels * 4);
        const buffers: Uint32Array = new Uint32Array(
            this.emscripten.HEAPU8.buffer, buffersPtr, nChannels);

        for (let i = 0; i < nChannels; ++i) {
            const framesPtr: Pointer = this.emscripten._malloc(nFrames * 4);
            const frames: Float32Array = new Float32Array(
                this.emscripten.HEAPU8.buffer, framesPtr, nFrames);
            frames.set(request.processInput.inputBuffers[i]);
            buffers[i] = framesPtr;
        }

        const responseJson: Pointer = this.doProcess(
            request.handle,
            buffersPtr,
            request.processInput.timestamp.s,
            request.processInput.timestamp.n);

        for (let i = 0; i < nChannels; ++i) {
            this.emscripten._free(buffers[i]);
        }
        this.emscripten._free(buffersPtr);

        return responseJson;
    }
}
