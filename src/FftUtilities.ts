/**
 * Created by lucast on 21/10/2016.
 */
function multiplyMutating(a: Float32Array, b: Float32Array): Float32Array {
    a.forEach((x, i, arr) => arr[i] = b[i] * x);
    return a; // return a for convenience when chaining or combining
}

function hann(n: number): Float32Array {
    const range: number[] = [...Array(n).keys()];
    return new Float32Array(range.map(i => 0.5 - 0.5 * Math.cos((2.0 * Math.PI * i) / n)));
}

export function applyHannWindowTo(buffer: Float32Array): Float32Array {
    return multiplyMutating(buffer, hann(buffer.length));
}

export function cyclicShiftInPlace(buffer: Float32Array): Float32Array {
    const midIndex: number = Math.floor(0.5 + 0.5 * buffer.length);
    const secondHalf: Float32Array = buffer.slice(midIndex);
    buffer.copyWithin(buffer.length % 2 === 0 ? midIndex : midIndex - 1, 0);
    buffer.set(secondHalf);
    return buffer; // return for convenience when chaining or combining
}

