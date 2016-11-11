/**
 * Created by lucas on 10/11/2016.
 */
import Process = NodeJS.Process;

/*
- Emscripten modules add uncaughtException listeners to the process global, which don't get cleaned up
* This class may be unnecessary / overkill,
* as to avoid the warning: "Possible EventEmitter memory leak detected. 11 uncaughtException listeners added."
* one could either increase the max listeners limit or just remove all uncaughtException listeners - but there is no certainty they are all from Emscripten
* so here I am assuming there could be other listeners, and just removing the ones Emscripten creates
* (well, assuming they are the only ones added in the time interval)
*/
export class EmscriptenListenerCleaner {
    private listenersAtStart: any[];
    private nodeProcess: Process;

    constructor(nodeProcess: Process) {
        this.nodeProcess = nodeProcess;
        this.listenersAtStart = Array.from(this.getCurrentListeners());
    }

    clean() {
        this.getCurrentListeners().forEach(listener => {
            if (!this.listenersAtStart.includes(listener))
                this.nodeProcess.removeListener("uncaughtException", listener)
        });
    }

    private getCurrentListeners() {
        return this.nodeProcess.listeners("uncaughtException");
    }
}

export function createEmscriptenCleanerWithNodeGlobal() {
    return new EmscriptenListenerCleaner(process);
}