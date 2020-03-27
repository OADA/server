declare module 'oada-error' {
    export class OADAError {
        constructor (
            message: string,
            code: number,
            userMessage?: string | null,
            href?: string | null,
            detail?: string | null
        )
    }
}
