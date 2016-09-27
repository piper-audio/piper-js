/**
 * Created by lucas on 26/08/2016.
 */
import {FeatureSet} from "./Feature";
import {Timestamp} from "./Timestamp";

export interface FeatureExtractor {
    configure(configuration: Configuration): ConfiguredOutputs;
    getDefaultConfiguration(): Configuration;
    process(block: ProcessInput): FeatureSet;
    finish(): FeatureSet;
}


export enum InputDomain {
    TimeDomain,
    FrequencyDomain
}

export enum SampleType {
    OneSamplePerStep,
    FixedSampleRate,
    VariableSampleRate
}

export enum AdapterFlags {
    AdaptNone,
    AdaptInputDomain,
    AdaptChannelCount,
    AdaptBufferSize,
    AdaptAllSafe,
    AdaptAll
}

export interface BasicDescriptor {
    identifier: string;
    name: string;
    description: string;
}

export interface ValueExtents {
    min: number;
    max: number;
}

export interface ParameterDescriptor {
    basic: BasicDescriptor;
    unit?: string;
    extents: ValueExtents;
    defaultValue: number;
    quantizeStep?: number;
    valueNames?: string[];
}

export interface StaticData {
    pluginKey: string;
    basic: BasicDescriptor;
    maker?: string;
    copyright?: string;
    pluginVersion: number;
    category?: string[];
    minChannelCount: number;
    maxChannelCount: number;
    parameters?: ParameterDescriptor[];
    programs?: string[];
    inputDomain: InputDomain;
    basicOutputInfo: BasicDescriptor[];
}

export type OutputIdentifier = string;

export interface ConfiguredOutputDescriptor {
    unit?: string;
    binCount?: number;
    binNames?: string[];
    extents?: ValueExtents;
    quantizeStep?: number;
    sampleType: SampleType;
    sampleRate?: number;
    hasDuration: boolean;
}

export type ConfiguredOutputs = Map<OutputIdentifier, ConfiguredOutputDescriptor>;

export interface OutputDescriptor {
    basic: BasicDescriptor;
    configured: ConfiguredOutputDescriptor;
}

export type OutputList = OutputDescriptor[];
export type ParameterIdentifier = string;
export type Parameters = Map<ParameterIdentifier, number>;

export interface Configuration {
    channelCount: number;
    stepSize: number;
    blockSize: number;
    parameterValues?: Parameters
}

export interface ProcessInput {
    timestamp: Timestamp;
    inputBuffers: Float32Array[];
}
