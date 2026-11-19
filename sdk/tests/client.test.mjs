/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import assert from 'node:assert/strict'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {DocMorphClient, DocMorphError} from '../dist/esm/index.js'
import {convertFile} from '../dist/esm/node.js'
import {
    PDF_BYTES,
    delayedPdfResponse,
    jsonResponse,
    pdfResponse,
    startServer,
} from './helpers.mjs'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const DOCX_BYTES = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('fixture')])

function clientFor(server, options = {}) {
    return new DocMorphClient({baseUrl: server.url, ...options})
}

function assertError(code) {
    return (error) => {
        assert.ok(error instanceof DocMorphError)
        assert.equal(error.code, code)
        return true
    }
}

test('convert posts multipart and returns the PDF metadata', async () => {
    const server = await startServer((request, response) => {
        pdfResponse(response, {contentDisposition: 'inline; filename="report.pdf"'})
    })

    try {
        const client = clientFor(server, {apiKey: 'secret'})
        const result = await client.convert(DOCX_BYTES, {filename: 'report.docx'})

        const request = server.requests[0]
        assert.equal(request.method, 'POST')
        assert.equal(request.url, '/convert')
        assert.equal(request.headers['x-api-key'], 'secret')
        assert.equal(request.headers.accept, 'application/pdf')
        assert.match(request.headers['content-type'], /^multipart\/form-data; boundary=/)
        assert.match(
            request.body.toString('latin1'),
            /name="file"[^\r\n]*filename="report\.docx"/,
        )
        assert.match(request.body.toString('latin1'), /fixture/)

        assert.deepEqual(result.bytes, new Uint8Array(PDF_BYTES))
        assert.equal(result.filename, 'report.pdf')
        assert.equal(result.contentType, 'application/pdf')
    } finally {
        await server.close()
    }
})

test('convert falls back to the input filename when Content-Disposition is missing', async () => {
    const server = await startServer((request, response) => {
        pdfResponse(response, {contentDisposition: null})
    })

    try {
        const client = clientFor(server)
        const result = await client.convert(DOCX_BYTES, {filename: 'annual-report.docx'})
        assert.equal(result.filename, 'annual-report.pdf')
    } finally {
        await server.close()
    }
})

test('convert derives the filename from a File input', async (t) => {
    if (typeof File === 'undefined') {
        t.skip('File is not available in this runtime')
        return
    }

    const server = await startServer((request, response) => {
        pdfResponse(response, {contentDisposition: null})
    })

    try {
        const client = clientFor(server)
        const file = new File([DOCX_BYTES], 'from-file.docx', {type: DOCX_MIME})
        const result = await client.convert(file)

        assert.match(
            server.requests[0].body.toString('latin1'),
            /filename="from-file\.docx"/,
        )
        assert.equal(result.filename, 'from-file.pdf')
    } finally {
        await server.close()
    }
})

test('convert keeps the base URL path prefix', async () => {
    const server = await startServer((request, response) => {
        pdfResponse(response)
    })

    try {
        const client = new DocMorphClient({baseUrl: `${server.url}/api`})
        await client.convert(DOCX_BYTES, {filename: 'report.docx'})
        assert.equal(server.requests[0].url, '/api/convert')
    } finally {
        await server.close()
    }
})

test('health parses the typed payload', async () => {
    const payload = {
        status: 'ok',
        authEnabled: true,
        concurrency: {active: 1, queued: 2, max: 3},
        maxFileSize: 10485760,
        rateLimit: {max: 60, windowMs: 60000},
        timeoutMs: 60000,
    }
    const server = await startServer((request, response) => {
        jsonResponse(response, 200, payload)
    })

    try {
        const client = clientFor(server)
        const health = await client.health()

        assert.deepEqual(health, payload)
        assert.equal(server.requests[0].url, '/health')
        assert.equal(server.requests[0].method, 'GET')
        assert.equal(server.requests[0].headers.accept, 'application/json')
    } finally {
        await server.close()
    }
})

test('health rejects invalid JSON and unexpected shapes', async () => {
    const invalidJson = await startServer((request, response) => {
        response.writeHead(200, {'content-type': 'text/plain'})
        response.end('not-json')
    })
    try {
        await assert.rejects(clientFor(invalidJson).health(), assertError('INVALID_RESPONSE'))
    } finally {
        await invalidJson.close()
    }

    const invalidShape = await startServer((request, response) => {
        jsonResponse(response, 200, {status: 'ok'})
    })
    try {
        await assert.rejects(clientFor(invalidShape).health(), assertError('INVALID_RESPONSE'))
    } finally {
        await invalidShape.close()
    }
})

test('authentication supports bearer tokens', async () => {
    const server = await startServer((request, response) => {
        pdfResponse(response)
    })

    try {
        const client = clientFor(server, {apiKey: 'secret', authScheme: 'bearer'})
        await client.convert(DOCX_BYTES, {filename: 'report.docx'})
        assert.equal(server.requests[0].headers.authorization, 'Bearer secret')
        assert.equal(server.requests[0].headers['x-api-key'], undefined)
    } finally {
        await server.close()
    }
})

