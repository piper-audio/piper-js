/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */
/**
 * Created by lucas on 02/09/2016.
 */
import {ProcessInput} from "../src/core";
import {segment, toProcessInputStream} from "../src/audio";

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

function bufferToAudioData(buffer: AudioBuffer): Float32Array[] {
    const nChannels = buffer.numberOfChannels;
    const channels = new Array<Float32Array>(nChannels);
    for (let i = 0; i < nChannels; ++i) {
        channels[i] = buffer.getChannelData(i);
    }
    return channels;
}

export function segmentAudioBuffer(blockSize: number,
                                    stepSize: number,
                                    audioBuffer: AudioBuffer): IterableIterator<ProcessInput> {
    return toProcessInputStream({
        frames: segment(blockSize, stepSize, bufferToAudioData(audioBuffer)),
        format: {
            channelCount: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate
        }
    }, stepSize);
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
