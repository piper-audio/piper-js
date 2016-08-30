/**
 * Created by lucas on 26/08/2016.
 */
import {Feature} from "./Feature";

export interface FeatureExtractor {
    process(block: Float32Array): Feature[];
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
    identifier: string,
    name: string,
    description: string
}

export interface ValueExtents {
    min: number,
    max: number
}

export interface ParameterDescriptor {
    basic: BasicDescriptor,
    unit?: string,
    extents: ValueExtents,
    defaultValue: number,
    quantizeStep?: number,
    valueNames?: string[]
}

export interface StaticData {
    key: string,
    basic: BasicDescriptor,
    maker?: string,
    copyright?: string,
    version: number,
    category?: string[],
    minChannelCount: number,
    maxChannelCount: number,
    parameters?: ParameterDescriptor[],
    programs?: string[],
    inputDomain: InputDomain,
    basicOutputInfo: BasicDescriptor[]
}

export interface OutputDescriptor {
    basic: BasicDescriptor,
    unit?: string,
    binCount?: number,
    binNames?: string[],
    extents?: ValueExtents,
    quantizeStep?: number,
    sampleType: SampleType,
    sampleRate?: number,
    hasDuration: boolean
}

export interface Configuration {
    channelCount: number,
    stepSize: number,
    blockSize: number
}