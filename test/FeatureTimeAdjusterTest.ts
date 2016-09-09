/**
 * Created by lucast on 08/09/2016.
 */
import chai = require('chai');
import {OutputDescriptor, BasicDescriptor, SampleType} from "../src/PluginServer";
import {Timestamp} from "../src/Timestamp";
import {Feature} from "../src/Feature";
import {FeatureTimeAdjuster, VariableSampleRateFeatureTimeAdjuster} from "../src/FeatureTimeAdjuster";

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
            feature.timestamp.should.equal(expectedTimestamp);
        });

        it('Assigns the minimum duration to the Feature when not conforming to the OutputDescriptor', () => {
            const expectedDuration: Timestamp = {s: 0, n: 0};
            const feature: Feature = {
                timestamp: {s: 1, n: 0}
            };
            adjuster.adjust(feature);
            feature.duration.should.equal(expectedDuration);
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
            feature.duration.should.equal(expectedDuration);
        });

        it('Assigns 0 as the duration when there is no sample rate in the OutputDescriptor', () => {
            const descriptor: OutputDescriptor = { // TODO is no sampleRate property the same as a sampleRate of 0? What does VamPipe return?
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
            feature.duration.should.equal(expectedDuration);
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
    describe('Feature has a timestamp', () => {
        it('Rounds the timestamp to the nearest 1 / sampleRate', () => {

        })
    });

    describe('Feature has no timestamp', () => {
        it('Calculates the timestamp from the previous timestamp + 1 / sampleRate', () => {

        });

        it('Sets the first timestamp to zero if not provided by the Feature', () => {

        });
    });

    describe('Feature has a duration', () => {
        it('Rounds the duration to the nearest 1 / sampleRate', () => {

        });

        it('Sets the duration to 0 if the Feature does not match the OutputDescriptor', () => {

        });
    });

    describe('Feature has no duration', () => {
        it('Sets the duration to 0', () => {

        });
    });

    describe('It indicates invalid OutputDescriptor / Features', () => {
        it('Throws on construction if the OutputDescriptor has no sampleRate', () => {

        })
    });
});