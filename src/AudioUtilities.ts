import {Feature} from "./Feature";
import {ProcessBlock} from "./PluginServer";
/**
 * Created by lucas on 02/09/2016.
 */


export function batchProcess(blocks: ProcessBlock[], process: (block: any) => Promise<Feature[][]>): Promise<Feature[][]> {
    const processPromises: (() => Promise<Feature[][]>)[] = blocks.map((block) => () => process(block));
    return processPromises.reduce((runningFeatures, nextBlock) => {
        return runningFeatures.then((features) => {
            return concatFeatures(features, nextBlock());
        });
    }, Promise.resolve([]));
}

function concatFeatures(running: Feature[][], nextBlock: Promise<Feature[][]>): Promise<Feature[][]> {
    return nextBlock.then((block) => {
        return running.concat(block);
    });
}

export class FrameCutter implements IterableIterator<Float32Array> {
    private nStep: number;
    private nSteps: number;

    constructor(public blockSize: number, public stepSize: number, private audioData: Float32Array) {
        this.nStep = 0;
        this.nSteps = audioData.length / this.stepSize; // TODO this won't work for streaming input
    };


    next(value?: any): IteratorResult<Float32Array> {
        const start: number = this.nStep++ * this.stepSize;
        const stop: number = start + this.blockSize;
        return {value: this.audioData.subarray(start, stop), done: this.nStep > this.nSteps}; // TODO this won't work for streaming input
    }

    [Symbol.iterator](): IterableIterator<Float32Array> {
        return this;
    }
}