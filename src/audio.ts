import {ProcessInput} from './core';
import {fromFrames, fromSeconds, Timestamp, toSeconds} from './time';

export type AudioData = Float32Array[];
export type FramedAudio = IterableIterator<AudioData>;

export interface AudioStreamFormat {
    channelCount: number;
    sampleRate: number;
    length?: number;
}

export interface AudioStream {
    frames: FramedAudio;
    format: AudioStreamFormat;
}

export type CreateAudioStreamFunction = (
    blockSize: number,
    stepSize: number,
    format: AudioStreamFormat,
    additionalArgs?: {[key: string]: any}
) => AudioStream;

export function* segment(blockSize: number,
                         stepSize: number,
                         audioData: AudioData): FramedAudio {
    let nStep: number = 0;
    const nSteps: number = audioData[0].length / stepSize;
    while (nStep < nSteps) {
        const start: number = nStep++ * stepSize;
        const stop: number = start + blockSize;
        yield audioData.map(channelData => {
            const block = channelData.subarray(start, stop);
            return block.length === blockSize
                ? channelData.subarray(start, stop)
                : Float32Array.of(
                    ...block,
                    ...new Float32Array(blockSize - block.length)
                );
        })
    }
}

export function* toProcessInputStream(
    stream: AudioStream,
    stepSize: number,
    offset?: Timestamp
): IterableIterator<ProcessInput> {
    let nFrame: number = 0;
    for (let frame of stream.frames) {
        const initialTimeStamp = fromFrames(nFrame, stream.format.sampleRate);
        const timestamp = offset ? fromSeconds(
            toSeconds(initialTimeStamp) + toSeconds(offset)
        ) : initialTimeStamp;
        yield {
            timestamp,
            inputBuffers: frame
        };
        nFrame += stepSize;
    }
}