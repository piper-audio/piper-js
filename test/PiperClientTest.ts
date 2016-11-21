/**
 * Created by lucas on 18/11/2016.
 */
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {
    FrequencyMetaDataStub,
    FrequencyDomainExtractorStub
} from "./fixtures/FrequencyDomainExtractorStub";
import {FeatsService, FeatureExtractorFactory} from "../src/FeatsService";
import {KissRealFft, RealFftFactory} from "../src/fft/RealFft";
import {PiperClient} from "../src/PiperClient";
import {AdapterFlags} from "../src/FeatureExtractor";
import {ProcessResponse} from "../src/Piper";
import {fromSeconds, Timestamp} from "../src/Timestamp";
import {
    FeatureExtractorStub,
    MetaDataStub
} from "./fixtures/FeatureExtractorStub";
chai.should();
chai.use(chaiAsPromised);


describe("PiperClient", () => {
    const fftFactory: RealFftFactory = (size: number) => new KissRealFft(size);
    const freqStubInitCallback: FeatureExtractorFactory = sr => new FrequencyDomainExtractorStub();
    const timeStubInitCallback: FeatureExtractorFactory = sr => new FeatureExtractorStub();
    const sampleRate: number = 16;
    const blockSize: number = 8;
    const stepSize: number = 4;

    it("should shift the timestamp for features returned from freq. domain extractors loaded with AdaptInputDomain by half the black size", () => {
        const service = new FeatsService(
            fftFactory,
            {extractor: freqStubInitCallback, metadata: FrequencyMetaDataStub},
            {extractor: timeStubInitCallback, metadata: MetaDataStub}
        );

        const client = new PiperClient(service);

        const loadConfigureProcessWith = (key: string, adapterFlags: AdapterFlags[], outputId: string): Promise<Timestamp> => {
            return client.load({
                key: key,
                inputSampleRate: sampleRate,
                adapterFlags: adapterFlags
            })
            .then(response => client.configure({
                handle: response.handle,
                configuration: {
                    blockSize: blockSize,
                    stepSize: stepSize,
                    channelCount: 1
                }
            }))
            .then(response => client.process({
                handle: response.handle,
                processInput: {
                    timestamp: {s: 0, n: 0},
                    inputBuffers: [new Float32Array(blockSize)]
                }
            }))
            .then((response: ProcessResponse) => response.features.get(outputId)[0].timestamp)
        };

        const expectedFreqTimestamp = fromSeconds(0.5 * blockSize / sampleRate);
        const freqOutputId = FrequencyMetaDataStub.basicOutputInfo[0].identifier;
        const timeOutputId = MetaDataStub.basicOutputInfo[0].identifier;
        return Promise.all([
            loadConfigureProcessWith(FrequencyMetaDataStub.key, [AdapterFlags.AdaptInputDomain], freqOutputId),
            loadConfigureProcessWith(FrequencyMetaDataStub.key, [AdapterFlags.AdaptAll], freqOutputId),
            loadConfigureProcessWith(FrequencyMetaDataStub.key, [AdapterFlags.AdaptAllSafe], freqOutputId),
            loadConfigureProcessWith(MetaDataStub.key, [AdapterFlags.AdaptAllSafe], timeOutputId)
        ]).should.eventually.eql([expectedFreqTimestamp, expectedFreqTimestamp, expectedFreqTimestamp, {s: 0, n: 0}]);
    });

});