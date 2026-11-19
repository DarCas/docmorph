/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import {readFile} from 'node:fs/promises'
import {basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import type {DocMorphClient} from './client.js'
import type {ConvertOptions, ConversionResult} from './types.js'

/**
 * Reads a `.docx` file from disk and converts it to PDF.
 *
 * This helper exists only in the `@darcas/docmorph-sdk/node` entry point so the
 * main entry point stays free of Node built-ins.
 *
 * @param client Configured client instance.
 * @param path Filesystem path or `file:` URL.
 * @param options Conversion options. `filename` defaults to the file's basename.
 * @returns PDF bytes plus the filename advertised by the service.
 * @throws {DocMorphError} On invalid input, HTTP, network or payload failures.
 * @throws {Error} When the file cannot be read.
 */
export async function convertFile(
    client: DocMorphClient,
    path: string | URL,
    options: ConvertOptions = {},
): Promise<ConversionResult> {
    const resolved = typeof path === 'string' ? path : fileURLToPath(path)
    const bytes = await readFile(resolved)

    return client.convert(bytes, {
        ...options,
        filename: options.filename ?? basename(resolved),
    })
}
