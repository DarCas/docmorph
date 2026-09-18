/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Headless LibreOffice wrapper converting `.docx` buffers to PDF.
 *
 * Each conversion runs in an isolated temporary job directory with a
 * dedicated LibreOffice user profile, so concurrent conversions never share
 * state. Inputs are validated by extension and OOXML/ZIP magic bytes before
 * invoking `soffice`, and the produced output is asserted to be a real PDF.
 */

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

/** Promisified `child_process.execFile` used to spawn `soffice`. */
const execFileAsync = promisify(execFile)

/** Sole document extension accepted by the service (lowercase, no dot). */
const SUPPORTED_EXTENSION = 'docx'

/**
 * ZIP local-file-header magic (`PK\x03\x04`) every OOXML `.docx` starts with.
 */
const DOCX_ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/** Tunables for a single conversion. */
export type ConvertOptions = {
    /** Hard timeout in milliseconds for the `soffice` subprocess. */
    timeoutMs: number
}

/**
 * Typed conversion failure carrying a machine-readable code.
 *
 * Codes: `UNSUPPORTED_TYPE` (bad extension), `INVALID_CONTENT` (bad magic
 * bytes), `CONVERSION_FAILED` (LibreOffice error, missing output or invalid
 * PDF). The Express error handler in `index.ts` maps codes to HTTP statuses.
 */
export class ConversionError extends Error {
    /** Machine-readable failure code (see class docs). */
    readonly code: string

    /** Captured stderr of the `soffice` subprocess, when available. */
    readonly stderr?: string

    /**
     * Creates a conversion error.
     *
     * @param message - Human-readable description sent to the API client.
     * @param code - Machine-readable failure code.
     * @param stderr - Optional `soffice` stderr for diagnostics.
     */
    constructor(message: string, code: string, stderr?: string) {
        super(message)
        this.name = 'ConversionError'
        this.code = code
        this.stderr = stderr
    }
}

/**
 * Checks whether a filename carries the supported `.docx` extension.
 *
 * The comparison is case-insensitive; only the trailing extension matters.
 *
 * @param filename - Original client-provided filename.
 * @returns `true` when the name ends with `.docx`.
 */
export function isSupportedDocument(filename: string): boolean {
    return filename.toLowerCase()
        .endsWith(`.${SUPPORTED_EXTENSION}`)
}

/**
 * Strips the last dot-extension from a filename.
 *
 * @param filename - Filename such as `report.final.docx`.
 * @returns The name without its trailing extension (`report.final`).
 */
export function stripExtension(filename: string): string {
    return filename.replace(/\.[^.]+$/, '')
}

/**
 * Sanitizes a filename stem for safe use on disk and in HTTP headers.
 *
 * Every run of characters outside `[A-Za-z0-9._-]` becomes `-`, and leading
 * or trailing dots/dashes are trimmed. Returns `fallback` when nothing
 * usable remains.
 *
 * @param baseName - Raw filename stem without extension.
 * @param fallback - Substitute used when sanitization yields an empty string.
 * @returns The sanitized stem or `fallback`.
 */
export function sanitizeBaseName(baseName: string, fallback: string): string {
    const sanitized = baseName.replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^[.-]+|[.-]+$/g, '')

    return sanitized || fallback
}

/**
 * Checks whether a buffer starts with the OOXML/ZIP magic signature.
 *
 * @param buffer - Raw uploaded file bytes.
 * @returns `true` when the leading bytes match `PK\x03\x04`.
 */
export function hasDocxSignature(buffer: Buffer): boolean {
    return buffer.length >= DOCX_ZIP_SIGNATURE.length &&
        buffer.subarray(0, DOCX_ZIP_SIGNATURE.length)
            .equals(DOCX_ZIP_SIGNATURE)
}

/**
 * Asserts that a buffer is a PDF by checking the `%PDF` magic header.
 *
 * @param buffer - Bytes produced by LibreOffice.
 * @throws {ConversionError} With code `CONVERSION_FAILED` when the header
 * is missing or the buffer is too short.
 */
function assertPdf(buffer: Buffer): void {
    if (buffer.length < 4 || buffer.subarray(0, 4)
        .toString('latin1') !== '%PDF') {
        throw new ConversionError('LibreOffice produced an invalid PDF', 'CONVERSION_FAILED')
    }
}

/**
 * Converts an in-memory `.docx` document to PDF via headless LibreOffice.
 *
 * The input is written to a unique temp directory (`lo-<uuid>`), converted
 * with `soffice --headless --convert-to pdf` under a per-job user profile
 * (`-env:UserInstallation`), read back, PDF-validated and returned. The job
 * directory is always removed afterwards, even on failure.
 *
 * @param buffer - Raw `.docx` file bytes.
 * @param originalname - Original filename, used for validation and naming.
 * @param options - Conversion tunables (currently just the subprocess timeout).
 * @returns The converted PDF bytes.
 * @throws {ConversionError} `UNSUPPORTED_TYPE` for a bad extension,
 * `INVALID_CONTENT` for missing OOXML magic, or `CONVERSION_FAILED` when
 * LibreOffice errors, produces no file, or emits a non-PDF.
 */
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
