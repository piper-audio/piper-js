/**
 * Created by lucast on 06/10/2016.
 */
import {Transport, TransportData} from "./Piper";

export class InMemoryTransport implements Transport {
    private buffer: string;

    constructor() {
        this.buffer = "";
    }

    read(): TransportData {
        return this.buffer;
    }

    write(buffer: TransportData): void {
        this.buffer = buffer;
    }

    flush(): void {
    }

}