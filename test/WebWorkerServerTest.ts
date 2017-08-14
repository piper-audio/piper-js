import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.should();
chai.use(chaiAsPromised);
import {StubWorkerScope} from "./WebWorkerStreamingServerTest"
import {
    ConfigurationRequest,
    ConfigurationResponse,
    FinishRequest,
    ListRequest,
    ListResponse,
    LoadRequest,
    LoadResponse,
    OutputList,
    ProcessRequest,
    ProcessResponse,
    SynchronousService
} from "../src/core";
import {RequestMessage, WebMethod} from "../src/protocols/web-worker";
import {WebWorkerServer, WebWorkerService} from "../src/web-worker";
import {PassThroughExtractor} from "./fixtures/FrequencyDomainExtractorStub";
import {
    OneShotExtractionClient,
    OneShotExtractionScheme
} from "../src/one-shot";
import {countingIdProvider} from "../src/clients/web-worker-streaming";
import {DedicatedWorkerGlobalScope} from "../src/servers/web-worker-streaming";

type Request = ListRequest
    | ConfigurationRequest
    | LoadRequest
    | ProcessRequest
    | FinishRequest;
interface Mock {
    wasCalledWith(request: Request,
                  method: WebMethod): boolean;
    getCallLogFor(method: WebMethod): Request[];
}

class ThrowingService implements SynchronousService, Mock {
    getCallLogFor(method: WebMethod): Request[] {
        return undefined;
    }
    wasCalledWith(request: Request, method: WebMethod): boolean {
        throw new Error("Method not implemented.");
    }

    list(request: ListRequest): ListResponse {
        throw new Error("Method not implemented.");
    }

    load(request: LoadRequest): LoadResponse {
        throw new Error("Method not implemented.");
    }

    configure(request: ConfigurationRequest): ConfigurationResponse {
        throw new Error("Method not implemented.");
    }

    process(request: ProcessRequest): ProcessResponse {
        throw new Error("Method not implemented.");
    }

    finish(request: FinishRequest): ProcessResponse {
        throw new Error("Method not implemented.");
    }
}

class MockService implements SynchronousService, Mock {
    private callLog: any;

    constructor() {
        this.callLog = {
            list: [],
            process: [],
            configure: [],
            load: [],
            finish: []
        };
    }

    wasCalledWith(request: Request, method: WebMethod): boolean {
        return typeof this.callLog[method].find((val: any) => {
            try {
                chai.expect(val).to.eql(request);
                return true;
            } catch (e) {
                return false;
            }
        }) !== "undefined";
    }

    getCallLogFor(method: WebMethod): Request[] {
        return this.callLog[method];
    }

    list(request: ListRequest): ListResponse {
        this.callLog.list.push(request);
        return {available: [
            PassThroughExtractor.getMetaData()
        ]};
    }

    load(request: LoadRequest): LoadResponse {
        this.callLog.load.push(request);
        const extractor = new PassThroughExtractor();
        return {
            handle: 0,
            staticData: PassThroughExtractor.getMetaData(),
            defaultConfiguration: extractor.getDefaultConfiguration()
        };
    }

    configure(request: ConfigurationRequest): ConfigurationResponse {
        this.callLog.configure.push(request);
        const extractor = new PassThroughExtractor();
        const config = extractor.configure(request.configuration);
        const meta = PassThroughExtractor.getMetaData();
        const outputList: OutputList = meta.basicOutputInfo.map(info => {
            return Object.assign({
                basic: info,
                configured: config.outputs.get(info.identifier)
            }, meta.staticOutputInfo.has(info.identifier) ? {
                static: meta.staticOutputInfo.get(info.identifier)
            } : {});
        });
        return {
          handle: 0,
          framing: config.framing,
          outputList
        };
    }

    process(request: ProcessRequest): ProcessResponse {
        this.callLog.process.push(request);
        return {
            handle: 0,
            features: new Map()
        };
    }

    finish(request: FinishRequest): ProcessResponse {
        this.callLog.finish.push(request);
        return {
            handle: 0,
            features: new Map()
        };
    }
}

type ExpectationHandler = (service: SynchronousService & Mock,
                           done: MochaDone) => (e: any) => void;
function verifyExpectations(message: RequestMessage<any>,
                            testHandler: ExpectationHandler,
                            done: MochaDone,
                            service?: SynchronousService & Mock): void {
    service = service ? service : new MockService();
    const workerScope = new StubWorkerScope(testHandler(service, done));
    new WebWorkerServer(workerScope, () => service);
    workerScope.sendMessage(message);
}

