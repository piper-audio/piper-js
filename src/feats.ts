/**
 * Created by lucast on 14/09/2016.
 */

export {FeatsModuleClient} from "./FeatureExtractionClient";
export {AdapterFlags, SampleType} from "./FeatureExtractor";
export {LocalModuleRequestHandler} from "./FeatureExtractionService";
export {batchProcess, generateSineWave, segmentAudioBuffer} from "./AudioUtilities";
export {makeTimestamp, frame2timestamp, toSeconds} from "./Timestamp";