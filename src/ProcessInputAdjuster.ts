/**
 * Created by lucast on 20/10/2016.
 */
import {ProcessInput, Configuration} from "./FeatureExtractor";
import {makeTimestamp, toSeconds} from "./Timestamp";

export interface ProcessInputAdjuster {
    adjust(input: ProcessInput): ProcessInput;
}

export class ProcessInputBuffersAdjuster implements ProcessInputAdjuster {
    private buffers: Float32Array[];
    private offset: number;
    private blockSize: number;
    private stepSize: number;

    constructor(config: Configuration) {
        this.blockSize = config.blockSize;
        this.stepSize = config.stepSize;
        this.offset = Math.floor(0.5 * this.blockSize);
        this.buffers = [...Array(config.channelCount)].map(
            () => new Float32Array(this.blockSize + this.offset)
        );
    }

    adjust(input: ProcessInput): ProcessInput {
        return {
            timestamp: input.timestamp,
            inputBuffers: input.inputBuffers.map((buffer, i) => {
                this.buffers[i].copyWithin(0, this.stepSize, this.blockSize + this.offset);
                this.buffers[i].set(buffer.subarray(0, this.blockSize), this.offset);
                return this.buffers[i].slice(0, this.blockSize);
            })
        };
    }
}

export class ProcessInputTimestampAdjuster implements ProcessInputAdjuster {
    private adjustmentSeconds: number;

    constructor(blockSize: number, sampleRate: number) {
        this.adjustmentSeconds = 0.5 * (blockSize / sampleRate);
    }

    adjust(input: ProcessInput): ProcessInput {
        return {
            timestamp: makeTimestamp(toSeconds(input.timestamp) + this.adjustmentSeconds),
            inputBuffers: input.inputBuffers
        }
    }
}