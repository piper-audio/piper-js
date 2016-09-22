/**
 * Created by lucas on 26/08/2016.
 */
import {FeatureSet} from "./Feature";
import {
    ProcessBlock, OutputDescriptor, StaticData, RuntimeOutputMap, OutputList,
    RuntimeOutputInfo, OutputIdentifier
} from "./ClientServer";

export interface FeatureExtractor {
    initialise(channels: number, stepSize: number, blockSize: number): boolean; // TODO channelCount vs channels?
    getPreferredStepSize(): number; // TODO not in StaticData? should they be? I guess this could be sample rate dependant
    getPreferredBlockSize(): number; // TODO not in StaticData? should they be? I guess this could be sample rate dependant
    getMetadata(): StaticData;
    getOutputDescriptors(): OutputDescriptor[];
    process(block: ProcessBlock): FeatureSet;
    finish(): FeatureSet;
}

export abstract class FeatsFeatureExtractor implements FeatureExtractor {
    private metadata: StaticData;

    constructor(metadata: StaticData) {
        this.metadata = metadata;
    }

    public abstract initialise(channels: number, stepSize: number, blockSize: number): boolean;

    public getPreferredStepSize(): number {
        return 0;
    }

    public getPreferredBlockSize(): number {
        return 0;
    }

    public getMetadata(): StaticData {
        return this.metadata;
    }

    public getOutputDescriptors(): OutputList {
        return this.metadata.basicOutputInfo.map(basic => {
            return Object.assign({basic: basic}, Object.assign({
                unit: "",
                binCount: 0,
                binNames: [],
                quantizeStep: 1,
                sampleRate: 0,
            }, this.getRuntimeOutputInfo(basic.identifier)));
        });
    }

    public abstract getRuntimeOutputInfo(identifier: OutputIdentifier): RuntimeOutputInfo;
    public abstract process(block: ProcessBlock): FeatureSet;
    public abstract finish(): FeatureSet;
}