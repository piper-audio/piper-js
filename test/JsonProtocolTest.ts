/**
 * Created by lucas on 23/11/2016.
 */
import * as chai from "chai";
import {segment} from "../src/HigherLevelUtilities";
import {ProcessRequest} from "../src/Piper";
import {Serialise} from "../src/JsonProtocol";
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