/**
 * Created by lucast on 30/08/2016.
 */

import {Timestamp} from "./Timestamp";
import {FeatureSet} from "./Feature";
import * as base64 from "base64-js";
import {AdapterFlags, StaticData, Configuration, OutputList, ProcessInput} from "./FeatureExtractor";

export interface RpcRequest {
    method: string;
    params?: any; // TODO create a more meaningful type for this
}

export interface ResponseError {
    code: number;
    message: string;
}

export interface RpcResponse {
    method: string;
    result?: any; // TODO create a more meaningful type for this
    error?: ResponseError;
}

export interface LoadRequest {
    key: string;
    inputSampleRate: number;
    adapterFlags: AdapterFlags[];
}

export type ExtractorHandle = number;

export interface ListRequest {
}

export interface ListResponse {
    available: StaticData[];
}

export interface LoadResponse {
    handle: ExtractorHandle;
    staticData: StaticData;
    defaultConfiguration: Configuration;
}

export interface ConfigurationRequest {
    handle: ExtractorHandle;
    configuration: Configuration;
}

export interface ConfigurationResponse {
    handle: ExtractorHandle;
    outputList: OutputList;
}

export interface ProcessRequest {
    handle: ExtractorHandle;
    processInput: ProcessInput;
}

export interface FinishRequest {
    handle: ExtractorHandle;
}

export interface ModuleClient {
    list(request: ListRequest): Promise<ListResponse>;
    load(request: LoadRequest) : Promise<LoadResponse>;
    configure(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    process(request: ProcessRequest): Promise<FeatureSet>;
    finish(request: FinishRequest): Promise<FeatureSet>;
}

export enum ProcessEncoding {
    Base64,
    Json,
    Raw
}

export interface ModuleRequestHandler { // should this just be called Server?
    handle(request: RpcRequest): Promise<RpcResponse>;
    getProcessEncoding(): ProcessEncoding;
}

export function toBase64(values: Float32Array): string {
    // We want a base-64 encoding of the raw memory backing the
    // typed array. We assume byte order will be the same when the
    // base-64 stuff is decoded, but I guess that might not be
    // true in a network situation. The Float32Array docs say "If
    // control over byte order is needed, use DataView instead" so
    // I guess that's a !!! todo item
    return base64.fromByteArray(new Uint8Array(values.buffer));
}

export function fromBase64(b64: string): Float32Array {
    // The base64 module expects input to be padded to a
    // 4-character boundary, but the C++ VampJson code does not do
    // that, so let's do it here
    while (b64.length % 4 > 0) {
        b64 += "=";
    }
    // !!! endianness, as above.
    return new Float32Array(base64.toByteArray(b64).buffer);
}

export interface WireFeature {
    timestamp?: Timestamp;
    duration?: Timestamp;
    label?: string;
    featureValues?: number[] | string;
}

export type WireFeatureList = WireFeature[];

export interface WireFeatureSet {
    [key: string]: WireFeatureList;
}

export interface ProcessResponse {
    handle: number,
    features: WireFeatureSet
}

