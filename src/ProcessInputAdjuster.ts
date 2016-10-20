/**
 * Created by lucast on 20/10/2016.
 */
import {ProcessInput} from "feats";

export interface ProcessInputAdjuster {
    adjust(input: ProcessInput): ProcessInput;
}

export class ProcessInputBuffersAdjuster implements ProcessInputAdjuster {
    private buffers: Float32Array[];
    private offset: number;
    private blockSize: number;
    private stepSize: number;

    constructor(blockSize: number, stepSize: number, channelCount: number) {
        this.blockSize = blockSize;
        this.stepSize = stepSize;
        this.offset = Math.floor(0.5 * blockSize);
        this.buffers = [...Array(channelCount)].map(
            () => new Float32Array(blockSize + this.offset)
        );
    }

    adjust(input: ProcessInput): ProcessInput {
        let channel: number = 0;
        return {
            timestamp: input.timestamp,
            inputBuffers: input.inputBuffers.map(buffer => {
                const c: number = channel++;
                this.buffers[c].copyWithin(0, this.stepSize, this.blockSize + this.offset);
                this.buffers[c].set(buffer.slice(0, this.blockSize), this.offset);
                // return here exposes internal arraybuffer,
                // but avoids allocating a new buffer
                // - also doesn't mutate input buffer which is desirable?
                return this.buffers[c].slice(0, this.blockSize);
            })
        };
    }
}