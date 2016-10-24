/**
 * Created by lucast on 21/10/2016.
 */
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

