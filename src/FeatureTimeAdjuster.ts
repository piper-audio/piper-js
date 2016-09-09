import {Timestamp, makeTimestamp, toSeconds, frame2timestamp} from "./Timestamp";
import {OutputDescriptor} from "./PluginServer";
import {Feature} from "./Feature";
/**
 * Created by lucast on 08/09/2016.
 */
export interface FeatureTimeAdjuster {
    adjust(feature: Feature): void ;
}

export class VariableSampleRateFeatureTimeAdjuster implements FeatureTimeAdjuster {
    constructor(private descriptor: OutputDescriptor) {}

    adjust(feature: Feature): void {
        if (!feature.hasOwnProperty('timestamp')) throw new Error('Feature must have a timestamp');
        const hasSampleRate: boolean = this.descriptor.hasOwnProperty('sampleRate') && this.descriptor.sampleRate != 0.0;
        if (!feature.hasOwnProperty('duration'))
            feature.duration = hasSampleRate ? frame2timestamp(1, this.descriptor.sampleRate) : {s: 0, n: 0};
    }
}

export class FixedSampleRateFeatureTimeAdjuster implements FeatureTimeAdjuster {
    private lastTimestamp: Timestamp;

    constructor(private descriptor: OutputDescriptor) {
        if (!descriptor.hasOwnProperty('sampleRate') || descriptor.sampleRate == 0.0) throw new Error('OutputDescriptor must provide a sample rate.');
        this.lastTimestamp = frame2timestamp(-1, this.descriptor.sampleRate);
    }

    adjust(feature: Feature): void {
        const sr: number = this.descriptor.sampleRate;
        const frame: number = feature.hasOwnProperty('timestamp') ? Math.round(toSeconds(feature.timestamp) * sr) : Math.round(toSeconds(this.lastTimestamp) * sr) + 1;
        feature.timestamp = frame2timestamp(frame, sr);
        feature.duration = feature.hasOwnProperty('duration') ? frame2timestamp(Math.round(toSeconds(feature.duration) * sr), sr) : {s: 0, n: 0};
        this.lastTimestamp = {s: feature.timestamp.s, n: feature.timestamp.n};
    }
}