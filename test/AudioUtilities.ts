/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */
/**
 * Created by lucas on 02/09/2016.
 */
import {Timestamp, frame2timestamp} from "../src/Timestamp";
import {FeatureList, FeatureSet} from "../src/Feature";
import {ProcessInput} from "../src/FeatureExtractor";

export interface AudioBuffer {
    sampleRate: number,
    length: number,
    duration: number,
    numberOfChannels: number,
    getChannelData(channel: number): Float32Array,
    copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel?: number): void;
    copyToChannel(source:Float32Array, channelNumber: number, startInChannel?: number): void;
}

export class AudioBufferStub implements AudioBuffer {
    sampleRate: number;
    length: number;
    duration: number;
    numberOfChannels: number;

    private channelData: Float32Array[];

    constructor(numOfChannels: number, length: number, sampleRate: number) {
        this.numberOfChannels = numOfChannels;
        this.length = length;
        this.sampleRate = sampleRate;
        this.duration = sampleRate * this.length;
    }

    static fromExistingFloat32Arrays(channelData: Float32Array[], sampleRate: number) {
        const buffer = new AudioBufferStub(channelData.length, channelData[0].length, sampleRate);
        buffer.channelData = channelData;
        return buffer;
    }

    getChannelData(channel: number): Float32Array {
        return this.channelData[channel]; // TODO bound checking
    }

    copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel?: number): void {
        destination.set(this.channelData[channelNumber]); // TODO startInChannel offset and bound checking (channel and length)
    }

    copyToChannel(source: Float32Array, channelNumber: number, startInChannel?: number): void {
        this.channelData[channelNumber].set(source); // TODO startInChannel offset and bound checking (channel and length)
    }
}

export function batchProcess(blocks: Iterable<ProcessInput>,
                             process: (block: ProcessInput) => Promise<FeatureSet>,
                             finish: () => Promise<FeatureSet>)
: Promise<FeatureSet> {
                                 
    const processThunks: (() => Promise<FeatureSet>)[] =
        [...blocks].map(block => () => process(block))
        .concat([finish]);
    
    return processThunks.reduce((runningFeatures, nextBlock) => {
        return runningFeatures.then((features) => {
            return concatFeatures(features, nextBlock());
        });
    }, Promise.resolve(new Map() as FeatureSet));
}

function concatFeatures(running: FeatureSet, nextBlock: Promise<FeatureSet>): Promise<FeatureSet> {
    return nextBlock.then((block) => {
        for (const [i, feature] of block.entries()) {
            createOrConcat(feature, i, running);
        }
        return running;
    });
}

function createOrConcat(data: FeatureList, key: string, map: FeatureSet) {
    map.has(key) ? map.set(key, map.get(key).concat(data)) : map.set(key, data);
}

export function* segment(blockSize: number, stepSize: number, buffer: Float32Array): IterableIterator<Float32Array> {
    let nStep: number = 0;
    const nSteps: number = buffer.length / stepSize; // TODO this won't work for streaming input
    const isDone = (step: number) => step >= nSteps;

    do {
        const start: number = nStep++ * stepSize;
        const stop: number = start + blockSize;
        let subArray: Float32Array = buffer.subarray(start, stop);
        if (isDone(nStep))
            subArray = Float32Array.of(...subArray, ...new Float32Array(blockSize - subArray.length));
        yield subArray;
    } while (!isDone(nStep));
}

export function* segmentAudioBuffer(blockSize: number, stepSize: number, audioBuffer: AudioBuffer): IterableIterator<ProcessInput> {
    let nStep: number = 0;
    const nSteps: number = audioBuffer.length / stepSize;
    const nChannels: number = audioBuffer.numberOfChannels;
    const channels: number[] = [...Array(nChannels).keys()];
    const isDone = (step: number) => step >= nSteps;

    do {
        const start: number = nStep * stepSize;
        const stop: number = start + blockSize;
        const currentTimestamp: Timestamp = frame2timestamp(nStep++ * stepSize, audioBuffer.sampleRate);
        const audioData: Float32Array[] = channels.map(channel => audioBuffer.getChannelData(channel));
        let subArrays: Float32Array[] = audioData.map(channelData => channelData.subarray(start, stop));
        if (isDone(nStep))
            subArrays = channels.map(channel => Float32Array.of(...subArrays[channel], ...new Float32Array(blockSize - subArrays[channel].length)));
        yield {
            timestamp: currentTimestamp,
            inputBuffers: subArrays
        };
    } while (!isDone(nStep))
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
