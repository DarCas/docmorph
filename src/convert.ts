/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SUPPORTED_EXTENSION = 'docx'

const DOCX_ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04])

export type ConvertOptions = {
    timeoutMs: number
}

export class ConversionError extends Error {
    readonly code: string

    readonly stderr?: string

    constructor(message: string, code: string, stderr?: string) {
        super(message)
        this.name = 'ConversionError'
        this.code = code
        this.stderr = stderr
    }
}

export function isSupportedDocument(filename: string): boolean {
    return filename.toLowerCase()
        .endsWith(`.${SUPPORTED_EXTENSION}`)
}

export function stripExtension(filename: string): string {
    return filename.replace(/\.[^.]+$/, '')
}

export function sanitizeBaseName(baseName: string, fallback: string): string {
    const sanitized = baseName.replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^[.-]+|[.-]+$/g, '')

    return sanitized || fallback
}

export function hasDocxSignature(buffer: Buffer): boolean {
    return buffer.length >= DOCX_ZIP_SIGNATURE.length &&
        buffer.subarray(0, DOCX_ZIP_SIGNATURE.length)
            .equals(DOCX_ZIP_SIGNATURE)
}

function assertPdf(buffer: Buffer): void {
    if (buffer.length < 4 || buffer.subarray(0, 4)
        .toString('latin1') !== '%PDF') {
        throw new ConversionError('LibreOffice produced an invalid PDF', 'CONVERSION_FAILED')
    }
}

export async function convertDocxToPdf(
    buffer: Buffer,
    originalname: string,
    options: Required<Pick<ConvertOptions, 'timeoutMs'>>,
): Promise<Buffer> {
    if (!isSupportedDocument(originalname)) {
        throw new ConversionError(
            `Unsupported file extension. Only .${SUPPORTED_EXTENSION} is allowed`,
            'UNSUPPORTED_TYPE',
        )
    }

    if (!hasDocxSignature(buffer)) {
        throw new ConversionError(
            'File does not look like a valid .docx (missing OOXML/ZIP signature)',
            'INVALID_CONTENT',
        )
    }

    const baseName = sanitizeBaseName(stripExtension(originalname), 'document')

    const jobId = randomUUID()
    const jobDir = join(tmpdir(), `lo-${jobId}`)
    const profileDir = join(jobDir, 'profile')
    const sourcePath = join(jobDir, `${baseName}.${SUPPORTED_EXTENSION}`)
    const outputPath = join(jobDir, `${baseName}.pdf`)

    try {
        await mkdir(jobDir, {recursive: true})

        await writeFile(sourcePath, buffer)

        try {
            await execFileAsync('soffice', [
                '--headless',
                '--convert-to',
                'pdf',
                '--outdir',
                jobDir,
                '-env:UserInstallation=file://' + profileDir,
                sourcePath,
            ], {
                timeout: options.timeoutMs,
            })
        } catch (e) {
            const stderr = ( e as { stderr?: string } ).stderr

            throw new ConversionError('LibreOffice conversion failed', 'CONVERSION_FAILED', stderr)
        }

        let pdf: Buffer

        try {
            pdf = await readFile(outputPath)
        } catch {
            throw new ConversionError('LibreOffice did not produce any output file', 'CONVERSION_FAILED')
        }

        assertPdf(pdf)

        return pdf
    } finally {
        rm(jobDir, {
            recursive: true,
            force: true,
        })
            .catch(() => {
            })
    }
}
