/**
 * Created by lucast on 03/10/2016.
 */

import {FeatureSet} from "./Feature";


export interface FeatureExtractionClient {
    list(): Promise<ListResponse>;
    load(request: LoadRequest) : Promise<LoadResponse>;
    configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    process(request: ProcessRequest): Promise<FeatureSet>;
    finish(request: FinishRequest): Promise<FeatureSet>;
}