/**
 * Created by lucas on 26/08/2016.
 */
import { Timestamp } from "./Timestamp";

export interface Feature {
    timestamp?: Timestamp;
    duration?: Timestamp;
    label?: string;
    values?: Float32Array;
}

export type FeatureList = Feature[];
export type FeatureSet = Map<string, FeatureList>
