/**
 * Created by lucast on 08/09/2016.
 */
import chai = require('chai');
import {OutputDescriptor, BasicDescriptor, SampleType} from "ClientServer.ts";
import {Timestamp} from "../src/Timestamp";
import {Feature} from "../src/Feature";
import {
    FeatureTimeAdjuster, VariableSampleRateFeatureTimeAdjuster,
    FixedSampleRateFeatureTimeAdjuster
} from "../src/FeatureTimeAdjuster";

chai.should();

function createOutputDescriptor(hasDuration: boolean, sampleRate: number, sampleType: SampleType) {
    return {
        basic: {
            description: "Not a real output",
            identifier: "stub",
            name: "Stub OutputDescriptor"
        },
        hasDuration: hasDuration,
        sampleRate: sampleRate,
        sampleType: sampleType,
    }
}

describe('VariableSampleRateFeatureTimeAdjuster', () => {

    describe('Feature has a duration', () => {
        const descriptor: OutputDescriptor = createOutputDescriptor(true, 0.0, SampleType.VariableSampleRate);
        const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor);
        it('Uses the timestamp as-is when the Feature conforms to the OutputDescriptor', () => {
            const expectedTimestamp: Timestamp = {s: 2, n: 0};
            const feature: Feature = {
                timestamp: expectedTimestamp,
                duration: {s: 1, n: 0}
            };
            adjuster.adjust(feature);
            feature.timestamp.should.deep.equal(expectedTimestamp);
        });

        it('Assigns the minimum duration to the Feature when not conforming to the OutputDescriptor', () => {
            const expectedDuration: Timestamp = {s: 0, n: 0};
            const feature: Feature = {
                timestamp: {s: 1, n: 0}
            };
            adjuster.adjust(feature);
            feature.duration.should.deep.equal(expectedDuration);
        });
    });

    describe('Feature has no duration / Minimal duration spec', ()  => {
        it('Assigns 1 / sampleRate as the duration when the OutputDescriptor defines a sample rate', () => {
            const descriptor: OutputDescriptor = createOutputDescriptor(false, 100.0, SampleType.VariableSampleRate);
            const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor);
            const expectedDuration: Timestamp = {s: 0, n: 10000000};
            const feature: Feature = {
                timestamp: {s: 1, n: 0}
            };
            adjuster.adjust(feature);
            feature.duration.should.deep.equal(expectedDuration);
        });

        describe('OutputDescriptor has no sample rate', () => {
            it('Assigns 0 as the duration when there is no sample rate in the OutputDescriptor', () => {
                const descriptor: OutputDescriptor = {
                    basic: {
                        description: "Not a real output",
                        identifier: "stub",
                        name: "Stub OutputDescriptor"
                    },
                    hasDuration: false,
                    sampleType: SampleType.VariableSampleRate,
                };
                const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor);
                const expectedDuration: Timestamp = {s: 0, n: 0};
                const feature: Feature = {
                    timestamp: {s: 1, n: 0}
                };
                adjuster.adjust(feature);
                feature.duration.should.deep.equal(expectedDuration);
            });

            it('Assigns 0 as the duration when there the sample rate is 0 in the OutputDescriptor', () => {
                const descriptor: OutputDescriptor = {
                    basic: {
                        description: "Not a real output",
                        identifier: "stub",
                        name: "Stub OutputDescriptor"
                    },
                    hasDuration: false,
                    sampleType: SampleType.VariableSampleRate,
                    sampleRate: 0
                };
                const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor);
                const expectedDuration: Timestamp = {s: 0, n: 0};
                const feature: Feature = {
                    timestamp: {s: 1, n: 0}
                };
                adjuster.adjust(feature);
                feature.duration.should.deep.equal(expectedDuration);
            });
        });
    });

    describe('Indicates invalid Features', () => {
        const descriptor: OutputDescriptor = createOutputDescriptor(true, 0.0, SampleType.VariableSampleRate);
        const adjuster: FeatureTimeAdjuster = new VariableSampleRateFeatureTimeAdjuster(descriptor);
        it('Throws when no Timestamp present', () => {
            chai.expect(() => adjuster.adjust({})).to.throw(Error);
        })
    });
});

describe('FixedSampleRateFeatureTimeAdjuster', () => {
    const descriptor: OutputDescriptor = createOutputDescriptor(true, 10.0, SampleType.FixedSampleRate);
    describe('Feature has a timestamp', () => {
        it('Rounds the timestamp to the nearest 1 / sampleRate', () => {
            const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor);
            const feature: Feature = {
                timestamp: {s: 1, n: 550000000.0}
            };
            adjuster.adjust(feature);
            feature.timestamp.should.deep.equal({s: 1, n: 600000000.0});
        })
    });

    describe('Feature has no timestamp', () => {
        it('Calculates the timestamp from the previous timestamp + 1 / sampleRate', () => {
            const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor);
            const features: Feature[] = [];
            features.push({timestamp: {s: 1, n: 550000000.0}});
            features.push({});
            for (let feature of features)
                adjuster.adjust(feature);
            features[1].timestamp.should.deep.equal({s: 1, n: 700000000.0})
        });

        it('Sets the first timestamp to zero if not provided by the Feature', () => {
            const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor);
            const feature: Feature = {};
            adjuster.adjust(feature);
            feature.timestamp.should.deep.equal({s: 0, n: 0});
        });
    });

    describe('Feature has a duration', () => {
        const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor);
        it('Rounds the duration to the nearest 1 / sampleRate', () => {
            const feature: Feature = {
                duration: {s: 1, n: 550000000.0}
            };
            adjuster.adjust(feature);
            feature.duration.should.deep.equal({s: 1, n: 600000000.0});
        });

        it('Sets the duration to 0 if the Feature does not match the OutputDescriptor', () => {
            const feature: Feature = {};
            adjuster.adjust(feature);
            feature.duration.should.deep.equal({s: 0, n: 0});
        });
    });

    describe('Feature has no duration', () => {
        const descriptor: OutputDescriptor = createOutputDescriptor(false, 10.0, SampleType.FixedSampleRate);
        const adjuster: FeatureTimeAdjuster = new FixedSampleRateFeatureTimeAdjuster(descriptor);
        it('Sets the duration to 0', () => {
            const feature: Feature = {};
            adjuster.adjust(feature);
            feature.duration.should.deep.equal({s: 0, n: 0});
        });
    });

    describe('It indicates invalid OutputDescriptor / Features', () => {
        it('Throws on construction if the OutputDescriptor has a zero sampleRate', () => {
            const descriptor: OutputDescriptor = createOutputDescriptor(false, 0.0, SampleType.FixedSampleRate);
            chai.expect(() => new FixedSampleRateFeatureTimeAdjuster(descriptor)).to.throw(Error);
        });
        it('Throws on construction if the OutputDescriptor has no sampleRate', () => {
            const descriptor: OutputDescriptor = {
                basic: {
                    description: "Not a real output",
                    identifier: "stub",
                    name: "Stub OutputDescriptor"
                },
                hasDuration: false,
                sampleType: SampleType.FixedSampleRate,
            };
            chai.expect(() => new FixedSampleRateFeatureTimeAdjuster(descriptor)).to.throw(Error);
        })
    });
});