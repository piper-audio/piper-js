/**
 * Created by lucas on 26/08/2016.
 */
import {FeatureSet} from "./Feature";
import {ProcessInput} from "./ClientServer";

export interface FeatureExtractor {
    process(block: ProcessInput): FeatureSet;
}