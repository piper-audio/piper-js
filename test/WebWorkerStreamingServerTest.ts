import {StreamingResponse, StreamingService} from "../src/StreamingService";
import {ListRequest, ListResponse} from "../src/Piper";
import {SimpleRequest, SimpleResponse} from "../src/HigherLevelUtilities";
import {Observable} from "rxjs/Observable";
import "rxjs/add/observable/of";
import "rxjs/add/observable/throw";
import * as chai from "chai";
import {
    DedicatedWorkerGlobalScope,
    WebWorkerStreamingServer
} from "../src/servers/WebWorkerStreamingServer";
import {RequestMessage} from "../src/protocols/WebWorkerProtocol";

// WebWorkerStreamingService contains most of the server logic (already tested.)

// Here, we only need to test that the hidden protocol of the workers
// is correctly implemented (as it hasn't been abstracted and tested elsewhere)

interface Mock {
    wasCalledWith(request: ListRequest | SimpleRequest,
                  method: "list" | "collect" | "process"): boolean;
}

class MockService implements StreamingService, Mock {
    private callLog: any;
    private nBlocks: number;

    constructor(nBlocks = 4) {
        this.callLog = {
            list: [],
            process: [],
            collect: []
        };
        this.nBlocks = nBlocks;
    }

    list(request: ListRequest): Promise<ListResponse> {
        this.callLog.list.push(request);
        return Promise.resolve(null);
    }

    process(request: SimpleRequest): Observable<StreamingResponse> {
        this.callLog.process.push(request);
        return this.createFakeObservable();
    }

    collect(request: SimpleRequest): Observable<StreamingResponse> {
        this.callLog.collect.push(request);
        return this.createFakeObservable();
    }

    wasCalledWith(request: ListRequest | SimpleRequest,
                  method: "list" | "collect" | "process"): boolean {
        return typeof this.callLog[method].find((val: any) => {
                try {
                    chai.expect(val).to.eql(request);
                    return true;
                } catch (e) {
                    return false;
                }
            }) !== "undefined";
    }

    private createFakeObservable(): Observable<StreamingResponse> {
        const response: SimpleResponse = {
            features: {
                shape: "vector",
                data: Float32Array.of(1, 1, 1, 1),
            },
            outputDescriptor: {
                basic: {
                    name: "fake feature",
                    description: "nonsense!",
                    identifier: "stub-stub-stub"
                },
                configured: {
                    binCount: 1,
                    binNames: [],
                    hasDuration: false,
                    sampleRate: 0,
                    sampleType: 0
                }
            }
        };
        let blocks = [];
        for (let i = 0; i < this.nBlocks; ++i)
            blocks.push(response);
        return Observable.of(...blocks);
    }
}

type MessageHandler = (ev: MessageEvent) => any;
class StubWorkerScope implements DedicatedWorkerGlobalScope {
    private responseHandler: MessageHandler;
    onmessage: MessageHandler;

    constructor(responseHandler: MessageHandler) {
        this.responseHandler = responseHandler;
    }

    postMessage(data: any): void {
        this.responseHandler({
            data: data
        } as any);
    }

    importScripts(uri: string): void {}

    sendMessage(data: any): void {
        this.onmessage({
            data: data
        } as MessageEvent);
    }
}

type ExpectationHandler = (service: StreamingService & Mock,
                           done: MochaDone) => (e: any) => void;
function verifyExpectations(message: RequestMessage<any>,
                            testHandler: ExpectationHandler,
                            done: MochaDone): void {
    const service = new MockService();
    const workerScope = new StubWorkerScope(testHandler(service, done));
    new WebWorkerStreamingServer(workerScope, service);
    workerScope.sendMessage(message);
}

