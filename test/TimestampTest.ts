
import chai = require("chai");
import { Timestamp, fromSeconds, toSeconds, fromFrames, toFrames, canonicalise, ZERO_TIME } from "../src/Timestamp";

describe("Timestamp", () => {

    const ONE_BILLION = 1e9;
    const HALF_A_BILLION = 5e8;
    
    it("Converts zero seconds to timestamp", () => {
        fromSeconds(0.0).should.deep.equal({ s: 0, n: 0 })
    });

    it("Converts +ve seconds to timestamp", () => {
        fromSeconds(1.5).should.deep.equal({ s: 1, n: HALF_A_BILLION })
    });

    it("Converts -ve seconds to timestamp", () => {
        fromSeconds(-1.5).should.deep.equal({ s: -1, n: -HALF_A_BILLION })
    });

    it("Converts zero timestamp to seconds", () => {
        toSeconds(ZERO_TIME).should.equal(0.0)
    });

    it("Converts +ve timestamp to seconds", () => {
        toSeconds({ s: 1, n: HALF_A_BILLION }).should.equal(1.5)
    });

    it("Converts -ve timestamp to seconds", () => {
        toSeconds({ s: -1, n: -HALF_A_BILLION }).should.equal(-1.5)
    });

    it("Canonicalises various timestamps", () => {

        // Some of these are already canonical (to test that it
        // doesn't change them), but most are not

        const inputs : Timestamp[] = [

            { s: 0, n: 0 },

            { s: 1, n: -HALF_A_BILLION },
            { s: -1, n: HALF_A_BILLION },

            { s: 1, n: ONE_BILLION },
            { s: 1, n: -ONE_BILLION },
            { s: -1, n: ONE_BILLION },
            { s: -1, n: -ONE_BILLION },

            { s: 1, n: -ONE_BILLION-HALF_A_BILLION },
            { s: -1, n: ONE_BILLION+HALF_A_BILLION },

            { s: 2, n: -ONE_BILLION*2 },
            { s: 2, n: -HALF_A_BILLION },
            { s: -2, n: ONE_BILLION*2 },
            { s: -2, n: HALF_A_BILLION },

            { s: 0, n: 1 },
            { s: 0, n: -1 },
            { s: 1, n: -1 },
            { s: -1, n: 1 },
            { s: -1, n: -1 },

            { s: 1.5, n: 0 },
            { s: 1.5, n: HALF_A_BILLION },
            { s: 1.5, n: -HALF_A_BILLION },
            { s: -1.5, n: 0 },
            { s: -1.5, n: HALF_A_BILLION },
            { s: -1.5, n: -HALF_A_BILLION },

            { s: 1e-4, n: 0 },
            { s: 1e-4, n: 1e4 },

            { s: -0, n: 0 },
            { s: -0, n: -0 },
            { s: -0, n: HALF_A_BILLION },
            { s: -0, n: -HALF_A_BILLION },
        ];

        const expected : Timestamp[] = [

            { s: 0, n: 0 },

            { s: 0, n: HALF_A_BILLION },
            { s: 0, n: -HALF_A_BILLION },

            { s: 2, n: 0 },
            { s: 0, n: 0 },
            { s: 0, n: 0 },
            { s: -2, n: 0 },

            { s: 0, n: -HALF_A_BILLION },
            { s: 0, n: HALF_A_BILLION },

            { s: 0, n: 0 },
            { s: 1, n: HALF_A_BILLION },
            { s: 0, n: 0 },
            { s: -1, n: -HALF_A_BILLION },

            { s: 0, n: 1 },
            { s: 0, n: -1 },
            { s: 0, n: ONE_BILLION-1 },
            { s: 0, n: -ONE_BILLION+1 },
            { s: -1, n: -1 },

            { s: 1, n: HALF_A_BILLION },
            { s: 2, n: 0 },
            { s: 1, n: 0 },
            { s: -1, n: -HALF_A_BILLION },
            { s: -1, n: 0 },
            { s: -2, n: 0 },

            { s: 0, n: 1e5 },
            { s: 0, n: 11e4 },

            { s: 0, n: 0 },
            { s: 0, n: 0 },
            { s: 0, n: HALF_A_BILLION },
            { s: 0, n: -HALF_A_BILLION },
        ];
       
        const actual : Timestamp[] = inputs.map(canonicalise);

        actual.should.deep.equal(expected);
    });

    const testFrameCounts : number[] = [
        0, 1, 2047, 2048, 6656,
        32767, 32768, 44100, 44101,
        999999999, 2000000000
    ];

    const testFrameRates : number[] = [
        1, 2, 8000, 22050,
        44100, 44101, 192000, 2000000001
    ];

    const testTimestamps : Timestamp[][] = [
        [ { s: 0, n: 0 }, { s: 1, n: 0 }, { s: 2047, n: 0 }, { s: 2048, n: 0 },
          { s: 6656, n: 0 }, { s: 32767, n: 0 }, { s: 32768, n: 0 }, { s: 44100, n: 0 },
          { s: 44101, n: 0 }, { s: 999999999, n: 0 }, { s: 2000000000, n: 0 } ],
        [ { s: 0, n: 0 }, { s: 0, n: 500000000 }, { s: 1023, n: 500000000 }, { s: 1024, n: 0 },
          { s: 3328, n: 0 }, { s: 16383, n: 500000000 }, { s: 16384, n: 0 }, { s: 22050, n: 0 },
          { s: 22050, n: 500000000 }, { s: 499999999, n: 500000000 }, { s: 1000000000, n: 0 } ],
        [ { s: 0, n: 0 }, { s: 0, n: 125000 }, { s: 0, n: 255875000 }, { s: 0, n: 256000000 },
          { s: 0, n: 832000000 }, { s: 4, n: 95875000 }, { s: 4, n: 96000000 }, { s: 5, n: 512500000 },
          { s: 5, n: 512625000 }, { s: 124999, n: 999875000 }, { s: 250000, n: 0 } ],
        [ { s: 0, n: 0 }, { s: 0, n: 45351 }, { s: 0, n: 92834467 }, { s: 0, n: 92879819 },
          { s: 0, n: 301859410 }, { s: 1, n: 486031746 }, { s: 1, n: 486077098 }, { s: 2, n: 0 },
          { s: 2, n: 45351 }, { s: 45351, n: 473877551 }, { s: 90702, n: 947845805 } ],
        [ { s: 0, n: 0 }, { s: 0, n: 22676 }, { s: 0, n: 46417234 }, { s: 0, n: 46439909 },
          { s: 0, n: 150929705 }, { s: 0, n: 743015873 }, { s: 0, n: 743038549 }, { s: 1, n: 0 },
          { s: 1, n: 22676 }, { s: 22675, n: 736938776 }, { s: 45351, n: 473922902 } ],
        [ { s: 0, n: 0 }, { s: 0, n: 22675 }, { s: 0, n: 46416181 }, { s: 0, n: 46438856 },
          { s: 0, n: 150926283 }, { s: 0, n: 742999025 }, { s: 0, n: 743021700 }, { s: 0, n: 999977325 },
          { s: 1, n: 0 }, { s: 22675, n: 222761389 }, { s: 45350, n: 445568128 } ],
        [ { s: 0, n: 0 }, { s: 0, n: 5208 }, { s: 0, n: 10661458 }, { s: 0, n: 10666667 },
          { s: 0, n: 34666667 }, { s: 0, n: 170661458 }, { s: 0, n: 170666667 }, { s: 0, n: 229687500 },
          { s: 0, n: 229692708 }, { s: 5208, n: 333328125 }, { s: 10416, n: 666666667 } ],
        [ { s: 0, n: 0 }, { s: 0, n: 0 }, { s: 0, n: 1023 }, { s: 0, n: 1024 },
          { s: 0, n: 3328 }, { s: 0, n: 16383 }, { s: 0, n: 16384 }, { s: 0, n: 22050 },
          { s: 0, n: 22050 }, { s: 0, n: 499999999 }, { s: 1, n: 0 } ]
    ];
    
    it("Converts +ve frame to timestamp", () => {
        const actual = testFrameRates.map(
            rate =>
                testFrameCounts.map(
                    frame => fromFrames(frame, rate)
                )
        );
        actual.should.deep.equal(testTimestamps);
    });
    
    it("Converts -ve frame to timestamp", () => {
        const actual = testFrameRates.map(
            rate =>
                testFrameCounts.map(
                    frame => fromFrames(-frame, rate)
                )
        );
        const expected = testTimestamps.map(
            tss =>
                tss.map(
                    ts => canonicalise({ s: -ts.s, n: -ts.n })
                )
        );
        actual.should.deep.equal(expected);
    });

    it("Converts +ve timestamp to frame", () => {
        const actual = testTimestamps.map(
            (tss, ix) =>
                tss.map(
                    ts => {
                        const rate = testFrameRates[ix];
                        if (rate > ONE_BILLION) {
                            // We don't have enough precision for this
                            // absurd sample rate, so a round trip
                            // conversion may round. Skip these.
                            return 0
                        } else {
                            return toFrames(ts, testFrameRates[ix])
                        }
                    }
                )
        );
        const expected = testFrameRates.map(
            rate => {
                if (rate > ONE_BILLION) {
                    // See above
                    return [0,0,0,0,0,0,0,0,0,0,0]
                } else {
                    return testFrameCounts
                }
            }
        );
        actual.should.deep.equal(expected);
    });
        
    it("Converts -ve timestamp to frame", () => {
        const actual = testTimestamps.map(
            (tss, ix) =>
                tss.map(
                    ts => {
                        const rate = testFrameRates[ix];
                        if (rate > ONE_BILLION) {
                            // We don't have enough precision for this
                            // absurd sample rate, so a round trip
                            // conversion may round. Skip these.
                            return 0
                        } else {
                            return toFrames(canonicalise({s: -ts.s, n: -ts.n}),
                                            testFrameRates[ix])
                        }
                    }
                )
        );
        const expected = testFrameRates.map(
            rate => {
                if (rate > ONE_BILLION) {
                    // See above
                    return [0,0,0,0,0,0,0,0,0,0,0]
                } else {
                    return testFrameCounts.map(
                        frame => (frame === 0 ? frame : -frame)
                    )
                }
            }
        );
        actual.should.deep.equal(expected);
    });
        
});
