/**
 * Created by lucast on 17/07/2017.
 */

// main barrel, import library functionality and export in desired shape

// exports for library consumption
const { PiperClient } = require('./dist/ts/PiperClient');
const timestamp = require('./dist/ts/Timestamp');
const fftUtils = require('./dist/ts/FftUtilities');
const {
    PiperVampService,
    PiperVampSynchronousService,
    PiperVampFeatureExtractor
} = require('./dist/ts/PiperVampService');
const {
    FeatureExtractorSynchronousService,
    FeatureExtractorService
} = require('./dist/ts/FeatureExtractorService');
const { PiperSimpleClient } = require('./dist/ts/HigherLevelUtilities');
const streaming = require('./dist/ts/StreamingService');
const ZeroCrossings = require('./dist/ts/extractors/ZeroCrossings');
const webWorkerClientStuff = require('./dist/ts/client-stubs/WebWorkerStreamingClient');
const {WebWorkerStreamingServer} = require('./dist/ts/servers/WebWorkerStreamingServer');
const extractor = require('./dist/ts/FeatureExtractor');
const piperStuff = require('./dist/ts/Piper');

// Perhaps something like ?
module.exports = {
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