/**
 * Created by lucas on 26/08/2016.
 */
import {FeatureSet} from "./Feature";
import {Timestamp} from "./Timestamp";

export abstract class FeatureExtractor {
    abstract configure(configuration: Configuration): ConfigurationResponse;
    abstract getDefaultConfiguration(): Configuration;
    abstract process(block: ProcessInput): FeatureSet;
    abstract finish(): FeatureSet;
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

export type OutputIdentifier = string;

export interface StaticOutputDescriptor {
    typeURI?: string;
}

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

export interface StaticData {
    key: string;
    basic: BasicDescriptor;
    maker?: string;
    rights?: string;
    version: number;
    category?: string[];
    minChannelCount: number;
    maxChannelCount: number;
    parameters?: ParameterDescriptor[];
    programs?: string[];
    inputDomain: InputDomain;
    basicOutputInfo: BasicDescriptor[];
    staticOutputInfo?: Map<OutputIdentifier, StaticOutputDescriptor>;
}

export interface ConfigurationResponse {
    outputs: Map<OutputIdentifier, ConfiguredOutputDescriptor>;
    framing: Framing;
}

export interface OutputDescriptor {
    basic: BasicDescriptor;
    static?: StaticOutputDescriptor;
    configured: ConfiguredOutputDescriptor;
}

export type OutputList = OutputDescriptor[]; //!!! unused, because would normally be in Piper ConfigurationResponse
export type ParameterIdentifier = string;
export type Parameters = Map<ParameterIdentifier, number>;

export interface Framing {
    stepSize: number;
    blockSize: number;
}

export interface Configuration {
    channelCount: number;
    framing: Framing;
    parameterValues?: Parameters;
    currentProgram?: string;
}

export interface ProcessInput {
    timestamp: Timestamp;
    inputBuffers: Float32Array[];
}
