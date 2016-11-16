/**
 * Created by lucast on 08/09/2016.
 */
import chai = require("chai");
import {OutputDescriptor, SampleType} from "../src/FeatureExtractor";
import {Timestamp} from "../src/Timestamp";
import {Feature} from "../src/Feature";
import {
    FeatureTimeAdjuster, VariableSampleRateFeatureTimeAdjuster,
    FixedSampleRateFeatureTimeAdjuster, OneSamplePerStepFeatureTimeAdjuster
} from "../src/FeatureTimeAdjuster";
chai.should();

function createOutputDescriptor(hasDuration: boolean, sampleRate: number, sampleType: SampleType) {
    return {
        basic: {
            description: "Not a real output",
            identifier: "stub",
            name: "Stub OutputDescriptor"
        },
        configured: {
            hasDuration: hasDuration,
            sampleRate: sampleRate,
            sampleType: sampleType,
        }
    };
}

describe("OneSamplePerStepFeatureTimeAdjuster", () => {
    const stepSize: number = 8;
    const sr: number = 16;
    const stepSizeSeconds: number = stepSize / sr;

    it("Should use the timestamp provided to the process call", () => {
        const adjuster: FeatureTimeAdjuster = new OneSamplePerStepFeatureTimeAdjuster(stepSizeSeconds);
        const expectedTimestamp: Timestamp = {s: 2, n: 0};
        const feature: Feature = {} as Feature;
        adjuster.adjust(feature, expectedTimestamp);
        feature.timestamp.should.deep.equal(expectedTimestamp);
    });

    it("When a timestamp is missing, calculate the next equally-spaced timestamp", () => {
        const adjuster: FeatureTimeAdjuster = new OneSamplePerStepFeatureTimeAdjuster(stepSizeSeconds);
        const expectedTimestamp: Timestamp = {s: 2, n: 500000000};

        adjuster.adjust({}, {s: 2.0, n: 0.0});
        const feature: Feature = {} as Feature;
        adjuster.adjust(feature);
        feature.timestamp.should.deep.equal(expectedTimestamp);
    });

    it("should produce a timestamp of zero on the first adjustment (when no timestamp provided)", () => {
        const adjuster: FeatureTimeAdjuster = new OneSamplePerStepFeatureTimeAdjuster(stepSizeSeconds);
        let feature: Feature = {};
        adjuster.adjust(feature);
        feature.timestamp.should.eql({s: 0, n: 0});
    });

    it("Should throw on construction if not provided with the step size (secs)", () => {
        chai.expect(() => new OneSamplePerStepFeatureTimeAdjuster(undefined)).to.throw(Error);
    });
});

describe("VariableSampleRateFeatureTimeAdjuster", () => {

    describe("Feature has a duration", () => {
        const descriptor: OutputDescriptor = createOutputDescriptor(true, 0.0, SampleType.VariableSampleRate);
        const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor.configured);
        it("Uses the timestamp as-is when the Feature conforms to the OutputDescriptor", () => {
            const expectedTimestamp: Timestamp = {s: 2, n: 0};
            const feature: Feature = {
                timestamp: expectedTimestamp,
                duration: {s: 1, n: 0}
            };
            adjuster.adjust(feature);
            feature.timestamp.should.deep.equal(expectedTimestamp);
        });

        it("Assigns the minimum duration to the Feature when not conforming to the OutputDescriptor", () => {
            const expectedDuration: Timestamp = {s: 0, n: 0};
            const feature: Feature = {
                timestamp: {s: 1, n: 0}
            };
            adjuster.adjust(feature);
            feature.duration.should.deep.equal(expectedDuration);
        });
    });

    describe("Feature has no duration / Minimal duration spec", ()  => {
        it("Assigns 1 / sampleRate as the duration when the OutputDescriptor defines a sample rate", () => {
            const descriptor: OutputDescriptor = createOutputDescriptor(false, 100.0, SampleType.VariableSampleRate);
            const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor.configured);
            const expectedDuration: Timestamp = {s: 0, n: 10000000};
            const feature: Feature = {
                timestamp: {s: 1, n: 0}
            };
            adjuster.adjust(feature);
            feature.duration.should.deep.equal(expectedDuration);
        });

        describe("OutputDescriptor has no sample rate", () => {
            it("Assigns 0 as the duration when there is no sample rate in the OutputDescriptor", () => {
                const descriptor: OutputDescriptor = {
                    basic: {
                        description: "Not a real output",
                        identifier: "stub",
                        name: "Stub OutputDescriptor"
                    },
                    configured: {
                        hasDuration: false,
                        sampleType: SampleType.VariableSampleRate,
                    }
                };
                const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor.configured);
                const expectedDuration: Timestamp = {s: 0, n: 0};
                const feature: Feature = {
                    timestamp: {s: 1, n: 0}
                };
                adjuster.adjust(feature);
                feature.duration.should.deep.equal(expectedDuration);
            });

            it("Assigns 0 as the duration when there the sample rate is 0 in the OutputDescriptor", () => {
                const descriptor: OutputDescriptor = {
                    basic: {
                        description: "Not a real output",
                        identifier: "stub",
                        name: "Stub OutputDescriptor"
                    },
                    configured: {
                        hasDuration: false,
                        sampleType: SampleType.VariableSampleRate,
                        sampleRate: 0
                    }
                };
                const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor.configured);
                const expectedDuration: Timestamp = {s: 0, n: 0};
                const feature: Feature = {
                    timestamp: {s: 1, n: 0}
                };
                adjuster.adjust(feature);
                feature.duration.should.deep.equal(expectedDuration);
            });
        });
    });

    describe("Indicates invalid Features", () => {
        const descriptor: OutputDescriptor = createOutputDescriptor(true, 0.0, SampleType.VariableSampleRate);
        const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor.configured);
        it("Throws when no Timestamp present", () => {
            chai.expect(() => adjuster.adjust({})).to.throw(Error);
        });
    });
});

