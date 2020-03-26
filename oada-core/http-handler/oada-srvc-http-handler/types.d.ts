declare module 'oada-error' {
    export class OADAError {
        constructor (
            message: string,
            code: number,
            userMessage?: string,
            href?: string,
            detail?: string
        )
    }
}
