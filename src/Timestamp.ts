/**
 * Created by lucas on 26/08/2016.
 */
export interface Timestamp {
    s: number,
    n: number
}

//!!! or a class
//!!! + test (after RealTime tests elsewhere)
export function makeTimestamp(seconds : number) : Timestamp {
    if (seconds >= 0.0) {
	return {
	    s : Math.floor(seconds),
	    n : Math.floor((seconds - Math.floor(seconds)) * 1e9 + 0.5)
	};
    } else {
	const { s, n } = makeTimestamp(-seconds);
	return { s : -s, n : -n };
    }
}

export function frame2timestamp(frame : number, rate : number) : Timestamp {
    return makeTimestamp(frame / rate);
}
