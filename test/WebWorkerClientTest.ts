import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.should();
chai.use(chaiAsPromised);
import * as TinyWorker from "tiny-worker";
import {WebWorkerService} from "../src/web-worker";
import {
    countingIdProvider,
    RequestIdProvider
} from "../src/clients/web-worker-streaming";


function createStubWorker(work: string | WorkerFunction): Worker {
    let stubWorker = new TinyWorker(work);
    stubWorker.removeEventListener = () => {};
    return stubWorker;
}

describe('WebWorkerClient', () => {
    const singleIdProvider: RequestIdProvider = {
        next: () => ({
            done: true,
            value: "stub"
        })
    };
    it('throws error for invalid method in response', () => {
        const worker = createStubWorker(function () {
            this.onmessage = () => {
                this.postMessage({
                    id: "stub",
                    method: "process",
                    result: {
                        available: []
                    }
                });
            };
        });
        const service = new WebWorkerService(worker, singleIdProvider);
        return service.list({}).should.eventually.be.rejectedWith(
            'Invalid response method'
        );
    });
    it('throws error for invalid id in response', () => {
        const worker = createStubWorker(function () {
            this.onmessage = () => {
                this.postMessage({
                    id: "stubby",
                    method: "list",
                    result: {
                        available: []
                    }
                });
            };
        });
        const service = new WebWorkerService(worker, singleIdProvider);
        return service.list({}).should.eventually.be.rejectedWith(
            'Invalid response id'
        );
    });
    it('throws error when there is a pending request', () => {
        const worker = createStubWorker(function () {});
        const service = new WebWorkerService(worker, countingIdProvider(0));
        void service.list({});
        return service.list({}).should.eventually.be.rejectedWith(
            'Only one request can be processed at a time'
        );
    });
    it('can process successive requests', () => {
        const worker = createStubWorker(function () {
            this.onmessage = (message) => {
                const request = message.data;
                this.postMessage({
                    id: request.id,
                    method: request.method,
                    result: {
                        available: request.id !== '0' ? [
                            {
                                key: 'one',
                                basic: {
                                    identifier: 'stubone',
                                    name: 'Blah blah',
                                    description: 'not meaningful'

                                },
                                inputDomain: 0,
                                basicOutputInfo: [],
                                version: 1.0,
                                minChannelCount: 1,
                                maxChannelCount: 2
                            }
                        ] : []
                    }
                });
            };
        });
        const service = new WebWorkerService(worker, countingIdProvider(0));
        const doRequests = async () => {
            const responses = [];
            for (let request of [0, 1]) {
                const response = await service.list({});
                responses.push(response);
            }
            return responses;
        };
        return doRequests().should.eventually.eql([
            {available: []},
            {available: [
                {
                    key: 'one',
                    basic: {
                        identifier: 'stubone',
                        name: 'Blah blah',
                        description: 'not meaningful'

                    },
                    inputDomain: 0,
                    basicOutputInfo: [],
                    version: 1.0,
                    minChannelCount: 1,
                    maxChannelCount: 2
                }
            ]}
        ]);
    });

    it("rejects when error response received from worker", () => {
        const errorWorker = createStubWorker(function () {
            this.onmessage = (message) => {
                const request = message.data;
                this.postMessage({
                    id: request.id,
                    method: request.method,
                    error: {
                        code: 123,
                        message: "Oh, bother!"
                    }
                });
            };
        });
        const requestAll = async (requests: (() => Promise<any>)[]) => {
            const responses = [];
            for (let request of requests) {
                try {
                    const response = await request();
                    responses.push(response);
                } catch (e) {
                    responses.push(e);
                }
            }
            return responses;
        };
        const service = new WebWorkerService(
            errorWorker,
            singleIdProvider
        );
        return requestAll([
            () => service.list({}),
            () => service.load(null),
            () => service.configure(null),
            () => service.process(null),
            () => service.finish(null)
        ]).then(responses => {
            return responses.map(response => {
                return response instanceof Error
                    && response.message === '123: Oh, bother!';
            })
        }).should.eventually.eql([true, true, true, true, true]);
    });
});