test('open servers receive no authentication header', async () => {
    const server = await startServer((request, response) => {
        pdfResponse(response)
    })

    try {
        await clientFor(server).convert(DOCX_BYTES, {filename: 'report.docx'})
        assert.equal(server.requests[0].headers.authorization, undefined)
        assert.equal(server.requests[0].headers['x-api-key'], undefined)
    } finally {
        await server.close()
    }
})

test('custom headers merge with per-call headers winning', async () => {
    const server = await startServer((request, response) => {
        pdfResponse(response)
    })

    try {
        const client = clientFor(server, {headers: {'x-client': 'sdk', 'x-trace': 'client'}})
        await client.convert(DOCX_BYTES, {
            filename: 'report.docx',
            headers: {'x-trace': 'call', 'x-call': 'yes'},
        })

        const headers = server.requests[0].headers
        assert.equal(headers['x-client'], 'sdk')
        assert.equal(headers['x-trace'], 'call')
        assert.equal(headers['x-call'], 'yes')
    } finally {
        await server.close()
    }
})

const errorCases = [
    {status: 401, body: {error: 'Unauthorized'}, code: 'UNAUTHORIZED'},
    {status: 412, body: {error: 'Missing file field'}, code: 'INVALID_FILE'},
    {status: 415, body: {error: 'Invalid content'}, code: 'INVALID_CONTENT'},
    {status: 429, body: {error: 'Too many requests'}, code: 'RATE_LIMITED'},
    {status: 500, body: {error: 'Conversion failed'}, code: 'CONVERSION_FAILED'},
    {status: 404, body: {error: 'Not found'}, code: 'NOT_FOUND'},
    {status: 400, body: {error: 'File too large'}, code: 'FILE_TOO_LARGE'},
    {status: 400, body: {error: 'Unexpected field'}, code: 'HTTP_ERROR'},
    {status: 418, body: {error: 'I am a teapot'}, code: 'HTTP_ERROR'},
]

for (const testCase of errorCases) {
    test(`maps HTTP ${testCase.status} "${testCase.body.error}" to ${testCase.code}`, async () => {
        const server = await startServer((request, response) => {
            jsonResponse(response, testCase.status, testCase.body)
        })

        try {
            await assert.rejects(
                clientFor(server).convert(DOCX_BYTES, {filename: 'report.docx'}),
                (error) => {
                    assertError(testCase.code)(error)
                    assert.equal(error.status, testCase.status)
                    assert.deepEqual(error.details, testCase.body)
                    assert.equal(error.message, testCase.body.error)
                    return true
                },
            )
        } finally {
            await server.close()
        }
    })
}

test('429 exposes Retry-After as milliseconds', async () => {
    const server = await startServer((request, response) => {
        jsonResponse(
            response,
            429,
            {error: 'Too many requests'},
            {'retry-after': '2'},
        )
    })

    try {
        await assert.rejects(
            clientFor(server).health(),
            (error) => {
                assert.equal(error.code, 'RATE_LIMITED')
                assert.equal(error.retryAfterMs, 2000)
                return true
            },
        )
    } finally {
        await server.close()
    }
})

test('rejects non-PDF content types and bodies', async () => {
    const wrongType = await startServer((request, response) => {
        pdfResponse(response, {contentType: 'text/html'})
    })
    try {
        await assert.rejects(
            clientFor(wrongType).convert(DOCX_BYTES, {filename: 'report.docx'}),
            assertError('INVALID_RESPONSE'),
        )
    } finally {
        await wrongType.close()
    }

    const wrongMagic = await startServer((request, response) => {
        pdfResponse(response, {bytes: Buffer.from('not a pdf')})
    })
    try {
        await assert.rejects(
            clientFor(wrongMagic).convert(DOCX_BYTES, {filename: 'report.docx'}),
            assertError('INVALID_RESPONSE'),
        )
    } finally {
        await wrongMagic.close()
    }
})

test('sanitizes a path-traversal filename coming from Content-Disposition', async () => {
    const server = await startServer((request, response) => {
        pdfResponse(response, {
            contentDisposition: 'inline; filename="../../evil.pdf"',
        })
    })

    try {
        const result = await clientFor(server).convert(DOCX_BYTES, {filename: 'report.docx'})
        assert.equal(result.filename, 'evil.pdf')
    } finally {
        await server.close()
    }
})

test('validates constructor options', () => {
    const invalidOptions = [
        [{baseUrl: 'ftp://localhost'}],
        [{baseUrl: 'not-a-url'}],
        [{baseUrl: 'http://localhost', apiKey: ''}],
        [{baseUrl: 'http://localhost', authScheme: 'basic'}],
        [{baseUrl: 'http://localhost', timeoutMs: 0}],
        [{baseUrl: 'http://localhost', retries: -1}],
        [{baseUrl: 'http://localhost', retryDelayMs: -1}],
        [{baseUrl: 'http://localhost?token=x'}],
    ]

    for (const [options] of invalidOptions) {
        assert.throws(
            () => new DocMorphClient(options),
            (error) => {
                assert.ok(error instanceof DocMorphError)
                assert.equal(error.code, 'INVALID_ARGUMENT')
                return true
            },
        )
    }
})

