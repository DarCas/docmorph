/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const PAD = 5

function ts(): string {
    return new Date().toISOString()
}

function format(level: Level, msg: string, fields: Record<string, unknown>): string {
    const kv = Object.entries(fields)
        .map(([key, value]) => `${key}=${formatValue(value)}`)
        .join(' ')

    const line = `[${ts()}] ${level.padEnd(PAD, ' ')} ${msg}`

    return kv ? `${line} ${kv}` : line
}

function formatValue(value: unknown): string {
    if (typeof value === 'string') {
        return `"${value.replace(/"/g, '\\"')}"`
    }

    if (value instanceof Error) {
        return `"${value.message.replace(/"/g, '\\"')}"`
    }

    return String(value)
}

export class Logger {
    readonly requestId: string

    constructor(requestId: string) {
        this.requestId = requestId
    }

    debug(msg: string, fields: Record<string, unknown> = {}): void {
        console.log(format('DEBUG', msg, {requestId: this.requestId, ...fields}))
    }

    info(msg: string, fields: Record<string, unknown> = {}): void {
        console.log(format('INFO', msg, {requestId: this.requestId, ...fields}))
    }

    warn(msg: string, fields: Record<string, unknown> = {}): void {
        console.warn(format('WARN', msg, {requestId: this.requestId, ...fields}))
    }

    error(msg: string, fields: Record<string, unknown> = {}): void {
        console.error(format('ERROR', msg, {requestId: this.requestId, ...fields}))
    }
}
