/**
 * Created by lucast on 31/08/2016.
 */
export interface EmscriptenModule {
    cwrap(ident: string, returnType: string, argTypes: string[]): Function;
    intArrayFromString(stringy: string): number[];
    _free(ptr: number): void;
    allocate(slab: number[], type: string, allocator: Allocator): number;
    Pointer_stringify(ptr: number): string;
}

export enum Allocator {
    ALLOC_NORMAL,
    ALLOC_STACK,
    ALLOC_STATIC,
    ALLOC_DYNAMIC,
    ALLOC_NONE
}
