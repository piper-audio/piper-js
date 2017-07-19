/**
 * Created by lucas on 23/11/2016.
 */
import * as chai from "chai";
import {segment} from "../src/audio";
import {
    ProcessRequest, ProcessResponse, ListRequest,
    ListResponse
} from "../src/core";
import {Serialise, Deserialise} from "../src/protocols/json";
import {FeatureList} from "../src/core";
import {InputDomain} from '../src/core';
chai.should();

describe("Serialise.ProcessRequest()", () => {
    it("can serialise input buffers using base-64 encoded strings, for sub-array views", () => {
        const audioData = [
            new Float32Array([
                0,0,0,0,
                1,1,1,1
            ])
        ];
        const framedBuffers = segment(4, 4, audioData);
        const expectedBase64 = [
            "AAAAAAAAAAAAAAAAAAAAAA==",
            "AACAPwAAgD8AAIA/AACAPw=="
        ];
        const expected = [
            [0, 0, 0, 0],
            [1, 1, 1, 1]
        ];
        const toProcessRequest = (frame: Float32Array[]): ProcessRequest => {
            return {
                handle: 1,
                processInput: {
                    timestamp: {s: 0, n: 0},
                    inputBuffers: frame
                }
            };
        };

        let index = 0;
        for (let frame of framedBuffers) {
            JSON.parse(Serialise.ProcessRequest(toProcessRequest(frame)))
                .params.processInput.inputBuffers[0]
                .should.eql(expectedBase64[index]);
            JSON.parse(Serialise.ProcessRequest(toProcessRequest(frame), false))
                .params.processInput.inputBuffers[0]
                .should.eql(expected[index++]);
        }
    });
});

describe("Deserialise.ProcessRequest()", () => {
    const expected: ProcessRequest = {
        handle: 2,
        processInput: {
            timestamp: {s: 0, n: 0},
            inputBuffers: [
                new Float32Array([0, 0, 0, 0]),
                new Float32Array([1, 1, 1, 1])
            ]
        }
    };
    const base64Request: any = {
        id: 1,
        method: "process",
        params: {
            handle: 2,
            processInput: {
                timestamp: {s: 0, n: 0},
                inputBuffers: [
                    "AAAAAAAAAAAAAAAAAAAAAA==",
                    "AACAPwAAgD8AAIA/AACAPw=="
                ]
            }
        }
    };
    const arrayRequest: any = {
        id: 1,
        method: "process",
        params: {
            handle: 2,
            processInput: {
                timestamp: {s: 0, n: 0},
                inputBuffers: [
                    [0, 0, 0, 0],
                    [1, 1, 1, 1]
                ]
            }
        }
    };
    it("can parse base-64 process request, straight from an object", () => {
        Deserialise.ProcessRequest(base64Request).should.eql(expected);
    });
    it("can parse base-64 process request, straight from a JSON string", () => {
        Deserialise.ProcessRequest(JSON.stringify(base64Request)).should.eql(expected);
    });
    it("can parse a process request (array), straight from an object", () => {
        Deserialise.ProcessRequest(arrayRequest).should.eql(expected);
    });
    it("can parse process requests (array), straight from a JSON string", () => {
        Deserialise.ProcessRequest(JSON.stringify(arrayRequest)).should.eql(expected);
    });
});

