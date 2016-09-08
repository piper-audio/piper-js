/**
 * Created by lucas on 25/08/2016.
 */
import {FeatureExtractor} from "./FeatureExtractor";
import {Feature} from "./Feature";
import {ProcessBlock} from "./PluginServer";

export class ZeroCrossings implements FeatureExtractor {
    private previousSample: number;

    constructor() {
        this.previousSample = 0;
    }

    process(block: ProcessBlock): Feature[][] {
        let count: number = 0;
        let returnFeatures: Feature[][] = [];

        const channel = block.inputBuffers[0].values; // ignore stereo channels
        channel.forEach((sample) => {
            if (this.hasCrossedAxis(sample))
                ++count;
            this.previousSample = sample;
        });

        returnFeatures.push([{values: [count]}]);
        return returnFeatures;
    }

    private hasCrossedAxis(sample: number) {
        const hasCrossedFromAbove = this.previousSample > 0.0 && sample <= 0.0;
        const hasCrossedFromBelow = this.previousSample <= 0.0 && sample > 0.0;
        return hasCrossedFromBelow || hasCrossedFromAbove;
    }
}