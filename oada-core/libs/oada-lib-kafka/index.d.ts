// prettier-ignore
import type { EventEmitter } from 'events'

declare class Base extends EventEmitter {
}

interface KafkaRequest {
    msgtype: string
    code: string
}

type ConstructorOpts = {
    consumeTopic: string
    produceTopic?: string
    group: string
    /**
     * @todo Document these opts
     */
    opts?: { [ key:string ]: any }
}
export class Responder extends Base {
    constructor (opts: ConstructorOpts)
    on (event: 'request', cb: (reg: KafkaRequest) => any): this;
}
