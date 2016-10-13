/**
 * Created by lucas on 11/10/2016.
 */
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {
    SimpleFilter, ServiceFunc, ListService,
    ListRequest, ListResponse, composeSimple
} from "../src/Piper";
import {MetaDataStub} from "./fixtures/FeatureExtractorStub";
chai.should();
chai.use(chaiAsPromised);

function timeout<Req, Res>(timeout: number): SimpleFilter<Req, Res> {
    return (request: Req, service: ServiceFunc<Req, Res>): Promise<Res> => {
        return Promise.race(
            [
                new Promise((resolve, reject) => {
                    setTimeout(reject, timeout, "Timed out")
                }),
                service(request)
            ]
        );
    }
}

function delay<Req, Res>(delayMs: number): SimpleFilter<Req, Res> {
    return (request: Req, service: ServiceFunc<Req, Res>)
        : Promise<Res> => new Promise<Res>(resolve => {
            setTimeout(resolve, delayMs, service(request))
        });
}

describe("Filter", () => {
    it("Should be composable", () => {
        const list: ListService = (request: ListRequest): Promise<ListResponse> => {
            return Promise.resolve({
                available: [MetaDataStub]
            });
        };

        const longService: ListService = composeSimple(delay(60), list);
        const timedOutService: ListService = composeSimple(
            timeout(30),
            longService
        );

        return timedOutService({}).should.eventually.be.rejected;
    })
});