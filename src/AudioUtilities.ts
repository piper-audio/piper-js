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

export function* segmentAudio(blockSize: number, stepSize: number, audioData: Float32Array): IterableIterator<Float32Array> {
    let nStep: number = 0;
    const nSteps: number = audioData.length / stepSize; // TODO this won't work for streaming input
    const isDone = (step: number) => step >= nSteps;

    do {
        const start: number = nStep++ * stepSize;
        const stop: number = start + blockSize;
        let subArray: Float32Array = audioData.subarray(start, stop);
        if (isDone(nStep))
            subArray = Float32Array.of(...subArray, ...new Float32Array(blockSize - subArray.length));
        yield subArray;
    } while(!isDone(nStep))
}

export function* lfo(sampleRate: number, frequency: number, amplitude: number = 1.0): IterableIterator<number> {
    const inverseSampleRate = 1.0 / sampleRate;
    let phase = 0.0;
    while (true) {
        yield amplitude * Math.sin(2.0 * Math.PI * phase);
        phase += frequency * inverseSampleRate;
        if (phase >= 1.0)
            phase -= 1.0;
    }
}

export function generateSineWave(frequency: number, lengthSeconds: number, sampleRate: number, amplitude: number = 1.0): Float32Array {
    const lfoGen: IterableIterator<number> = lfo(sampleRate, frequency, amplitude);
    return new Float32Array(Math.ceil(sampleRate * lengthSeconds)).map(() => lfoGen.next().value);
}