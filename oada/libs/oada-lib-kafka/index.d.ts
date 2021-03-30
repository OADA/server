// prettier-ignore
import type { EventEmitter } from 'events'

declare class Base extends EventEmitter {}

interface KafkaBase {
    msgtype: string;
    code: string;
}

interface WriteResponse extends KafkaBase {
    msgtype: 'write-response';
    resource_id: string;
    path_leftover: string;
    _orev: number;
}

type KafkaRequest = WriteResponse;

type ConstructorOpts = {
    consumeTopic: string;
    produceTopic?: string;
    group: string;
    /**
     * @todo Document these opts
     */
    opts?: { [key: string]: any };
};

export class Responder extends Base {
    constructor(opts: ConstructorOpts);
    on(event: 'request', cb: (reg: KafkaRequest | WriteResponse) => any): this;
    disconnect(): Promise<void>;
}
