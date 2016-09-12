import {Timestamp} from "./Timestamp";
import {FeatureSet} from "./Feature";
/**
 * Created by lucast on 30/08/2016.
 */
export interface Request {
    type: string,
    content?: any //TODO create a more meaningful type for this
}

export interface Response {
    type: string,
    success: boolean,
    errorText?: string,
    content?: any // TODO create a more meaningful type for this
}

export interface LoadRequest {
    pluginKey: string,
    inputSampleRate: number,
    adapterFlags: AdapterFlags[]
}

export type PluginHandle = number;

export interface LoadResponse {
    pluginHandle: PluginHandle,
    staticData: StaticData,
    defaultConfiguration: Configuration
}

export interface ConfigurationRequest {
    pluginHandle: PluginHandle,
    configuration: Configuration
}

export interface ConfigurationResponse {
    outputList: OutputDescriptor[]
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
    pluginKey: string,
    basic: BasicDescriptor,
    maker?: string,
    copyright?: string,
    pluginVersion: number,
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

export interface ProcessBlock {
    timestamp: Timestamp,
    inputBuffers: {values: Float32Array}[];
}

export interface ProcessRequest {
    pluginHandle: PluginHandle,
    processInput: ProcessBlock
}

export interface ListFunction {
    (): Promise<StaticData[]>
}

export interface LoadFunction {
    (request: LoadRequest) : Promise<LoadResponse>
}

export interface ConfigurationFunction {
    (request: ConfigurationRequest): Promise<ConfigurationResponse>
}

export interface ProcessFunction {
    (request: ProcessRequest): Promise<FeatureSet>
}

export interface FinishFunction {
    (pluginHandle: PluginHandle): Promise<FeatureSet>
}

export interface PluginServer {
    listPlugins: ListFunction,
    loadPlugin: LoadFunction,
    configurePlugin: ConfigurationFunction,
    process: ProcessFunction,
    processJson: ProcessFunction,
    processBase64: ProcessFunction,
    processRaw: ProcessFunction,
    finish: FinishFunction
}

