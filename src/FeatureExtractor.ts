/**
 * Created by lucas on 26/08/2016.
 */
import {Feature} from "./Feature";

export interface FeatureExtractor {
    process(block: Float32Array): Feature[];
}