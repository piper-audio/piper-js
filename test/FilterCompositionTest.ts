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

type EmscriptenRawCall = (handle: number, bufs: number, sec: number, nsec: number) => number;
interface EmscriptenRawParams {
    handle: number;
    bufs: number;
    sec: number;
    nsec: number;
}

const RawProcessFilter: Filter<EmscriptenRawParams, number, ProcessRequest, ProcessResponse>
    = (request, service): Promise<number> => {
    return Promise.resolve(1);
};

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

// function compose(filter: Filter<any, any, any, any>, )

describe("Filter", () => {
    it("Should be composable", () => {
        const client: Service = new EmscriptenProxy(VampTestPluginModule());
        const timeoutFilter = TimeoutFilter<ListRequest, ListResponse>(1);
        const service: ListService = (request) => client.list(request);
        return timeoutFilter({}, service).should.eventually.eql({});
    });
});