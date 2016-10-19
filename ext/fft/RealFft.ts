/**
 * Created by lucast on 18/10/16.
 */
import KissFFT = require("./KissFft");
import {EmscriptenModule} from "../../src/Emscripten";

export interface RealFft {
    forward(real: Float32Array): Float32Array;
    inverse(complex: Float32Array): Float32Array;
    // it is quite likely implementations will be backed by native code
    // therefore manual resource freeing / de-allocation will be required
    dispose(): void;
}

export class KissRealFft implements RealFft {
    private size: number;
    private forwardConfig: any;
    private inverseConfig: any;
    private realPtr: number;
    private complexPtr: number;
    private realIn: Float32Array;
    private complexIn: Float32Array;
    private kissFFTModule: EmscriptenModule;

    // c wrappers
    private kiss_fftr_alloc: any;
    private kiss_fftr: any;
    private kiss_fftri: any;
    private kiss_fftr_free: any;

    constructor(size: number) {
        this.kissFFTModule = KissFFT();
        this.kiss_fftr_alloc = this.kissFFTModule.cwrap(
            'kiss_fftr_alloc', 'number', ['number', 'number', 'number', 'number' ]
        );
        this.kiss_fftr = this.kissFFTModule.cwrap(
            'kiss_fftr', 'void', ['number', 'number', 'number' ]
        );
        this.kiss_fftri = this.kissFFTModule.cwrap(
            'kiss_fftri', 'void', ['number', 'number', 'number' ]
        );
        this.kiss_fftr_free = this.kissFFTModule.cwrap(
            'kiss_fftr_free', 'void', ['number']
        );

        this.size = size;
        this.forwardConfig = this.kiss_fftr_alloc(size, false);
        this.inverseConfig = this.kiss_fftr_alloc(size, true);

        this.realPtr = this.kissFFTModule._malloc(size * 4 + (size + 2) * 4);
        this.complexPtr = this.realPtr + size * 4;

        this.realIn = new Float32Array(
            this.kissFFTModule.HEAPU8.buffer, this.realPtr, size);

        this.complexIn = new Float32Array(this.kissFFTModule.HEAPU8.buffer,
            this.complexPtr, size + 2);
    }

    forward(real: Float32Array): Float32Array {
        this.realIn.set(real);
        this.kiss_fftr(this.forwardConfig, this.realPtr, this.complexPtr);
        return new Float32Array(this.kissFFTModule.HEAPU8.buffer,
            this.complexPtr, this.size + 2);
    }

    inverse(complex: Float32Array): Float32Array {
        this.complexIn.set(complex);
        this.kiss_fftri(this.inverseConfig, this.complexPtr, this.realPtr);
        return new Float32Array(this.kissFFTModule.HEAPU8.buffer,
            this.realPtr, this.size);
    }

    dispose(): void {
        this.kissFFTModule._free(this.realPtr);
        this.kissFFTModule._free(this.complexPtr);
        this.kiss_fftr_free(this.forwardConfig);
        this.kiss_fftr_free(this.inverseConfig);
    }
}