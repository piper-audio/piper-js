interface WorkerConstructor {
    new(filenameOrFunction: string | WorkerFunction): Worker;
}

interface WorkerFunction extends Function {
    // TODO 'this' should really be DedicatedWorkerGlobalScope
    // but it just so happens Worker is mostly symmetrical with it
    // (DedicatedWorkerGlobalScope is defined in lib.webworker and
    // TypeScript doesn't seem to like having both lib.dom
    // and lib.webworker definitions in the tsconfig.libs array)
    (this: Worker): any;
}

declare module "tiny-worker" {
    const TinyWorker: WorkerConstructor;
    export = TinyWorker;
}

