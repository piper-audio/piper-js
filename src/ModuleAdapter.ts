/**
 * Created by lucast on 20/09/2016.
 */
import {FeatureExtractor} from "./FeatureExtractor";
import {StaticData, LoadRequest, LoadResponse} from "./ClientServer";

// TODO in VamPipe, this is where it is decided how to adapt the input domain, channels, buffering etc. How should this be handled here?
// TODO PluginInputDomainAdapter could be the appropriate abstraction for different platforms to provide FFT implementations
interface IModuleAdapter {
    getStaticData(): StaticData;
    loadFeatureExtractor(request: LoadRequest): LoadResponse;
    createFeatureExtractor(sampleRate: number): FeatureExtractor;
}

type FeatureExtractorFactory = (sampleRate: number) => FeatureExtractor;

export class ModuleAdapter implements IModuleAdapter {
    private extractorFactory: FeatureExtractorFactory;
    private extractorMetaData: StaticData;

    constructor(extractorFactory: FeatureExtractorFactory, extractorMetaData: StaticData) {
        this.extractorFactory = extractorFactory;
        this.extractorMetaData = extractorMetaData;
    }

    getStaticData(): StaticData {
        return undefined;
    }

    loadFeatureExtractor(request: LoadRequest): LoadResponse {
        return undefined;
    }

    createFeatureExtractor(sampleRate: number): FeatureExtractor {
        return this.extractorFactory(sampleRate);
    }
}