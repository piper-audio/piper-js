/**
 * Created by lucast on 17/07/2017.
 */
// main barrel, import library functionality and export in desired shape

// exports for library consumption
import { PiperClient } from './PiperClient';
import * as timestamp from './Timestamp';
import * as fftUtils from './FftUtilities';
import {
    PiperVampService,
    PiperVampSynchronousService,
    PiperVampFeatureExtractor
} from './PiperVampService';
import {
    FeatureExtractorSynchronousService,
    FeatureExtractorService
} from './FeatureExtractorService';
import { PiperSimpleClient } from './HigherLevelUtilities';
import * as streamingStuff from './StreamingService';
import * as ZeroCrossings from './extractors/ZeroCrossings';
import * as webWorkerClientStuff from './client-stubs/WebWorkerStreamingClient';
import {WebWorkerStreamingServer} from './servers/WebWorkerStreamingServer';
import * as extractorStuff from './FeatureExtractor';
import * as piperStuff from './Piper';

// re-exports
export * from './Piper';
export * from './FeatureExtractor';
export * from './Feature';
export * from './protocols/WebWorkerProtocol';
export {RequestIdProvider} from './client-stubs/WebWorkerStreamingClient';
export {RealFft} from './fft/RealFft';
export {
    StreamingProgress,
    StreamingConfiguration,
    StreamingResponse,
    StreamingService,
    ProgressCallback
} from './StreamingService';
export {Timestamp} from './Timestamp';

export const core = Object.assign({
    PiperClient,
    PiperSimpleClient,
    timestamp,
    fft: Object.assign({}, fftUtils) // might add more
}, piperStuff);

export const vamp = {
    PiperVampService,
    PiperVampSynchronousService,
    PiperVampFeatureExtractor,
};

export const streaming = streamingStuff;

export const worker = Object.assign(
    {WebWorkerStreamingServer},
    webWorkerClientStuff
);

export const extractor = Object.assign(
    {
        FeatureExtractorSynchronousService,
        FeatureExtractorService
    },
    extractorStuff
);

export const extractors = {
    ZeroCrossings
};