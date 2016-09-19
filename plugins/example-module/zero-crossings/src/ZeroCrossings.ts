/**
 * Created by lucas on 25/08/2016.
 */
import {FeatureExtractor} from "../../../../src/FeatureExtractor";
import {FeatureSet, FeatureList} from "../../../../src/Feature";
import {ProcessBlock} from "../../../../src/ClientServer";
import {frame2timestamp} from "../../../../src/Timestamp";

export class ZeroCrossings implements FeatureExtractor {
    private previousSample: number;

    constructor(private inputSampleRate: number) {
        this.previousSample = 0;
    }

    process(block: ProcessBlock): FeatureSet {
        let count: number = 0;
        let returnFeatures: FeatureSet = new Map();
        let crossingPoints: FeatureList = [];

        const channel = block.inputBuffers[0].values; // ignore stereo channels
        channel.forEach((sample, nSample) => {
            if (this.hasCrossedAxis(sample)) {
                ++count;
                crossingPoints.push({timestamp: frame2timestamp(nSample, this.inputSampleRate)});
            }
            this.previousSample = sample;
        });

        returnFeatures.set("counts", [{values: new Float32Array([count])}]);
        if (crossingPoints.length > 0) returnFeatures.set("crossings", crossingPoints);
        return returnFeatures;
    }

    private hasCrossedAxis(sample: number) {
        const hasCrossedFromAbove = this.previousSample > 0.0 && sample <= 0.0;
        const hasCrossedFromBelow = this.previousSample <= 0.0 && sample > 0.0;
        return hasCrossedFromBelow || hasCrossedFromAbove;
    }
}
