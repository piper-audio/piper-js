/**
 * Created by lucast on 30/08/2016.
 */

import {Timestamp} from "./Timestamp";
import {FeatureSet} from "./Feature";
import * as base64 from "base64-js";
import {AdapterFlags, StaticData, Configuration, OutputList, ProcessInput} from "./FeatureExtractor";

export interface Request {
    type: string;
    content?: any; // TODO create a more meaningful type for this
}

export interface Response {
    type: string;
    success: boolean;
    errorText?: string;
    content?: any; // TODO create a more meaningful type for this
}

export interface LoadRequest {
    pluginKey: string;
    inputSampleRate: number;
    adapterFlags: AdapterFlags[];
}

export type PluginHandle = number;

export interface LoadResponse {
    pluginHandle: PluginHandle;
    staticData: StaticData;
    defaultConfiguration: Configuration;
}

export interface ConfigurationRequest {
    pluginHandle: PluginHandle;
    configuration: Configuration;
}

export interface ConfigurationResponse {
    pluginHandle: PluginHandle;
    outputList: OutputList;
}

export interface ProcessRequest {
    pluginHandle: PluginHandle;
    processInput: ProcessInput;
}

export interface ListResponse {
    plugins: StaticData[];
}

export interface ModuleClient {
    listPlugins(): Promise<ListResponse>;
    loadPlugin(request: LoadRequest) : Promise<LoadResponse>;
    configurePlugin(request: ConfigurationRequest): Promise<ConfigurationResponse>;
    process(request: ProcessRequest): Promise<FeatureSet>;
    finish(pluginHandle: PluginHandle): Promise<FeatureSet>;
}

export enum ProcessEncoding {
    Base64,
    Json,
    Raw
}

export interface ModuleRequestHandler { // should this just be called Server?
    handle(request: Request): Promise<Response>;
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
    pluginHandle: number,
    features: WireFeatureSet
}

