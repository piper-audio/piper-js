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
import * as streaming from './StreamingService';
import * as ZeroCrossings from './extractors/ZeroCrossings';
import * as webWorkerClientStuff from './client-stubs/WebWorkerStreamingClient';
import {WebWorkerStreamingServer} from './servers/WebWorkerStreamingServer';
import * as extractor from './FeatureExtractor';
import * as piperStuff from './Piper';

// Perhaps something like ?
export const piper = {
    core: Object.assign({
        PiperClient,
        PiperSimpleClient,
        timestamp,
        fft: Object.assign({}, fftUtils) // might add more
    }, piperStuff),
    vamp: {
        PiperVampService,
        PiperVampSynchronousService,
        PiperVampFeatureExtractor,
    },
    streaming,
    worker: Object.assign(
        {WebWorkerStreamingServer},
        webWorkerClientStuff
    ),
    extractor: Object.assign(
        {
            FeatureExtractorSynchronousService,
            FeatureExtractorService
        },
        extractor
    ),
    extractors: {
        ZeroCrossings
    }
};
export type PiperModule = typeof piper;
export default piper;
module.exports = piper;