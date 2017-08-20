
import chai = require("chai");
import { Timestamp, fromSeconds, toSeconds, fromFrames, toFrames, toTextHMSm, toTextHMS, toTextMsec, canonicalise, ZERO_TIME } from "../src/time";

describe("Timestamp", () => {

    const ONE_BILLION = 1e9;
    const HALF_A_BILLION = 5e8;
    
    it("converts zero seconds to timestamp", () => {
        fromSeconds(0.0).should.deep.equal({ s: 0, n: 0 })
    });

    it("converts +ve seconds to timestamp", () => {
        fromSeconds(1.5).should.deep.equal({ s: 1, n: HALF_A_BILLION })
    });

    it("converts -ve seconds to timestamp", () => {
        fromSeconds(-1.5).should.deep.equal({ s: -1, n: -HALF_A_BILLION })
    });

    it("converts zero timestamp to seconds", () => {
        toSeconds(ZERO_TIME).should.equal(0.0)
    });

    it("converts +ve timestamp to seconds", () => {
        toSeconds({ s: 1, n: HALF_A_BILLION }).should.equal(1.5)
    });

    it("converts -ve timestamp to seconds", () => {
        toSeconds({ s: -1, n: -HALF_A_BILLION }).should.equal(-1.5)
    });

    it("canonicalises various timestamps", () => {

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
       
        inputs.map(canonicalise).should.deep.equal(expected);
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
    
    it("converts +ve frame to timestamp", () => {
        const actual = testFrameRates.map(
            rate =>
                testFrameCounts.map(
                    frame => fromFrames(frame, rate)
                )
        );
        actual.should.deep.equal(testTimestamps);
    });
    
    it("converts -ve frame to timestamp", () => {
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

    it("converts +ve timestamp to frame", () => {
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
        
    it("converts -ve timestamp to frame", () => {
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

    const textTestInputs: Timestamp[] = [
        { s: 0, n: 0 },
        { s: 1, n: HALF_A_BILLION },
        { s: -1, n: -HALF_A_BILLION },
        { s: 1, n: 1000 },
        { s: 1, n: 100000 },
        { s: 1, n: 1000000 },
        { s: 60, n: 0 },
        { s: 61, n: 50000000 },
        { s: 601, n : 50000000 },
        { s: 3600, n: 0 },
        { s: 3599, n: ONE_BILLION-1 },
        { s: 3600*4 + 60*5 + 3, n: 10000000 },
        { s: -3600*4 -60*5 - 3, n: -10000000 },
    ];
    
    it("converts timestamp to HH:MM:SS.mmm string", () => {

        const expected: string[] = [
            "0",
            "1.5",
            "-1.5",
            "1",
            "1",
            "1.001",
            "1:00",
            "1:01.05",
            "10:01.05",
            "1:00:00",
            "59:59.999",
            "4:05:03.01",
            "-4:05:03.01"
        ];

        textTestInputs.map(t => toTextHMSm(t, false)).should.deep.equal(expected)
    });

    it("converts timestamp to fixed-precision HH:MM:SS.mmm string", () => {

        const expected: string[] = [
            "0.000",
            "1.500",
            "-1.500",
            "1.000",
            "1.000",
            "1.001",
            "1:00.000",
            "1:01.050",
            "10:01.050",
            "1:00:00.000",
            "59:59.999",
            "4:05:03.010",
            "-4:05:03.010"
        ];

        textTestInputs.map(t => toTextHMSm(t, true)).should.deep.equal(expected);
    });

    it("converts timestamp to HH:MM:SS string", () => {

        const expected: string[] = [
            "0",
            "1",
            "-1",
            "1",
            "1",
            "1",
            "1:00",
            "1:01",
            "10:01",
            "1:00:00",
            "59:59",
            "4:05:03",
            "-4:05:03"
        ];

        textTestInputs.map(t => toTextHMS(t)).should.deep.equal(expected)
    });

    it("converts timestamp to SSSSSS.mmm string", () => {

        const expected: string[] = [
            "0",
            "1.5",
            "-1.5",
            "1",
            "1",
            "1.001",
            "60",
            "61.05",
            "601.05",
            "3600",
            "3599.999",
            "14703.01",
            "-14703.01"
        ];

        textTestInputs.map(t => toTextMsec(t, false)).should.deep.equal(expected);
    });

    it("converts timestamp to fixed-precision SSSSSS.mmm string", () => {

        const expected: string[] = [
            "0.000",
            "1.500",
            "-1.500",
            "1.000",
            "1.000",
            "1.001",
            "60.000",
            "61.050",
            "601.050",
            "3600.000",
            "3599.999",
            "14703.010",
            "-14703.010"
        ];

        textTestInputs.map(t => toTextMsec(t, true)).should.deep.equal(expected);
    });
});
