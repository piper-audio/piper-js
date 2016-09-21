/**
 * Created by lucas on 26/08/2016.
 */
import {FeatureSet} from "./Feature";
import {ProcessBlock} from "./ClientServer";

export interface FeatureExtractor {
    initialise(channels: number, stepSize: number, blockSize: number): boolean; // TODO channelCount vs channels?
    getPreferredStepSize(): number; // TODO not in StaticData? should they be? I guess this could be sample rate dependant
    getPreferredBlockSize(): number; // TODO not in StaticData? should they be? I guess this could be sample rate dependant
    process(block: ProcessBlock): FeatureSet;
}