/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */
/**
 * Created by lucast on 31/08/2016.
 */


import {
    FeatureTimeAdjuster, createFeatureTimeAdjuster
} from "./FeatureTimeAdjuster";
import {FeatureSet} from "./Feature";
import {Timestamp, makeTimestamp, toSeconds} from "./Timestamp";
import {
    ExtractorHandle, ListResponse, LoadRequest, ConfigurationRequest, ConfigurationResponse,
    LoadResponse, ProcessRequest, FinishRequest, ProcessResponse, FinishResponse, ListRequest, Service
} from "./Piper";
import {
    StaticData, AdapterFlags, ProcessInput,
    InputDomain, Configuration
} from "./FeatureExtractor";

export class PiperClient implements Service {
    private timeAdjusters: Map<string, FeatureTimeAdjuster>;
    private handleToSampleRate: Map<ExtractorHandle, number>;
    private handleToStaticData: Map<ExtractorHandle, StaticData>;
    private handleToAdapterFlags: Map<ExtractorHandle, AdapterFlags[]>;
    private handleToConfiguration: Map<ExtractorHandle, Configuration>;
    private service: Service;

    constructor(service: Service) {
        this.timeAdjusters = new Map();
        this.handleToSampleRate = new Map();
        this.handleToStaticData = new Map();
        this.handleToAdapterFlags = new Map();
        this.handleToConfiguration = new Map();
        this.service = service;
    }

    public list(request: ListRequest): Promise<ListResponse> {
        return this.service.list(request);
    }

    public load(request: LoadRequest): Promise<LoadResponse> {
        return this.service.load(request)
            .then(response => {
                this.handleToSampleRate.set(response.handle, request.inputSampleRate);
                this.handleToStaticData.set(response.handle, response.staticData);
                this.handleToAdapterFlags.set(response.handle, request.adapterFlags);
                return response;
            });
    }

    public configure(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.service.configure(request)
            .then(response => {
                this.handleToConfiguration.set(response.handle, request.configuration);
                for (let output of response.outputList) {
                    this.timeAdjusters.set(output.basic.identifier, createFeatureTimeAdjuster(
                        output.configured, request.configuration.stepSize / this.handleToSampleRate.get(request.handle))
                    );
                }
                return response;
            });
    }

    public process(request: ProcessRequest): Promise<ProcessResponse> {
        if (!PiperClient.isInputDomainAdapted(this.handleToAdapterFlags.get(request.handle))) {
            this.convertProcessInputToFrequencyDomain(request.processInput);
        }

        return this.service.process(request).then(response => {
            this.adjustFeatureTimes(
                response.features,
                response.handle,
                request.processInput.timestamp
            );

            return {
                handle: request.handle,
                features: response.features
            };
        });
    }

    public finish(request: FinishRequest): Promise<FinishResponse> {
        return this.service.finish(request).then(response => {
            this.adjustFeatureTimes(
                response.features,
                response.handle
            );

            this.handleToSampleRate.delete(request.handle);
            return {
                handle: request.handle,
                features: response.features
            };
        });
    }

    private adjustFeatureTimes(features: FeatureSet,
                               handle: ExtractorHandle,
                               inputTimestamp?: Timestamp) {

        for (let [i, featureList] of features.entries()) {
            const adjuster: FeatureTimeAdjuster = this.timeAdjusters.get(i);
            featureList.map(feature => {
                adjuster.adjust(feature, inputTimestamp);

                if (this.isFrequencyDomainExtractor(handle)) {
                    const offset = this.handleToConfiguration.get(handle)
                            .blockSize * 0.5 / this.handleToSampleRate.get(handle);
                    feature.timestamp = makeTimestamp(toSeconds(feature.timestamp) + offset);
                }
            });
        }
    }

    private static isInputDomainAdapted(adapterFlags: AdapterFlags[]): boolean {
        return adapterFlags.length > 0
        && (
            adapterFlags.includes(AdapterFlags.AdaptAll)
            || adapterFlags.includes(AdapterFlags.AdaptAllSafe)
            || adapterFlags.includes(AdapterFlags.AdaptInputDomain)
        );
    }

    private convertProcessInputToFrequencyDomain(processInput: ProcessInput): void {
        // TODO if frequency domain extractor not loaded with AdaptInputDomain, process FFT
        throw new Error("FFT not implemented, load extractor with AdaptInputDomain.");
    }

    private isFrequencyDomainExtractor(handle: ExtractorHandle) {
        return this.handleToStaticData
                .get(handle)
                .inputDomain === InputDomain.FrequencyDomain;
    }
}
