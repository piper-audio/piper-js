/**
 * Created by lucas on 10/04/2017.
 */
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.should();
chai.use(chaiAsPromised);
import * as TinyWorker from "tiny-worker";
import {
    countingIdProvider,
    RequestIdProvider,
    WebWorkerStreamingClient
} from "../src/client-stubs/WebWorkerStreamingClient";
import {StreamingResponse} from "../src/StreamingService";
import {FeatureList} from "../src/Feature";
import {ListResponse} from '../src/Piper';

function createStubWorker(work: string | WorkerFunction): Worker {
    let stubWorker = new TinyWorker(work);

    // tiny-worker hasn't fully implemented the Worker interface
    // need to polyfill / stub the removeEventListener for RxJs to work
    stubWorker.removeEventListener = () => {
    };
    return stubWorker;
}

describe("WebWorkerStreamingClient", () => {
    const singleIdProvider: RequestIdProvider = {
        next: () => ({
            done: true,
            value: "stub"
        })
    };
    it("can handle valid list messages from the worker", () => {
        const stubWorker = createStubWorker(function () {
            this.onmessage = () => {
                const stubListMessage = {
                    id: "stub",
                    method: "list",
                    result: {
                        available: {}
                    }
                };
                this.postMessage(stubListMessage);
            };
        });
        const client = new WebWorkerStreamingClient(
            stubWorker,
            singleIdProvider
        );
        return client.list({}).should.eventually.eql({available: {}});
    });

    it("rejects from list on mismatched id", () => {
        const stubWorker = createStubWorker(function () {
            this.onmessage = () => {
                const stubListMessage = {
                    id: "sonic",
                    method: "list",
                    result: {
                        available: {}
                    }
                };
                this.postMessage(stubListMessage);
            };
        });
        const singleIdProvider: RequestIdProvider = {
            next: () => ({
                done: true,
                value: "tails"
            })
        };
        const client = new WebWorkerStreamingClient(
            stubWorker,
            singleIdProvider
        );
        return client.list({}).should.eventually.be.rejectedWith(
            Error,
            "Invalid response id"
        );
    });

    it("rejects from list on mismatched method", () => {
        const stubWorker = createStubWorker(function () {
            this.onmessage = () => {
                this.postMessage({
                    id: "sonic",
                    method: "process",
                    result: {
                        available: {}
                    }
                });
            };
        });
        const singleIdProvider: RequestIdProvider = {
            next: () => ({
                done: true,
                value: "sonic"
            })
        };
        const client = new WebWorkerStreamingClient(
            stubWorker,
            singleIdProvider
        );
        return client.list({}).should.eventually.be.rejectedWith(
            Error,
            "Invalid response method"
        );
    });

    it("rejects from list on non well-formed response", () => {
        const executeList = (work: WorkerFunction): Promise<any> => {
            const nonConformingWorker = createStubWorker(work);
            return new Promise((res, rej) => {
                return new WebWorkerStreamingClient(
                    nonConformingWorker,
                    singleIdProvider
                ).list({}).then((val) => rej(
                    "Response was valid, it shouldn't be."
                )).catch(res); // invert the result
            });
        };
        const shouldFail = [
            executeList(function () {
                this.postMessage({
                    name: "Lucas Thompson",
                    position: "Software Engineer in Test"
                });
            }),
            executeList(function () {
                this.postMessage({
                    id: "stub",
                    method: "list"
                });
            }),
            executeList(function () {
                this.postMessage({
                    id: "stub"
                });
            }),
            executeList(function () {
                this.postMessage({});
            }),
            executeList(function () {
                this.postMessage("");
            })
        ];
        return Promise.all(
            shouldFail
        ).then(rejected => rejected.length === shouldFail.length)
            .should.eventually.be.true;
    });

    it("rejects from list when error response received from worker", () => {
        const errorWorker = createStubWorker(function () {
            this.postMessage({
                id: "stub",
                method: "list",
                error: {
                    code: 123,
                    message: "Oh, bother!"
                }
            });
        });
        return new WebWorkerStreamingClient(
            errorWorker,
            singleIdProvider
        ).list({}).should.eventually.be.rejectedWith(
            Error,
            "123: Oh, bother!"
        );
    });

    it("can handle streaming process messages from the worker", done => {
        const stubWorker = createStubWorker(function () {

            this.onmessage = (message) => {
                const request = message.data;
                const id = request.id;

                // tiny-worker screws up the Float32Array
                const audioData = request.params.audioData.map(
                    (c: any) => {
                        const arr = new Float32Array(Object.keys(c).length);
                        for (let i = 0; i < arr.length; ++i) {
                            arr[i] = c[i];
                        }
                        return arr;
                    }
                );
                const totalBlockCount = audioData[0].length;

                for (let i = 0; i < totalBlockCount; ++i) {
                    const count = request.params.audioData[0][i];
                    const data: FeatureList = [{
                        timestamp: {
                            s: 0,
                            n: 0
                        },
                        featureValues: Float32Array.of(count)
                    }];

                    const response: StreamingResponse = {
                        features: data,
                        configuration: {
                            outputDescriptor: {
                                basic: {
                                    identifier: "count",
                                    name: "Arbitrary count",
                                    description: "Sequence of integers for testing"
                                },
                                configured: {
                                    hasDuration: false,
                                    sampleType: 0
                                }
                            },
                            inputSampleRate: 0,
                            framing: {
                                stepSize: 0,
                                blockSize: 0
                            }
                        },
                        progress: {
                            processedBlockCount: i,
                            totalBlockCount: totalBlockCount
                        }
                    };

                    this.postMessage({
                        id: id,
                        method: "process",
                        result: response
                    });
                }
                this.postMessage({
                    id: id,
                    method: "finish",
                    result: {}
                });
            };
        });
        let featureValues: number[] = [];
        let nProcessed = 0;
        const expectedSequence = Float32Array.of(1, 2, 3, 4, 5);
        new WebWorkerStreamingClient(
            stubWorker,
            singleIdProvider
        ).process({
            audioData: [expectedSequence],
            audioFormat: {
                channelCount: 1,
                sampleRate: 4
            },
            key: "test",
            outputId: "count",
            blockSize: 1,
            stepSize: 1
        }).do(val => {
            try {
                val.progress.processedBlockCount.should.eql(nProcessed++)
            } catch (e) {
                done(e);
            }
        }).scan((acc, val) => {
                if (val.features) {
                    acc.push(
                        ((val.features)[0]).featureValues[0]
                    );
                }
                return featureValues;
            },
            featureValues
        ).subscribe(
            () => {},
            done,
            () => {
                try {
                    featureValues.should.eql([...expectedSequence]);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        )
    });

    it("can queue up multiple requests", () => {
        const stubWorker = createStubWorker(function () {
            const requestResolveTimes = [50, 100, 150];
            const responses: (ListResponse | StreamingResponse)[] = [
                {
                    available: [
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
                    ]
                },
                {
                    features: [],
                    configuration: {
                        outputDescriptor: {
                            basic: {
                                identifier: "nothing",
                                name: "Nothing!",
                                description: "Absolutely nothing!"
                            },
                            configured: {
                                hasDuration: false,
                                sampleType: 0
                            }
                        },
                        inputSampleRate: 0,
                        framing: {
                            stepSize: 0,
                            blockSize: 0
                        }
                    },
                    progress: {
                        processedBlockCount: 0,
                        totalBlockCount: 0
                    }
                },
                {
                    available: [
                        {
                            key: 'two',
                            basic: {
                                identifier: 'stubtwo',
                                name: 'Blah blah blah',
                                description: 'even less meaningful'

                            },
                            inputDomain: 0,
                            basicOutputInfo: [],
                            version: 2.0,
                            minChannelCount: 1,
                            maxChannelCount: 2
                        }
                    ]
                },
            ];
            this.onmessage = (message) => {
                const response = {
                    id: `${message.data.id}`,
                    method: message.data.method,
                    result: responses[message.data.id]
                };
                setTimeout(
                    () => {
                        this.postMessage(response);
                        if (response.method === 'process') {
                            this.postMessage({
                                id: response.id,
                                method: "finish",
                                result: {}
                            });
                        }
                    },
                    requestResolveTimes[message.data.id++]
                );
            };
        });
        const client = new WebWorkerStreamingClient(
            stubWorker,
            countingIdProvider(0)
        );

        // annoying duplication of the expected responses due to
        // the bodge in TinyWorker for instantiating a worker
        // (function body converted to a string and then eval-ed)
        return Promise.all([
            client.list({from: ['one']}),
            client.process({
                audioData: [Float32Array.of(1, 2, 3, 4, 5)],
                audioFormat: {
                    channelCount: 1,
                    sampleRate: 4
                },
                key: "test",
                outputId: "count",
                blockSize: 1,
                stepSize: 1
            }).toPromise(),
            client.list({from: ['two']}),
        ]).should.eventually.eql([
            {
                available: [
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
                ]
            },
            {
                features: [],
                configuration: {
                    outputDescriptor: {
                        basic: {
                            identifier: "nothing",
                            name: "Nothing!",
                            description: "Absolutely nothing!"
                        },
                        configured: {
                            hasDuration: false,
                            sampleType: 0
                        }
                    },
                    inputSampleRate: 0,
                    framing: {
                        stepSize: 0,
                        blockSize: 0
                    }
                },
                progress: {
                    processedBlockCount: 0,
                    totalBlockCount: 0
                }
            },
            {
                available: [
                    {
                        key: 'two',
                        basic: {
                            identifier: 'stubtwo',
                            name: 'Blah blah blah',
                            description: 'even less meaningful'

                        },
                        inputDomain: 0,
                        basicOutputInfo: [],
                        version: 2.0,
                        minChannelCount: 1,
                        maxChannelCount: 2
                    }
                ]
            },
        ]);
    });

    it("can process requests after receiving an error response", () => {
        const stubWorker = createStubWorker(function () {
            this.onmessage = (message) => {
                if (message.data.id === 'error') {
                    this.postMessage({
                        id: "error",
                        method: "list",
                        error: {
                            code: 123,
                            message: "Oh, bother!"
                        }
                    });
                } else {
                    this.postMessage({
                        id: "stub",
                        method: "list",
                        result: {
                            available: {}
                        }
                    })
                }
            };
        });
        const idProvider: RequestIdProvider = function* () {
            yield "error";
            yield "stub";
        }();
        const client = new WebWorkerStreamingClient(
            stubWorker,
            idProvider
        );
        return client.list({})
            .catch(() => client.list({}))
            .should.eventually.eql({available: {}});
    });
});
