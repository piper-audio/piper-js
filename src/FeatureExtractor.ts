/**
 * Created by lucas on 26/08/2016.
 */
import {FeatureSet} from "./Feature";
import {
    ProcessInput, Configuration, ConfiguredOutputs
} from "./ClientServer";

export interface FeatureExtractor {
    configure(configuration: Configuration): ConfiguredOutputs;
    getDefaultConfiguration(): Configuration;
    process(block: ProcessInput): FeatureSet;
    finish(): FeatureSet;
}