describe("Serialise.ProcessResponse()", () => {
    it("can serialise ProcessResponses which have no featureValues", () => {
        const toSerialise: ProcessResponse = {
            handle: 1,
            features: new Map<string, FeatureList>([
                ["just-timestamps", [
                    {timestamp: {s: 0, n: 0}},
                    {timestamp: {s: 0, n: 500000000}},
                    {timestamp: {s: 1, n: 0}},
                    {timestamp: {s: 1, n: 500000000}},
                ]]
            ])
        };
        const expected: any = {
            method: "process",
            result: {
                handle: 1,
                features: {
                    "just-timestamps": [
                        {timestamp: {s: 0, n: 0}},
                        {timestamp: {s: 0, n: 500000000}},
                        {timestamp: {s: 1, n: 0}},
                        {timestamp: {s: 1, n: 500000000}},
                    ]
                }
            }
        };
        JSON.parse(Serialise.ProcessResponse(toSerialise)).should.eql(expected);
    });

    it("can serialise ProcessResponses with featureValues", () => {
       const toSerialise: ProcessResponse = {
           handle: 1,
           features: new Map<string, FeatureList>([
               ["values-n-stamps", [
                   {
                       timestamp: {s: 0, n: 0},
                       featureValues: new Float32Array([0, 0, 0, 0])
                   },
                   {
                       timestamp: {s: 0, n: 500000000},
                       featureValues: new Float32Array([1, 1, 1, 1])
                   },
                   {
                       timestamp: {s: 1, n: 0},
                       featureValues: new Float32Array([2, 2, 2, 2])
                   },
                   {
                       timestamp: {s: 1, n: 500000000},
                       featureValues: new Float32Array([3, 3, 3, 3])
                   }
               ]]
           ])
       };
       const expected: any = {
           method: "process",
           result: {
               handle: 1,
               features: {
                   "values-n-stamps": [
                       {
                           timestamp: {s: 0, n: 0},
                           featureValues: [0, 0, 0, 0]
                       },
                       {
                           timestamp: {s: 0, n: 500000000},
                           featureValues: [1, 1, 1, 1]
                       },
                       {
                           timestamp: {s: 1, n: 0},
                           featureValues: [2, 2, 2, 2]
                       },
                       {
                           timestamp: {s: 1, n: 500000000},
                           featureValues: [3, 3, 3, 3]
                       }
                   ]
               }
           }
       };
       const expectedBase64: any = {
           method: "process",
           result: {
               handle: 1,
               features: {
                   "values-n-stamps": [
                       {
                           timestamp: {s: 0, n: 0},
                           featureValues: "AAAAAAAAAAAAAAAAAAAAAA=="
                       },
                       {
                           timestamp: {s: 0, n: 500000000},
                           featureValues: "AACAPwAAgD8AAIA/AACAPw=="
                       },
                       {
                           timestamp: {s: 1, n: 0},
                           featureValues: "AAAAQAAAAEAAAABAAAAAQA=="
                       },
                       {
                           timestamp: {s: 1, n: 500000000},
                           featureValues: "AABAQAAAQEAAAEBAAABAQA=="
                       }
                   ]
               }
           }
       };

       JSON.parse(Serialise.ProcessResponse(toSerialise, false)).should.eql(expected);
       JSON.parse(Serialise.ProcessResponse(toSerialise)).should.eql(expectedBase64);
    });
});

describe("Various optional behaviour of (de)serialisation functions", () => {
    it("will optionally tag a payload when serialising", () => {
        const request: ListRequest = {};
        const serialised: any = JSON.parse(Serialise.ListRequest(request, "TAG"));
        [...Object.keys(serialised)].should.contain("id");
        serialised.id.should.eql("TAG");
    });

    it("can deserialise either an object or a string", () => {
        const response: any = {
            method: "process",
            result: {
                handle: 1,
                features: {
                    "values-n-stamps": [
                        {
                            timestamp: {s: 0, n: 0},
                            featureValues: [0, 0, 0, 0]
                        },
                        {
                            timestamp: {s: 0, n: 500000000},
                            featureValues: [1, 1, 1, 1]
                        },
                        {
                            timestamp: {s: 1, n: 0},
                            featureValues: [2, 2, 2, 2]
                        },
                        {
                            timestamp: {s: 1, n: 500000000},
                            featureValues: [3, 3, 3, 3]
                        }
                    ]
                }
            }
        };
        const expected: ProcessResponse = {
            handle: 1,
            features: new Map<string, FeatureList>([
                ["values-n-stamps", [
                    {
                        timestamp: {s: 0, n: 0},
                        featureValues: new Float32Array([0, 0, 0, 0])
                    },
                    {
                        timestamp: {s: 0, n: 500000000},
                        featureValues: new Float32Array([1, 1, 1, 1])
                    },
                    {
                        timestamp: {s: 1, n: 0},
                        featureValues: new Float32Array([2, 2, 2, 2])
                    },
                    {
                        timestamp: {s: 1, n: 500000000},
                        featureValues: new Float32Array([3, 3, 3, 3])
                    }
                ]]
            ])
        };
        Deserialise.ProcessResponse(response).should.eql(expected);
        [...Deserialise.ProcessResponse(response).features.entries()]
            .should.eql([...expected.features.entries()]);
        Deserialise.ProcessResponse(JSON.stringify(response)).should.eql(expected);
        [...Deserialise.ProcessResponse(JSON.stringify(response)).features]
            .should.eql([...expected.features]);
        // try a request to make sure params are tested
        Deserialise.FinishRequest(JSON.stringify({
            method: "finish",
            params: {
                handle: 1
            }
        })).should.eql({
            handle: 1
        });
    });
});

