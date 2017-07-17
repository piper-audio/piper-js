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

// Perhaps something like ?
// const piper = {
//     core: {},
//     vamp: {},
//     streaming: {},
//     worker: {},
// };

// Just export everything we've imported for now
module.exports = Object.assign({
    PiperClient,
    PiperSimpleClient,
    timestamp,
    fft: Object.assign({}, fftUtils), // might add more
    PiperVampService,
    PiperVampSynchronousService,
    PiperVampFeatureExtractor,
    FeatureExtractorSynchronousService,
    FeatureExtractorService,
    streaming,
    ZeroCrossings,
    WebWorkerStreamingServer
}, webWorkerClientStuff);