describe("FixedSampleRateFeatureTimeAdjuster", () => {
    const descriptor: OutputDescriptor = createOutputDescriptor(true, 10.0, SampleType.FixedSampleRate);
    describe("Feature has a timestamp", () => {
        it("Rounds the timestamp to the nearest 1 / sampleRate", () => {
            const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor.configured);
            const feature: Feature = {
                timestamp: {s: 1, n: 550000000.0}
            };
            adjuster.adjust(feature);
            feature.timestamp.should.deep.equal({s: 1, n: 600000000.0});
        });
    });

    describe("Feature has no timestamp", () => {
        it("Calculates the timestamp from the previous timestamp + 1 / sampleRate", () => {
            const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor.configured);
            const features: Feature[] = [];
            features.push({timestamp: {s: 1, n: 550000000.0}});
            features.push({});
            for (let feature of features)
                adjuster.adjust(feature);
            features[1].timestamp.should.deep.equal({s: 1, n: 700000000.0});
        });

        it("Sets the first timestamp to zero if not provided by the Feature", () => {
            const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor.configured);
            const feature: Feature = {};
            adjuster.adjust(feature);
            feature.timestamp.should.deep.equal({s: 0, n: 0});
        });
    });

    describe("Feature has a duration", () => {
        const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor.configured);
        it("Rounds the duration to the nearest 1 / sampleRate", () => {
            const feature: Feature = {
                duration: {s: 1, n: 550000000.0}
            };
            adjuster.adjust(feature);
            feature.duration.should.deep.equal({s: 1, n: 600000000.0});
        });

        it("Sets the duration to 0 if the Feature does not match the OutputDescriptor", () => {
            const feature: Feature = {};
            adjuster.adjust(feature);
            feature.duration.should.deep.equal({s: 0, n: 0});
        });
    });

    describe("Feature has no duration", () => {
        const descriptor: OutputDescriptor = createOutputDescriptor(false, 10.0, SampleType.FixedSampleRate);
        const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor.configured);
        it("Sets the duration to 0", () => {
            const feature: Feature = {};
            adjuster.adjust(feature);
            feature.duration.should.deep.equal({s: 0, n: 0});
        });
    });

    describe("It indicates invalid OutputDescriptor / Features", () => {
        it("Throws on construction if the OutputDescriptor has a zero sampleRate", () => {
            const descriptor: OutputDescriptor = createOutputDescriptor(false, 0.0, SampleType.FixedSampleRate);
            chai.expect(() => new FixedSampleRateFeatureTimeAdjuster(descriptor.configured)).to.throw(Error);
        });
        it("Throws on construction if the OutputDescriptor has no sampleRate", () => {
            const descriptor: OutputDescriptor = {
                basic: {
                    description: "Not a real output",
                    identifier: "stub",
                    name: "Stub OutputDescriptor"
                },
                configured: {
                    hasDuration: false,
                    sampleType: SampleType.FixedSampleRate
                }
            };
            chai.expect(() => new FixedSampleRateFeatureTimeAdjuster(descriptor.configured)).to.throw(Error);
        });
    });
});