/**
 * Created by lucas on 26/08/2016.
 */
import {FeatureExtractor} from "./FeatureExtractor";
import {Feature} from "./Feature";

export class ZeroCrossings implements FeatureExtractor {

    constructor() {
    }

    process(block: Float32Array): Feature[] {
        let returnFeatures: Feature[] = [];

        return [];
    }
}