describe("WebWorkerStreamingServer", () => {
    it("leaves existing worker onmessage intact", done => {
        const service = new MockService();
        const workerScope = new StubWorkerScope((ev) => {
            try {
                chai.expect(ev.data.id).to.eql("stub");
                done();
            } catch (e) {
                done(e);
            }
        });
        workerScope.onmessage = (ev) => {
            ev.data.id = "stub";
        };
        new WebWorkerStreamingServer(workerScope, service);
        workerScope.sendMessage({
            id: "0",
            method: "list",
            params: {from: []}
        });
    });

    it("Correctly routes list requests", done => {
        const message: RequestMessage<ListRequest> = {
            id: "0",
            method: "list",
            params: {from: []}
        };

        verifyExpectations(message, (service, done) => () => {
            try {
                chai.expect(
                    service.wasCalledWith(message.params, "list")
                ).to.be.true;
                done();
            } catch (e) {
                done(e);
            }
        }, done);
    });

    it("Sends error messages for invalid list requests", done => {
        let errors: string[] = [];
        const doneLog: MochaDone = (err) => {
            if (err) {
                errors.push(err);
            }
        };
        let messages: RequestMessage<any>[] = [];

        const logHandler: ExpectationHandler = (serviceMock, done) => (e) => {
            if (e.data.error && e.data.error.message) {
                done(e.data.error.message);
            } else {
                done();
            }
        };

        messages.push({
            id: "0",
            method: "not-real",
            params: {}
        }  as any);
        messages.push({} as any);
        messages.push({
            id: "0"
        }  as any);
        messages.push({
            method: "list"
        }  as any);
        messages.push({
            params: {}
        }  as any);

        for (let message of messages) {
            verifyExpectations(
                message,
                logHandler,
                doneLog
            );
        }

        const expectationsMet = errors.length === messages.length;
        if (expectationsMet) {
            done();
        } else {
            done(new Error(`Only ${errors.length}/${messages.length} errors`));
        }
    });

    const testStreamingMethod: (method: "process" | "collect",
                                done: MochaDone) => void =
        (method, done) => {
            const message: RequestMessage<SimpleRequest> = {
                id: "0",
                method: method,
                params: {
                    audioData: [new Float32Array(12)],
                    audioFormat: {
                        channelCount: 1,
                        sampleRate: 4,
                        length: 12,
                    },
                    key: "stub"
                }
            };
            let blockCount = 0;
            verifyExpectations(
                message,
                (service, done) => (e) => {
                    try {
                        blockCount++;
                        if (blockCount === 5) {
                            chai.expect(
                                e.data.method
                            ).to.eql("finish");
                            done();
                        } else {
                            chai.expect(
                                service.wasCalledWith(
                                    message.params,
                                    method
                                )
                            ).to.be.true;
                            chai.expect(
                                e.data.method
                            ).to.eql(method);
                        }
                    } catch (e) {
                        done(e);
                    }
                },
                done
            );
        };

    it("Correctly routes process requests", done => {
        testStreamingMethod("process", done);
    });

    it("Correctly routes collect requests", done => {
        testStreamingMethod("collect", done);
    });

    it("Forwards errors thrown by the service as error responses", done => {
        const throwingService: StreamingService = {
            list: (req) => Promise.reject("Go directly to jail."),
            process: (req) => Observable.throw("Do not pass go."),
            collect: (req) => Observable.throw("Do not collect $200.")
        };
        type ExtractMethod = "process" | "collect";
        const getSimpleRequestMessage =
            (method: ExtractMethod): RequestMessage<SimpleRequest> => ({
                id: "0",
                method: method,
                params: {
                    audioData: [new Float32Array(12)],
                    audioFormat: {
                        channelCount: 1,
                        sampleRate: 4,
                        length: 12,
                    },
                    key: "stub"
                }
            });
        let expectedResponseMap: any = {
            list: "Go directly to jail.",
            process: "Do not pass go.",
            collect: "Do not collect $200."
        };

        const messages: any[] = [
            {
                id: "0",
                method: "list",
                params: {from: []}
            },
            {
                id: "0",
                method: "process",
                params: getSimpleRequestMessage("process")
            },
            {
                id: "0",
                method: "collect",
                params: getSimpleRequestMessage("collect")
            }
        ];

        let nMessages = 0;
        const expectations: any = (ev: MessageEvent) => {
            const message: any = ev.data;
            const expectedResponse = expectedResponseMap[message.method];
            chai.expect(expectedResponse).to.exist;
            chai.expect(message.error.message).to.eql(expectedResponse);
            if (++nMessages === messages.length) {
                done();
            }
        };
        const workerScope = new StubWorkerScope(expectations);
        new WebWorkerStreamingServer(workerScope, throwingService);
        for (let message of messages) {
            workerScope.sendMessage(message);
        }
    });
});
