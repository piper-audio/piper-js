/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */
/**
 * Created by lucast on 31/08/2016.
 */


import {
    FeatureTimeAdjuster, createFeatureTimeAdjuster
} from "./FeatureTimeAdjuster";
import {FeatureSet} from "./Feature";
import {Timestamp} from "./Timestamp";
import {
    ExtractorHandle, ListResponse, LoadRequest, ConfigurationRequest, ConfigurationResponse,
    LoadResponse, ProcessRequest, FinishRequest, ProcessResponse, FinishResponse, ListRequest, Service
} from "./Piper";

export class PiperClient implements Service {
    private timeAdjusters: Map<string, FeatureTimeAdjuster>;
    private handleToSampleRate: Map<ExtractorHandle, number>;
    private service: Service;

    constructor(service: Service) {
        this.timeAdjusters = new Map();
        this.handleToSampleRate = new Map();
        this.service = service;
    }

    public list(request: ListRequest): Promise<ListResponse> {
        return this.service.list(request);
    }

    public load(request: LoadRequest): Promise<LoadResponse> {
        return this.service.load(request)
            .then(response => {
                this.handleToSampleRate.set(response.handle, request.inputSampleRate);
                return response;
            });
    }

    public configure(request: ConfigurationRequest): Promise<ConfigurationResponse> {
        return this.service.configure(request)
            .then(response => {
                for (let output of response.outputList) {
                    this.timeAdjusters.set(output.basic.identifier, createFeatureTimeAdjuster(
                        output, request.configuration.stepSize / this.handleToSampleRate.get(request.handle))
                    );
                }
                return response;
            });
    }

    public process(request: ProcessRequest): Promise<ProcessResponse> {
        return this.service.process(request).then(response => {
            this.adjustFeatureTimes(response.features, request.processInput.timestamp);
            return {
                handle: request.handle,
                features: response.features
            } as ProcessResponse;
        });
    }

    public finish(request: FinishRequest): Promise<FinishResponse> {
        return this.service.finish(request).then(response => {
            this.adjustFeatureTimes(response.features);
            this.handleToSampleRate.delete(request.handle);
            return {
                handle: request.handle,
                features: response.features
            } as FinishResponse;
        });
    }

    private adjustFeatureTimes(features: FeatureSet, inputTimestamp?: Timestamp) {
        for (let [i, featureList] of features.entries()) {
            const adjuster: FeatureTimeAdjuster = this.timeAdjusters.get(i);
            featureList.map(feature => adjuster.adjust(feature, inputTimestamp));
        }
    }
}
