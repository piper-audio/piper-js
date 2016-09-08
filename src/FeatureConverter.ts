import {Timestamp} from "./Timestamp";
import {OutputDescriptor} from "./PluginServer";
import {Feature} from "./Feature";
/**
 * Created by lucast on 08/09/2016.
 */
export interface FeatureConverter {
    convert(feature: Feature): void ;
}

export class VariableSampleRateFeatureConverter implements FeatureConverter {
    constructor(private descriptor: OutputDescriptor) {}

    convert(feature: Feature): void {
        feature.timestamp = undefined;
    }
}

export class FixedSampleRateFeatureConverter implements FeatureConverter {
    private lastTimestamp: Timestamp

    constructor(private descriptor: OutputDescriptor) {}

    convert(feature: Feature): void {
        feature.timestamp = undefined;
    }
}