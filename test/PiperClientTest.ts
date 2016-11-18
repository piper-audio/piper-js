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
import {makeTimestamp, Timestamp} from "../src/Timestamp";
chai.should();
chai.use(chaiAsPromised);


describe("PiperClient", () => {
    const fftFactory: RealFftFactory = (size: number) => new KissRealFft(size);
    const extractorFactory: FeatureExtractorFactory = sr => new FrequencyDomainExtractorStub();
    const sampleRate: number = 16;
    const blockSize: number = 8;
    const stepSize: number = 4;

    it("should shift the timestamp for features returned from freq. domain extractors loaded with AdaptInputDomain by half the black size", () => {
        const service = new FeatsService(
            fftFactory,
            {extractor: extractorFactory, metadata: FrequencyMetaDataStub}
        );

        const client = new PiperClient(service);

        const loadConfigureProcessWith = (adapterFlags: AdapterFlags[]): Promise<Timestamp> => {
            return client.load({
                key: FrequencyMetaDataStub.key,
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
            .then((response: ProcessResponse) => response.features.get(FrequencyMetaDataStub.basicOutputInfo[0].identifier)[0].timestamp)
        };

        const expectedTimestamp = makeTimestamp(0.5 * blockSize / sampleRate);
        return Promise.all([
            loadConfigureProcessWith([AdapterFlags.AdaptInputDomain]),
            loadConfigureProcessWith([AdapterFlags.AdaptAll]),
            loadConfigureProcessWith([AdapterFlags.AdaptAllSafe])
        ]).should.eventually.eql([expectedTimestamp, expectedTimestamp, expectedTimestamp]);
    });
});