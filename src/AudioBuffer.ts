/**
 * Created by lucast on 07/09/2016.
 */
export interface AudioBuffer {
    sampleRate: number,
    length: number,
    duration: number,
    numberOfChannels: number,
    getChannelData(channel: number): Float32Array,
    copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel?: number): void;
    copyToChannel(source:Float32Array, channelNumber: number, startInChannel?: number): void;
}

export class FeatsAudioBuffer implements AudioBuffer {
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
        const buffer = new FeatsAudioBuffer(channelData.length, channelData[0].length, sampleRate);
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