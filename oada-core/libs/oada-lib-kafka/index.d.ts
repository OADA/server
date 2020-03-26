// prettier-ignore
import type { EventEmitter } from 'events'

declare class Base extends EventEmitter {
}

interface KafkaReguest {
    msgtype: string
    code: string
}

export class Responder extends Base {
    constructor (
        consumeTopic: string,
        produceTopic: string | null,
        group: string
    )
    on(event: 'request', cb: (reg: KafkaReguest) => any): this;
}
