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

    constructor(private descriptor: OutputDescriptor) {}

    adjust(feature: Feature): void {
        feature.timestamp = undefined;
    }
}