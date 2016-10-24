/**
 * Created by lucast on 20/10/2016.
 */
import {ProcessInput, Configuration} from "feats";

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
        let channel: number = 0;
        return {
            timestamp: input.timestamp,
            inputBuffers: input.inputBuffers.map(buffer => {
                const c: number = channel++;
                this.buffers[c].copyWithin(0, this.stepSize, this.blockSize + this.offset);
                this.buffers[c].set(buffer.subarray(0, this.blockSize), this.offset);
                return this.buffers[c].slice(0, this.blockSize);
            })
        };
    }
}