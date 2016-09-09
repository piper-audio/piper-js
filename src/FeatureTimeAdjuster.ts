import {Timestamp} from "./Timestamp";
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
        feature.timestamp = undefined;
    }
}

export class FixedSampleRateFeatureTimeAdjuster implements FeatureTimeAdjuster {
    private lastTimestamp: Timestamp

    constructor(private descriptor: OutputDescriptor) {}

    adjust(feature: Feature): void {
        feature.timestamp = undefined;
    }
}