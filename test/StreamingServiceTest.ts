/**
 * Created by lucas on 31/03/2017.
 */
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {
    AudioStreamFormat,
    VectorFeatures,
    MatrixFeatures
} from "../src/HigherLevelUtilities";
import {Observable} from "rxjs";
import {
    PiperStreamingService,
    StreamingService,
    StreamingResponse
} from "../src/StreamingService";
import {KissRealFft} from "../src/fft/RealFft";
import {
    FeatureExtractorFactory,
    FeatureExtractorService
} from "../src/FeatureExtractorService";
import {
    FeatureExtractorStub,
    MetaDataStub
} from "./fixtures/FeatureExtractorStub";
import {FeatureList} from "../src/Feature";

chai.should();
chai.use(chaiAsPromised);

describe("StreamingService", () => {
    const extractorsToCreate: FeatureExtractorFactory[] = [{
        create: () => new FeatureExtractorStub(),
        metadata: MetaDataStub
    }];

    const streamFormat: AudioStreamFormat = {
        channelCount: 1,
        sampleRate: 4
    };
    const samples = [
        Float32Array.from([
            -1, -1, -1, -1,
            0,  0,  0,  0,
            1,  1,  1,  1
        ])
    ];
    
    const service: StreamingService = new PiperStreamingService(
        new FeatureExtractorService(
            (size: number) => new KissRealFft(size),
            ...extractorsToCreate
        )
    );
    const blockSize: number = 4;
    const stepSize: number = 2;
    const nBlocksToProcess = (samples[0].length / stepSize) + 1; //+1 for finish
    const getInputBlockAtStep = (nBlocksProcessed: number): Float32Array => {
        let expected = samples[0].subarray(
            nBlocksProcessed * stepSize,
            nBlocksProcessed * stepSize + blockSize
        );
        if (expected.length < blockSize) {
            expected = Float32Array.of(
                ...expected,
                ...new Float32Array(blockSize - expected.length)
            );
        }
        return expected;
    };

    it("Notifies observers after each process call", (done: MochaDone) => {
        const processStream: Observable<StreamingResponse> = service.process({
            audioData: samples,
            audioFormat: streamFormat,
            key: "stub:sum",
            outputId: "passthrough",
            blockSize: blockSize,
            stepSize: stepSize
        });
        let nBlocksProcessed = 0;

        const subscription = processStream.subscribe(
            (response) => {
                const features = (response.features.collected as FeatureList);
                const expected = getInputBlockAtStep(nBlocksProcessed);
                try {
                    if (features.length) {
                        features[0].featureValues.should.eql(expected);
                    }
                    ++nBlocksProcessed;
                } catch (e) {
                    done(e);
                }
            },
            (err) => done(err),
            () => {
                subscription.unsubscribe();
                try {
                    nBlocksProcessed.should.eql(nBlocksToProcess);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });

    it("Notifies observers after each collect call (matrix)", done => {
        const collectStream: Observable<StreamingResponse> = service.collect({
            audioData: samples,
            audioFormat: streamFormat,
            key: "stub:sum",
            outputId: "passthrough",
            blockSize: blockSize,
            stepSize: stepSize
        });
        let nBlocksProcessed = 0;

        const subscription = collectStream.subscribe(
            response => {
                const features = response.features.collected as MatrixFeatures;
                const expected = getInputBlockAtStep(nBlocksProcessed);
                try {
                    response.features.shape.should.eql("matrix");
                    if (features.data[0]) {
                        features.data[0].should.eql(expected);
                    }
                    ++nBlocksProcessed;
                } catch (e) {
                    done(e);
                }
            },
            err => done(err),
            () => {
                subscription.unsubscribe();
                try {
                    nBlocksProcessed.should.eql(nBlocksToProcess);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });

    it("Notifies observers after each collect call (vector)", done => {
        const collectStream: Observable<StreamingResponse> = service.collect({
            audioData: samples,
            audioFormat: streamFormat,
            key: "stub:sum",
            outputId: "sum",
            blockSize: blockSize,
            stepSize: stepSize
        });
        const expectedSums = [-4, -2, 0, 2, 4, 2];
        let nBlocksProcessed = 0;

        const subscription = collectStream.subscribe(
            response => {
                const features = response.features.collected as VectorFeatures;
                const expected = expectedSums[nBlocksProcessed];
                try {
                    response.features.shape.should.eql("vector");
                    if (features.data[0]) {
                        features.data[0].should.eql(expected);
                    }
                    ++nBlocksProcessed;
                } catch (e) {
                    done(e);
                }
            },
            err => done(err),
            () => {
                subscription.unsubscribe();
                try {
                    nBlocksProcessed.should.eql(nBlocksToProcess);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });

    it("Notifies observers of features extracted from finish method", done => {
        const collectStream: Observable<StreamingResponse> = service.collect({
            audioData: samples,
            audioFormat: streamFormat,
            key: "stub:sum",
            outputId: "finish",
            blockSize: blockSize,
            stepSize: stepSize
        });
        let nBlocksProcessed = 0;

        const subscription = collectStream.subscribe(
            response => {
                const features = response.features.collected as FeatureList;
                try {
                    response.features.shape.should.eql("list");
                    nBlocksProcessed = response.processedBlockCount;
                    if (nBlocksProcessed < nBlocksToProcess) {
                        features.length.should.eql(0);
                    } else {
                        features.length.should.eql(1);
                        features[0].featureValues[0].should.eql(1969);
                    }
                } catch (e) {
                    done(e);
                }
            },
            err => done(err),
            () => {
                subscription.unsubscribe();
                try {
                    nBlocksProcessed.should.eql(nBlocksToProcess);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });

    it("Notifies observers of errors", done => {
        const collectStream: Observable<StreamingResponse> = service.collect({
            audioData: samples,
            audioFormat: streamFormat,
            key: "stub:sum",
            outputId: "not-real",
            blockSize: blockSize,
            stepSize: stepSize
        });
        collectStream.subscribe(
            () => {},
            (err: Error) => {
                err.message.should.eql("Invalid output identifier.");
                done();
            },
            () => {}
        );
    });

    it("Contains progress info when audio length known up front", done => {
        const samples = [
            Float32Array.from([
                -1, -1, -1, -1,
                0,  0,  0,  0,
                1,  1,  1,  1,
                1 /* Force an extra block*/
            ])
        ];
        const streamFormat: AudioStreamFormat = {
            channelCount: samples.length,
            sampleRate: 4,
            length: samples[0].length
        };
        const collectStream: Observable<StreamingResponse> = service.collect({
            audioData: samples,
            audioFormat: streamFormat,
            key: "stub:sum",
            outputId: "passthrough",
            blockSize: blockSize,
            stepSize: stepSize
        });
        let nBlocksProcessed = 0;
        const nBlocksToProcess = Math.ceil(samples[0].length / stepSize) + 1;
        collectStream.subscribe(
            response => {
                try {
                    response.processedBlockCount.should.eql(++nBlocksProcessed);
                    response.totalBlockCount.should.eql(nBlocksToProcess);
                } catch (e) {
                    done(e);
                }
            },
            done,
            () => {
                try {
                    nBlocksProcessed.should.eql(nBlocksToProcess);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });

    it("Forwards list requests", () => {
       return service.list({}).then(res => {
           res.available.length.should.eql(extractorsToCreate.length);
           for (let i = 0; i < res.available.length; ++i) {
               res.available[0].should.eql(extractorsToCreate[0].metadata);
           }
       })
    });
});