describe('WebWorkerServer', () => {
    // straight from WebWorkerStreamingServerTest
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
        new WebWorkerServer(workerScope, () => service);
        workerScope.sendMessage({
            id: "0",
            method: "list",
            params: {from: []}
        });
    });

    it("Correctly routes requests", () => {
        const messages: RequestMessage<Request>[] = [
            {
                id: "0",
                method: "list",
                params: {from: []}
            },
            {
                id: "1",
                method: "load",
                params: {
                    key: 'stub',
                    inputSampleRate: 44100,
                    adapterFlags: []
                }
            },
            {
                id: "2",
                method: "configure",
                params: {
                    handle: 0,
                    configuration: {
                        channelCount: 1,
                        framing: {
                            stepSize: 512,
                            blockSize: 1024
                        }
                    }
                }
            },
            {
                id: "3",
                method: "process",
                params: {
                    handle: 0,
                    processInput: {
                        timestamp: {s: 0, n: 0},
                        inputBuffers: []
                    }
                }
            },
            {
                id: "4",
                method: "finish",
                params: {handle: 0}
            },
        ];
        let failed: boolean[] = [];
        const failLog: MochaDone = (err) => {
            if (err) {
                failed.push(err);
            }
        };

        for (let message of messages) {
            verifyExpectations(message, (service, done) => () => {
                if (service.wasCalledWith(message.params, message.method)) {
                    done();
                } else {
                    done(true);
                }
            }, failLog);
        }
        failed.length.should.eql(0);
    });

    it('sends error message on invalid request ', done => {
        verifyExpectations({
            id: null,
            method: null,
            params: null
        }, (service, done) => (e) => {
            try {
                chai.expect(e.data.error.message).to.eql('Invalid request');
                done();
            } catch (e) {
                done(e);
            }
        }, done, new ThrowingService());
    });

    it('forwards error throw internally by the service', done => {
        verifyExpectations({
            id: '0',
            method: 'list',
            params: {from: []}
        }, (service, done) => (e) => {
            try {
                chai.expect(e.data.error.message).to.eql('Method not implemented.');
                done();
            } catch (e) {
                done(e);
            }
        }, done, new ThrowingService());
    });

    it('calls process multiple times when inputBuffers > blockSize', () => {
        // easier to just do an integration test here
        const audioData = [Float32Array.of(
            -0.5, 0.5, 0.5, 0.5,
            0, 0, 0 , 0,
            0.5, 0.5, 0.5, 0.5,
            1, 1, 1, 1
        )];
        const audioFormat = {
            channelCount: 1,
            sampleRate: 16
        };
        const worker = new StubWorker();
        const mock = new MockService();
        const workerScope = new LocalStubWorkerScope(mock, worker);
        worker.setScope(workerScope);

        const client = new OneShotExtractionClient(
            new WebWorkerService(
                worker as any,
                countingIdProvider(0)
            ),
            OneShotExtractionScheme.REMOTE
        );

        // should probably actually add getting the configured framing
        // in the OneShotResponse, like for StreamingResponse
        const passThroughDefaultFraming = {blockSize: 4, stepSize: 2};

        return client.process({
            audioData,
            audioFormat,
            key: 'stub:passthrough',
            outputId: 'passthrough'
        }).then(res => {
            // empty array, just because stub process outputs nothing
            chai.expect(res.features.collected).to.eql([]);
            // verify process was at least called the right amount of times
            // for the data
            chai.expect(
                mock.getCallLogFor('process').length
            ).to.eql(audioData[0].length / passThroughDefaultFraming.stepSize);
        });
    });
});


class LocalStubWorkerScope implements DedicatedWorkerGlobalScope {
    private piperServer: WebWorkerServer;
    private worker: StubWorker;
    onmessage: (this: this, ev: MessageEvent) => any;

    constructor(service: SynchronousService, worker?: StubWorker) {
        this.piperServer = new WebWorkerServer(
            this,
            () => service
        );
        this.worker = worker;
    }

    postMessage(data: any): void {
        this.worker.onmessage({
            data
        } as any);
    }

    importScripts(uri: string): void {
        throw new Error("Method not implemented.");
    }
}

class StubWorker implements Partial<Worker> {
    private workerScope: LocalStubWorkerScope;

    constructor(workerScope?: LocalStubWorkerScope) {
        this.workerScope = workerScope;
    }

    setScope(workerScope: LocalStubWorkerScope) {
        this.workerScope = workerScope;
    }

    onmessage: (ev: MessageEvent) => any;

    postMessage(message: any, transfer?: any[]): void {
        this.workerScope.onmessage({
            data: message
        } as any);
    }
}