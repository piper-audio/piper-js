/**
 * Created by lucast on 17/07/2017.
 */
// main barrel, import library functionality and export in desired shape

// exports for library consumption
import {Client, FeatureExtractorSynchronousService} from './core';
import * as timestamp from './time';
import * as fftUtils from './fft';
import {
    EmscriptenService,
    EmscriptenSynchronousService,
    EmscriptenFeatureExtractor
} from './emscripten';
import {
    FeatureExtractorService
} from './core';
import { OneShotExtractionClient } from './one-shot';
import * as streamingStuff from './streaming';
import * as ZeroCrossings from './extractors/ZeroCrossings';
import * as webWorkerClientStuff from './clients/web-worker-streaming';
import {WebWorkerStreamingServer} from './servers/web-worker-streaming';
import * as extractorStuff from './FeatureExtractor';
import * as piperStuff from './core';
import * as workerProtocol from './protocols/web-worker';
import * as featureStuff from './Feature';
import {RealFft as IRealFft} from './fft';
import {
    StreamingProgress,
    StreamingConfiguration,
    StreamingResponse,
    StreamingService,
    ProgressCallback
} from './streaming';
import {Timestamp} from './time';

const core = Object.assign({
    PiperClient: Client,
    PiperSimpleClient: OneShotExtractionClient,
    timestamp,
    fft: Object.assign({}, fftUtils)
}, piperStuff, featureStuff);

// TypeScript merges this with the above
namespace core {
    export namespace fft {
        // export interface RealFft extends IRealFft {}
    }
}

const vamp = {
    PiperVampService: EmscriptenService,
    PiperVampSynchronousService: EmscriptenSynchronousService,
    PiperVampFeatureExtractor: EmscriptenFeatureExtractor,
};

const streaming = streamingStuff;

const worker = Object.assign(
    {WebWorkerStreamingServer},
    webWorkerClientStuff,
    workerProtocol
);

const extractor = Object.assign(
    {
        FeatureExtractorSynchronousService,
        FeatureExtractorService
    },
    extractorStuff
);

const extractors = {
    ZeroCrossings
};