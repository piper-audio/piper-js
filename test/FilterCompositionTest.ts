/**
 * Created by lucas on 11/10/2016.
 */
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.should();
chai.use(chaiAsPromised);
import {
    ProcessRequest, ProcessResponse, ListRequest,
    ListResponse, LoadRequest, LoadResponse, ConfigurationRequest,
    ConfigurationResponse, FinishResponse, FinishRequest, Service
} from "../src/Piper";
import {EmscriptenProxy} from "../src/EmscriptenProxy";
import VampTestPluginModule = require("../ext/VampTestPlugin");
import {EmscriptenModule} from "../src/Emscripten";
import {AdapterFlags} from "../src/FeatureExtractor";

type EmscriptenRawCall = (handle: number, bufs: number, sec: number, nsec: number) => number;

interface EmscriptenRawRequest {
    handle: number;
    bufs: number;
    sec: number;
    nsec: number;
}

type EmscriptenRawResponse = string;

export type ServiceFunc<Request, Response> = (req: Request) => Promise<Response>;
export type ListService = ServiceFunc<ListRequest, ListResponse>;
export type LoadService = ServiceFunc<LoadRequest, LoadResponse>;
export type ConfigurationService = ServiceFunc<ConfigurationRequest, ConfigurationResponse>;
export type ProcessService = ServiceFunc<ProcessRequest, ProcessResponse>;
export type FinishService = ServiceFunc<FinishRequest, FinishResponse>;

export type Filter<ReqIn, RepOut, ReqOut, RepIn>
    = (request: ReqIn, service: ServiceFunc<ReqOut, RepIn>) => Promise<RepOut>;

export type SimpleFilter<Req, Res> = Filter<Req, Res, Req, Res>;

function TimeoutFilter<Req, Res>(timeout: number): SimpleFilter<Req, Res> {
    return (request: Req, service: ServiceFunc<Req, Res>): Promise<Res> => {
        return Promise.race([
            new Promise((resolve, reject) => { setTimeout(reject, timeout, "Timed out") }),
            service(request)
        ]);
    }
}

function DelayFilter<Req, Res>(delayMs: number): SimpleFilter<Req, Res> {
    return (request: Req, service: ServiceFunc<Req, Res>): Promise<Res> => {
        return new Promise<Res>(resolve => setTimeout(resolve, delayMs, service(request)));
    }
}

// RawProcessFilter maps a Service[ProcessRequest, Process Response] to a Service[EmscriptenRawRequest, EmscriptenRawResponse]
const RawProcessFilter: Filter<EmscriptenRawRequest, EmscriptenRawResponse, ProcessRequest, ProcessResponse>
    = (request: EmscriptenRawRequest, service: ServiceFunc<ProcessRequest, ProcessResponse>): Promise<EmscriptenRawResponse> => {

    return Promise.resolve(1);
};

// maps a Service[ProcessRequest, EmscriptenRawResponse] to a Service[ProcessRequest, Process Response]
const EmscriptenProcessFilter: Filter<ProcessRequest, ProcessResponse, ProcessRequest, EmscriptenRawResponse>
    = (request: ProcessRequest, service: ServiceFunc<ProcessRequest, EmscriptenRawResponse>): Promise<ProcessResponse> => {
    return service(request).then((response: EmscriptenRawResponse) => {
        return JSON.parse(response);
    });
};

type Pointer = number;

const EmscriptenProcessService: (emscripten: EmscriptenModule) => ServiceFunc<ProcessRequest, string>
    = (emscripten: EmscriptenModule) => (request: ProcessRequest): Promise<string> => {

    const doProcess: EmscriptenRawCall = emscripten.cwrap(
        "vampipeProcessRaw",
        "number",
        ["number", "number", "number", "number"]
    ) as EmscriptenRawCall;
    const freeJson = emscripten.cwrap("vampipeFreeJson", "void", ["number"]) as (ptr: number) => void;

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

    // pointer to string
    const jsonString: string = emscripten.Pointer_stringify(responseJson);
    freeJson(responseJson);
    return Promise.resolve(jsonString);
};

function FilteredSimpleService<Req, Rep>(filter: SimpleFilter<Req, Rep>, service: ServiceFunc<Req, Rep>): ServiceFunc<Req, Rep> {
    return (request: Req) => filter(request, service);
}

function FilteredService<ReqIn, RepOut, ReqOut, RepIn>(filter: Filter<ReqIn, RepOut, ReqOut, RepIn>, service: ServiceFunc<ReqOut, RepIn>)
: ServiceFunc<ReqIn, RepOut> {
    return (request: ReqIn) => filter(request, service);
}

describe("Filter", () => {
    it("Should be composable", () => {
        const plugins: EmscriptenModule = VampTestPluginModule();
        const client: Service = new EmscriptenProxy(plugins);
        const list: ListService = (request) => client.list(request);
        const load: LoadService = (request) => client.load(request);
        const configure: ConfigurationService = (request) => client.configure(request);
        const process: ProcessService = FilteredService(EmscriptenProcessFilter, EmscriptenProcessService(plugins));

        const longService: ListService = FilteredSimpleService(DelayFilter(10), list);
        const timedOutService: ListService = FilteredSimpleService(TimeoutFilter(30), longService);

        return list({})
            .then(available => {
                return {
                    key: available.available.pop().key,
                    inputSampleRate: 8,
                    adapterFlags: [AdapterFlags.AdaptAllSafe]
                }
            })
            .then(load).then(response => {
                return {
                    handle: response.handle,
                    configuration: {channelCount: 1, stepSize: 8, blockSize: 8}
                }
            })
            .then(configure).then(response => {
                return {
                    handle: response.handle,
                    processInput: {
                        timestamp: {s: 0, n: 0},
                        inputBuffers: [new Float32Array([1, 2, 3, 4, 5, 6, 7, 8])]
                    }
                } as ProcessRequest
            }).then(process).should.eventually.eql({});
    });
});