/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import {createServer} from 'node:http'

export const PDF_BYTES = Buffer.from('%PDF-1.7\n% DocMorph SDK fixture\n%%EOF\n')

/**
 * Starts an ephemeral HTTP server that records every request.
 *
 * @param handler Receives the request, the response and the raw request body.
 * @returns URL plus recorded requests and a close function.
 */
export async function startServer(handler) {
    const requests = []
    const server = createServer((request, response) => {
        const chunks = []
        request.on('data', (chunk) => chunks.push(chunk))
        request.on('end', () => {
            const body = Buffer.concat(chunks)
            requests.push({
                body,
                headers: request.headers,
                method: request.method,
                url: request.url,
            })

            Promise.resolve(handler(request, response, body)).catch((error) => {
                if (response.destroyed || response.headersSent) {
                    return
                }
                response.writeHead(500, {'content-type': 'text/plain'})
                response.end(String(error))
            })
        })
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') {
        throw new Error('unexpected server address')
    }

    return {
        url: `http://127.0.0.1:${address.port}`,
        requests,
        close: async () => {
            server.closeAllConnections()
            await new Promise((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()))
            })
        },
    }
}

/**
 * Sends a JSON response.
 *
 * @param response Node response.
 * @param status HTTP status.
 * @param payload JSON-serialisable body.
 * @param headers Extra headers.
 */
export function jsonResponse(response, status, payload, headers = {}) {
    response.writeHead(status, {'content-type': 'application/json', ...headers})
    response.end(JSON.stringify(payload))
}

/**
 * Sends a PDF response.
 *
 * @param response Node response.
 * @param options Body, content type and content-disposition overrides.
 */
export function pdfResponse(response, options = {}) {
    const {
        bytes = PDF_BYTES,
        contentType = 'application/pdf',
        contentDisposition = 'inline; filename="result.pdf"',
        headers = {},
    } = options

    const responseHeaders = {'content-type': contentType, ...headers}
    if (contentDisposition !== null) {
        responseHeaders['content-disposition'] = contentDisposition
    }

    response.writeHead(200, responseHeaders)
    response.end(bytes)
}

/**
 * Delays a PDF response. Used by timeout and abort tests.
 *
 * @param response Node response.
 * @param delayMs Delay before writing.
 */
export function delayedPdfResponse(response, delayMs) {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (!response.destroyed) {
                pdfResponse(response)
            }
            resolve()
        }, delayMs)
    })
}
