// prettier-ignore
import type { EventEmitter } from 'events'

declare class Base extends EventEmitter {}

interface KafkaBase {
    msgtype: string;
    code: string;
}

interface KafkaRequest extends KafkaBase {
    msgtype: 'write-response';
    resource_id: string;
    path_leftover: string;
    _orev: number;
}

type ConstructorOpts = {
    consumeTopic: string;
    produceTopic?: string;
    group: string;
    /**
     * @todo Document these opts
     */
    opts?: { [key: string]: any };
};

/**
 * @deprecated fdsadasda
 */
type OldConstructorOpts = [
    consumeTopic: ConstructorOpts['consumeTopic'],
    produceTopic: ConstructorOpts['produceTopic'] | null,
    group: ConstructorOpts['group']
];

export class Responder extends Base {
    constructor(opts: ConstructorOpts);
    /**
     * @deprecated Giving multiple arguments to constructor is deprecated
     * @see ConstructorOpts
     */
    constructor(...opts: OldConstructorOpts);
    on(event: 'request', cb: (reg: KafkaRequest | WriteResponse) => any): this;
    disconnect(): Promise<void>;
}

export class ReResponder extends Base {
    constructor(opts: ConstructorOpts);
    /**
     * @deprecated Giving multiple arguments to constructor is deprecated
     * @see ConstructorOpts
     */
    constructor(...opts: OldConstructorOpts);
    on(event: 'request', cb: (reg: KafkaRequest | WriteResponse) => any): this;
    disconnect(): Promise<void>;
}

export class Requester extends Base {
    constructor(opts: ConstructorOpts);
    /**
     * @deprecated Giving multiple arguments to constructor is deprecated
     * @see ConstructorOpts
     */
    constructor(...opts: OldConstructorOpts);
    send(req: KafkaRequest, topic?: string): Promise<KafkaRequest>;
    disconnect(): Promise<void>;
}
