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

export const ZERO_TIME : Timestamp = { s: 0, n: 0 };

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
        const { s, n } = fromSeconds(-seconds);
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
    return (t < 0)
        ? -Math.floor((-t) * frameRate + 0.5)
        : Math.floor(t * frameRate + 0.5);
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

    let s = Math.round(noncanon.s);
    let n = Math.round(noncanon.n);

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

function secText(hms: boolean, sec: number) {
    // sec should be a positive integer when called
    if (sec < 0 || sec !== Math.round(sec)) {
        throw "secText should be called with +ve integer values only"
    }
    if (!hms) {
        return "" + sec;
    }
    let out: string = "";
    if (sec >= 3600) {
        out += Math.floor(sec / 3600) + ":";
    }
    if (sec >= 60) {
        const minutes = Math.floor((sec % 3600) / 60);
        if (sec >= 3600 && minutes < 10) out += "0";
        out += minutes + ":";
    }
    if (sec >= 10) {
        out += Math.floor((sec % 60) / 10);
    }
    out += (sec % 10);
    return out;
}

function msecText(fixedDp: boolean, ms: number) {
    // ms should be a positive integer when called
    if (ms < 0 || ms !== Math.round(ms)) {
        throw "msecText should be called with +ve integer values only"
    }
    let out: string = "";
    if (ms !== 0) {
        out += ".";
        out += Math.floor(ms / 100);
        ms = ms % 100;
        if (ms !== 0) {
            out += Math.floor(ms / 10);
            ms = ms % 10;
        } else if (fixedDp) {
            out += "0";
        }
        if (ms !== 0) {
            out += ms;
        } else if (fixedDp) {
            out += "0";
        }
    } else if (fixedDp) {
        out += ".000";
    }
    return out;
}

/**
 * Return a user-readable string representation of a Timestamp to the
 * nearest millisecond. This is intended for time displays; don't use
 * it for data interchange (use e.g. JSON of the timestamp object
 * instead).
 *
 * Results will be in the form HH:MM:SS.mmm, though any leading zero
 * fields will be omitted.
 *
 * Note that the representation always rounds milliseconds down
 * towards zero. This is generally what is expected for time displays.
 *
 * If fixedDp is true, the result will be padded to 3 dp,
 * i.e. millisecond resolution, even if the number of milliseconds is
 * a multiple of 10.
 */
export function toTextHMSm(t: Timestamp, fixedDp: boolean): string {
    const ts = canonicalise(t);
    if (ts.s < 0 || ts.n < 0) {
        return "-" + toTextHMSm({ s: -ts.s, n: -ts.n }, fixedDp);
    }
    return secText(true, ts.s) + msecText(fixedDp, Math.floor(ts.n / 1000000));
}

/**
 * Return a user-readable string representation of a Timestamp to the
 * nearest second. This is intended for time displays; don't use it
 * for data interchange (use e.g. JSON of the timestamp object
 * instead).
 *
 * Results will be in the form HH:MM:SS, though any leading zero
 * fields will be omitted.
 *
 * Note that the representation always rounds seconds down towards
 * zero. This is generally what is expected for time displays.
 */
export function toTextHMS(t: Timestamp): string {
    const ts = canonicalise(t);
    if (ts.s < 0 || ts.n < 0) {
        return "-" + toTextHMS({ s: -ts.s, n: -ts.n });
    }
    return secText(true, ts.s);
}

/**
 * Return a user-readable string representation of a Timestamp to the
 * nearest millisecond. This is intended for time displays; don't use
 * it for data interchange (use e.g. JSON of the timestamp object
 * instead).
 *
 * Results will be in the form SSSSSS.mmm, i.e. consisting of seconds
 * and milliseconds fields only.
 *
 * Note that the representation always rounds milliseconds down
 * towards zero. This is generally what is expected for time displays.
 * 
 * If fixedDp is true, the result will be padded to 3 dp,
 * i.e. millisecond resolution, even if the number of milliseconds is
 * a multiple of 10.
 */
export function toTextMsec(t: Timestamp, fixedDp: boolean): string {
    const ts = canonicalise(t);
    if (ts.s < 0 || ts.n < 0) {
        return "-" + toTextMsec({ s: -ts.s, n: -ts.n }, fixedDp);
    }
    return secText(false, ts.s) + msecText(fixedDp, Math.floor(ts.n / 1000000));
}