test('validates convert input before touching the network', async () => {
    const client = new DocMorphClient({baseUrl: 'http://127.0.0.1:1'})

    await assert.rejects(client.convert(DOCX_BYTES), assertError('INVALID_ARGUMENT'))
    await assert.rejects(
        client.convert(DOCX_BYTES, {filename: 'report.txt'}),
        assertError('INVALID_ARGUMENT'),
    )
    await assert.rejects(
        client.convert(new Uint8Array(), {filename: 'empty.docx'}),
        assertError('INVALID_ARGUMENT'),
    )
    await assert.rejects(
        client.convert(DOCX_BYTES, {filename: 'report.docx', timeoutMs: 0}),
        assertError('INVALID_ARGUMENT'),
    )
})

test('retries 429 and honours Retry-After', async () => {
    let calls = 0
    const server = await startServer((request, response) => {
        calls += 1
        if (calls === 1) {
            jsonResponse(
                response,
                429,
                {error: 'Too many requests'},
                {'retry-after': '0'},
            )
            return
        }
        pdfResponse(response)
    })

    try {
        const client = clientFor(server, {retries: 1, retryDelayMs: 1})
        const result = await client.convert(DOCX_BYTES, {filename: 'report.docx'})

        assert.equal(calls, 2)
        assert.equal(result.filename, 'result.pdf')
    } finally {
        await server.close()
    }
})

test('does not retry conversion failures', async () => {
    let calls = 0
    const server = await startServer((request, response) => {
        calls += 1
        jsonResponse(response, 500, {error: 'Conversion failed'})
    })

    try {
        const client = clientFor(server, {retries: 3, retryDelayMs: 1})
        await assert.rejects(
            client.convert(DOCX_BYTES, {filename: 'report.docx'}),
            assertError('CONVERSION_FAILED'),
        )
        assert.equal(calls, 1)
    } finally {
        await server.close()
    }
})

test('maps a refused connection to NETWORK_ERROR', async () => {
    const probe = await startServer((request, response) => {
        response.end()
    })
    const url = probe.url
    await probe.close()

    await assert.rejects(
        new DocMorphClient({baseUrl: url}).health(),
        assertError('NETWORK_ERROR'),
    )
})

test('times out a slow response', async () => {
    const server = await startServer((request, response) => {
        return delayedPdfResponse(response, 500)
    })

    try {
        const client = clientFor(server, {timeoutMs: 20})
        await assert.rejects(client.health(), assertError('TIMEOUT'))
    } finally {
        await server.close()
    }
})

test('aborts an in-flight request', async () => {
    const server = await startServer((request, response) => {
        return delayedPdfResponse(response, 500)
    })

    try {
        const controller = new AbortController()
        const client = clientFor(server)
        const request = client.health({signal: controller.signal})
        setTimeout(() => controller.abort(), 10)

        await assert.rejects(request, assertError('ABORTED'))
    } finally {
        await server.close()
    }
})

test('convertFile reads a .docx from disk', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'docmorph-sdk-'))
    const filePath = join(directory, 'contract.docx')
    await writeFile(filePath, DOCX_BYTES)

    const server = await startServer((request, response) => {
        pdfResponse(response, {contentDisposition: null})
    })

    try {
        const result = await convertFile(clientFor(server), filePath)
        assert.equal(result.filename, 'contract.pdf')
        assert.match(
            server.requests[0].body.toString('latin1'),
            /filename="contract\.docx"/,
        )
    } finally {
        await server.close()
        await rm(directory, {recursive: true, force: true})
    }
})

test('exposes the public methods as own enumerable properties', () => {
    const client = new DocMorphClient({baseUrl: 'http://127.0.0.1:1'})

    assert.deepEqual(Object.keys(client), ['health', 'convert'])
    assert.equal(typeof client.health, 'function')
    assert.equal(typeof client.convert, 'function')
})

test('supports destructured methods', async () => {
    const server = await startServer((request, response) => {
        if (request.url === '/health') {
            jsonResponse(response, 200, {
                status: 'ok',
                authEnabled: false,
                concurrency: {active: 0, queued: 0, max: 1},
                maxFileSize: 10485760,
                rateLimit: {max: 60, windowMs: 60000},
                timeoutMs: 60000,
            })
            return
        }
        pdfResponse(response, {contentDisposition: null})
    })

    try {
        const {health, convert} = clientFor(server)

        assert.equal((await health()).status, 'ok')

        const result = await convert(DOCX_BYTES, {filename: 'note.docx'})
        assert.equal(result.filename, 'note.pdf')
    } finally {
        await server.close()
    }
})
