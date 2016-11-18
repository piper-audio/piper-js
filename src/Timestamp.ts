/* -*- indent-tabs-mode: nil -*-  vi:set ts=8 sts=4 sw=4: */

/**
 * Encoding of a time in seconds and nanoseconds as two integral
 * values. These are not generally used for time arithmetic or
 * display, just passed as part of process and feature structures.
 */
export interface Timestamp {

    /// Seconds component; must be an integer
    s: number;

    /// Nanoseconds component; must be an integer in the range [0, 1000000000)
    n: number;
}

export const ZERO_TIME : Timestamp = { s: 0, n: 0 }

/**
 * Convert from time in seconds to timestamp value.
 */
export function fromSeconds(seconds: number): Timestamp {
    if (seconds >= 0.0) {
        return canonicalise({
            s: Math.floor(seconds),
            n: Math.floor((seconds - Math.floor(seconds)) * 1e9 + 0.5)
        });
    } else {
        var { s, n } = fromSeconds(-seconds);
        return canonicalise({ s: -s, n: -n });
    }
}

/**
 * Convert from timestamp value to time in seconds.
 */
export function toSeconds(timestamp: Timestamp): number {
    return timestamp.s + (timestamp.n) / 1000000000.0;
}

/**
 * Convert from frame number to timestamp, at a given frame
 * rate. Typically used for audio sample frame count, providing the
 * audio sample rate.
 */
export function fromFrames(frame: number, frameRate: number): Timestamp {
    return fromSeconds(frame / frameRate);
}

/**
 * Convert from timestamp to (the nearest integer) frame number at a
 * given frame rate. Typically used for audio sample frame count,
 * providing the audio sample rate.
 */
export function toFrames(timestamp: Timestamp, frameRate: number): number {
    const t = toSeconds(timestamp);
    let f;
    if (t < 0) f = -Math.floor((-t) * frameRate + 0.5)
    else f = Math.floor(t * frameRate + 0.5);
    return f;
}

/**
 * Timestamps have a canonical representation:
 * 
 *  -> the s (seconds) and n (nanoseconds) values must both be integral.
 *  -> s and n must have the same sign, except when s is zero.
 *  -> n must have magnitude in the range [0,1e9).
 *  -> zero values for both s and n must be represented as +0 and not -0.
 *
 * This function takes an object with arbitrary numerical s and n
 * fields and converts it to a canonical timestamp.
 */
export function canonicalise(noncanon: Timestamp): Timestamp {

    var s = Math.round(noncanon.s)
    var n = Math.round(noncanon.n)

    if (s !== noncanon.s) {
        // Non-integral number of seconds: convert that, then add
        const ts = fromSeconds(noncanon.s);
        return canonicalise({ s: ts.s, n: ts.n + noncanon.n });
    }
    
    const b = 1000000000;
    
    // Have integral values, now ensure n is within range and has same
    // sign as s (unless s is zero)
    
    if (s === 0) {
        while (n <= -b) { n += b; --s; }
        while (n >=  b) { n -= b; ++s; }
    } else if (s < 0) {
        while (n <= -b) { n += b; --s; }
        while (n > 0 && s < 0) { n -= b; ++s; }
    } else {
        while (n >=  b) { n -= b; ++s; }
        while (n < 0 && s > 0) { n += b; --s; }
    }

    if (s === -0) s = 0;
    if (n === -0) n = 0;

    return { s: s, n: n };
}
