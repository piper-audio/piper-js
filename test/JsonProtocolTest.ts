/**
 * Created by lucas on 23/11/2016.
 */
import * as chai from "chai";
import {segment} from "../src/HigherLevelUtilities";
import {ProcessRequest, ProcessResponse, ListRequest} from "../src/Piper";
import {Serialise, Deserialise} from "../src/JsonProtocol";
import {FeatureList} from "../src/Feature";
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
                .should.eql(expectedBase64[index++])
        }
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
       JSON.parse(Serialise.ProcessResponse(toSerialise, false)).should.eql(expected);
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
        Deserialise.ProcessResponse(JSON.stringify(response)).should.eql(expected);
    });
});