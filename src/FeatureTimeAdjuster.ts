import {toSeconds, frame2timestamp} from "./Timestamp";
import {OutputDescriptor, SampleType} from "./ClientServer";
import {Feature} from "./Feature";
/**
 * Created by lucast on 08/09/2016.
 */
export interface FeatureTimeAdjuster {
    adjust(feature: Feature): void;
}

export class VariableSampleRateFeatureTimeAdjuster implements FeatureTimeAdjuster {
    constructor(private descriptor: OutputDescriptor) {}

    adjust(feature: Feature): void {
        if (!feature.hasOwnProperty("timestamp")) throw new Error("Feature must have a timestamp");
        const hasSampleRate: boolean = this.descriptor.hasOwnProperty("sampleRate") && this.descriptor.sampleRate !== 0.0;
        if (!feature.hasOwnProperty("duration"))
            feature.duration = hasSampleRate ? frame2timestamp(1, this.descriptor.sampleRate) : {s: 0, n: 0};
    }
}

export class FixedSampleRateFeatureTimeAdjuster implements FeatureTimeAdjuster {
    private lastFeatureIndex: number;

    constructor(private descriptor: OutputDescriptor) {
        if (!descriptor.hasOwnProperty("sampleRate") || descriptor.sampleRate === 0.0) throw new Error("OutputDescriptor must provide a sample rate.");
        this.lastFeatureIndex = -1;
    }

    adjust(feature: Feature): void {
        const sr: number = this.descriptor.sampleRate;
        const featureIndex: number = feature.hasOwnProperty("timestamp") ? Math.round(toSeconds(feature.timestamp) * sr) : this.lastFeatureIndex + 1;
        feature.timestamp = frame2timestamp(featureIndex, sr);
        feature.duration = feature.hasOwnProperty("duration") ? frame2timestamp(Math.round(toSeconds(feature.duration) * sr), sr) : {s: 0, n: 0};
        this.lastFeatureIndex = featureIndex;
    }
}

export class OneSamplePerStepFeatureTimeAdjuster implements FeatureTimeAdjuster {
    adjust(feature: Feature): void {} // This doesn"t need to do anything, is this pointless?
}

export function createFeatureTimeAdjuster(descriptor: OutputDescriptor): FeatureTimeAdjuster {

    switch (descriptor.sampleType) {
        case SampleType.OneSamplePerStep:
            return new OneSamplePerStepFeatureTimeAdjuster();
        case SampleType.VariableSampleRate:
            return new VariableSampleRateFeatureTimeAdjuster(descriptor);
        case SampleType.FixedSampleRate:
            return new FixedSampleRateFeatureTimeAdjuster(descriptor);
    }
}