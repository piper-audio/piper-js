/**
 * Created by lucas on 25/08/2016.
 */
import {FeatureExtractor} from "./FeatureExtractor";
import {Feature} from "./Feature";

export class ZeroCrossings implements FeatureExtractor {
    private previousSample: number;

    constructor() {
        this.previousSample = 0;
    }

    process(block: Float32Array): Feature[] {
        let count: number = 0;
        let returnFeatures: Feature[] = [];

        block.forEach((sample) => {
            if (this.hasCrossedAxis(sample))
                ++count;
            this.previousSample = sample;
        });

        returnFeatures.push({values: [count]});
        return returnFeatures;
    }

    private hasCrossedAxis(sample: number) {
        const hasCrossedFromAbove = this.previousSample > 0.0 && sample <= 0.0;
        const hasCrossedFromBelow = this.previousSample <= 0.0 && sample > 0.0;
        return hasCrossedFromBelow || hasCrossedFromAbove;
    }
}