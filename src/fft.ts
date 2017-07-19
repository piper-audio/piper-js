/**
 * Created by lucast on 21/10/2016.
 */
import {EmscriptenModule} from './emscripten';
import {KissFft} from './fft/KissFftModule';

function multiplyMutating(a: Float32Array, b: Float32Array): Float32Array {
    a.forEach((x, i, arr) => arr[i] = b[i] * x);
    return a; // return a for convenience when chaining or combining
}

export function hann(n: number): Float32Array {
    const range: number[] = [...Array(n).keys()];
    return new Float32Array(range.map(i => 0.5 - 0.5 * Math.cos((2.0 * Math.PI * i) / n)));
}

export function memoise(fn: Function): Function {
    // basically https://gist.github.com/cameronbourke/49e798be4f2add8f27cf/revisions
    let cache: {[key: string]: any} = {};
    return (...args: any[]) => {
        const key: string = JSON.stringify(args);
        return cache[key] || (cache[key] = fn(...args));
    }
}

const cachedHann: Function = memoise(hann);

export function applyHannWindowTo(buffer: Float32Array): Float32Array {
    return multiplyMutating(buffer, cachedHann(buffer.length));
}

export function cyclicShiftInPlace(buffer: Float32Array): Float32Array {
    const midIndex: number = Math.floor(0.5 + 0.5 * buffer.length);
    const secondHalf: Float32Array = buffer.slice(midIndex);
    buffer.copyWithin(buffer.length % 2 === 0 ? midIndex : midIndex - 1, 0);
    buffer.set(secondHalf);
    return buffer; // return for convenience when chaining or combining
}

export interface RealFft {
    forward(real: Float32Array): Float32Array;

    inverse(complex: Float32Array): Float32Array;

    // it is quite likely implementations will be backed by native code
    // therefore manual resource freeing / de-allocation will be required
    dispose(): void;
}

export type RealFftFactory = (size: number, args?: { [key: string]: any }) => RealFft;

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
        this.kissFFTModule = KissFft();
        this.kiss_fftr_alloc = this.kissFFTModule.cwrap(
            'kiss_fftr_alloc', 'number', ['number', 'number', 'number', 'number']
        );
        this.kiss_fftr = this.kissFFTModule.cwrap(
            'kiss_fftr', 'void', ['number', 'number', 'number']
        );
        this.kiss_fftri = this.kissFFTModule.cwrap(
            'kiss_fftri', 'void', ['number', 'number', 'number']
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
        return Float32Array.from(new Float32Array(this.kissFFTModule.HEAPU8.buffer,
            this.complexPtr, this.size + 2));
    }

    inverse(complex: Float32Array): Float32Array {
        this.complexIn.set(complex);
        this.kiss_fftri(this.inverseConfig, this.complexPtr, this.realPtr);
        // TODO scaling?
        return Float32Array.from(new Float32Array(this.kissFFTModule.HEAPU8.buffer,
            this.realPtr, this.size));
    }

    dispose(): void {
        this.kissFFTModule._free(this.realPtr);
        this.kiss_fftr_free(this.forwardConfig);
        this.kiss_fftr_free(this.inverseConfig);
    }
}

