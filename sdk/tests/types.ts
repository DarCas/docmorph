/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import {DocMorphClient, DocMorphError} from '../src/index.js'
import {convertFile} from '../src/node.js'
import type {
    ConversionResult,
    DocMorphErrorCode,
    HealthResponse,
    RequestOptions,
} from '../src/index.js'

const client = new DocMorphClient({baseUrl: 'http://localhost:8080'})
const health: Promise<HealthResponse> = client.health({timeoutMs: 1000})
const converted: Promise<ConversionResult> = client.convert(new Uint8Array([0x50]), {
    filename: 'report.docx',
})
const requestOptions: RequestOptions = {headers: {'x-trace-id': 'test'}}
const fileResult: Promise<ConversionResult> = convertFile(client, '/tmp/report.docx')
const code: DocMorphErrorCode = 'RATE_LIMITED'

const {health: detachedHealth, convert: detachedConvert} = client
const detachedHealthResult: Promise<HealthResponse> = detachedHealth({timeoutMs: 1000})
const detachedConvertResult: Promise<ConversionResult> = detachedConvert(
    new Uint8Array([0x50]),
    {filename: 'report.docx'},
)

void DocMorphError
void health
void converted
void requestOptions
void fileResult
void code
void detachedHealthResult
void detachedConvertResult
