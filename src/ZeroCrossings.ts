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
        let prev: number = this.previousSample;
        let count: number = 0;
        let returnFeatures: Feature[] = [];

        block.forEach((sample) => {
            let crossing: boolean = false;

            if (sample <= 0.0) {
                if (prev > 0.0) crossing = true;
            } else if (sample > 0.0) {
                if (prev <= 0.0) crossing = true;
            }

            if (crossing) {
                ++count;
            }

            prev = sample;
        });

        this.previousSample = prev;
        returnFeatures.push({values: [count]});
        return returnFeatures;
    }
}