describe("Deserialise.ListResponse()", () => {
    it("Populates staticOutputInfo when present", () => {
        const message = {
            method: "list",
            result: {
                available: [{
                    key: "test",
                    basic: {
                        identifier: "nonsense",
                        name: "Nonsense",
                        description: "Absolute Nonsense!"
                    },
                    version: 1,
                    minChannelCount: 0,
                    maxChannelCount: 1,
                    inputDomain: "TimeDomain",
                    basicOutputInfo: [
                        {
                            identifier: "nonsense",
                            name: "Nonsense",
                            description: "Absolute Nonsense!"
                        }
                    ]
                }]
            }
        };
        const expected: ListResponse = {
            available: [
                Object.assign(
                    {},
                    message.result.available[0],
                    {inputDomain: 0}
                )
            ]
        };
        Deserialise.ListResponse(message).should.eql(expected);
        const responseWithStaticInfo = Deserialise.ListResponse({
            method: "list",
            result: {
                available: [
                    Object.assign(
                        {},
                        message.result.available[0],
                        {
                            staticOutputInfo: {
                                nonsense: "http://example.com/test/uri"
                            }
                        }
                    )
                ]
            }
        });
        responseWithStaticInfo.available[0].staticOutputInfo.should.exist;
        responseWithStaticInfo.available[0].staticOutputInfo.size.should.eql(1);
        responseWithStaticInfo.available[0].staticOutputInfo.get(
            "nonsense"
        ).should.eql("http://example.com/test/uri");
    });
});

describe("Serialise.ListResponse()", () => {
    it("Converts staticOutputInfo when present", () => {
        const response: ListResponse = {
            available: [{
                key: "test",
                basic: {
                    identifier: "nonsense",
                    name: "Nonsense",
                    description: "Absolute Nonsense!"
                },
                version: 1,
                minChannelCount: 0,
                maxChannelCount: 1,
                inputDomain: InputDomain.TimeDomain,
                basicOutputInfo: [
                    {
                        identifier: "nonsense",
                        name: "Nonsense",
                        description: "Absolute Nonsense!"
                    }
                ]
            }]
        };
        const expected = {
            method: "list",
            result: {
                available: [{
                    key: "test",
                    basic: {
                        identifier: "nonsense",
                        name: "Nonsense",
                        description: "Absolute Nonsense!"
                    },
                    version: 1,
                    minChannelCount: 0,
                    maxChannelCount: 1,
                    inputDomain: "TimeDomain",
                    basicOutputInfo: [
                        {
                            identifier: "nonsense",
                            name: "Nonsense",
                            description: "Absolute Nonsense!"
                        }
                    ]
                }]
            }
        };
        JSON.parse(Serialise.ListResponse(response)).should.eql(expected);
        JSON.parse(Serialise.ListResponse({
            available: [
                Object.assign(
                    {},
                    response.available[0],
                    {
                        staticOutputInfo: new Map([
                            ["nonsense", "http://example.com/test/uri"]
                        ])
                    }
                )
            ]
        })).should.eql({
            method: "list",
            result: {
                available: [
                    Object.assign(
                        {},
                        expected.result.available[0],
                        {
                            staticOutputInfo: {
                                nonsense: "http://example.com/test/uri"
                            }
                        }
                    )
                ]
            }
        })
    });
});