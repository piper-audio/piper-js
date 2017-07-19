/**
 * Created by lucast on 17/07/2017.
 */
// main barrel, import library functionality and export in desired shape

// exports for library consumption
import * as core from './core';
import * as fft from './fft';
import * as audio from './audio';
import * as emscripten from './emscripten';
import * as oneShot from './one-shot';
import * as streaming from './streaming';
import * as time from './time';
import ZeroCrossings from './extractors/zero-crossings';
import * as webWorker from './web-worker';

export = {
    core,
    fft,
    audio,
    emscripten,
    oneShot,
    streaming,
    time,
    extractors: {
        ZeroCrossings
    },
    webWorker
};