/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import express, { type NextFunction, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { env } from 'node:process'
import { Semaphore } from './concurrency.js'
import {
    convertDocxToPdf,
    ConversionError,
    isSupportedDocument,
    sanitizeBaseName,
} from './convert.js'
import { Logger } from './logger.js'

const PORT = Number(env.PORT ?? 8080)
const MAX_FILE_SIZE = Number(env.MAX_FILE_SIZE ?? 10 * 1024 * 1024)
const CONVERT_TIMEOUT_MS = Number(env.CONVERT_TIMEOUT_MS ?? 60_000)
const MAX_CONCURRENT = Number(env.MAX_CONCURRENT ?? 3)
const RATE_LIMIT_WINDOW_MS = Number(env.RATE_LIMIT_WINDOW_MS ?? 60_000)
const RATE_LIMIT_MAX = Number(env.RATE_LIMIT_MAX ?? 60)
const API_KEYS = new Set(
    ( env.API_KEYS ?? '' )
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0),
)
const AUTH_ENABLED = API_KEYS.size > 0

function hashKey(key: string): Buffer {
    return createHash('sha256')
        .update(key)
        .digest()
}

function getProvidedKey(req: Request): string | undefined {
    const headerKey = req.header('x-api-key')
        ?.trim()

    if (headerKey) {
        return headerKey
    }

    const authorization = req.header('authorization')

    if (authorization) {
        const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())

        if (match) {
            return match[ 1 ].trim()
        }
    }

    return undefined
}

function isAuthorized(provided: string | undefined): boolean {
    if (!provided) {
        return false
    }

    const providedHash = hashKey(provided)

    for (const key of API_KEYS) {
        const expectedHash = hashKey(key)

        if (providedHash.length === expectedHash.length && timingSafeEqual(providedHash, expectedHash)) {
            return true
        }
    }

    return false
}

const pool = new Semaphore(MAX_CONCURRENT)

function isHealthCheck(req: Request): boolean {
    return req.method === 'GET' && req.path === '/health'
}

const limiter = rateLimit({
    handler: (req, res) => {
        ( req.logger as Logger ).warn('Rate limited', {path: req.path})

        res.status(429)
            .json({error: 'Too many requests'})
    },
    legacyHeaders: false,
    limit: RATE_LIMIT_MAX,
    skip: isHealthCheck,
    standardHeaders: 'draft-8',
    windowMs: RATE_LIMIT_WINDOW_MS,
})

const upload = multer({
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
    },
    storage: multer.memoryStorage(),
})

const app = express()

app.disable('x-powered-by')

declare global {
    namespace Express {
        interface Request {
            logger?: Logger
        }
    }
}

app.use((req, _res, next) => {
    req.logger = new Logger(randomUUID())
    next()
})

app.use(limiter)

app.use((req: Request, res: Response, next: NextFunction): void => {
    if (!AUTH_ENABLED || isHealthCheck(req)) {
        return next()
    }

    if (isAuthorized(getProvidedKey(req))) {
        return next()
    }

    ( req.logger as Logger ).warn('Unauthorized', {path: req.path})

    res.status(401)
        .json({error: 'Unauthorized'})
})

app.get('/health', (_req, res) => {
    res.json({
        authEnabled: AUTH_ENABLED,
        concurrency: {
            active: pool.activeCount,
            queued: pool.queuedCount,
            max: pool.maxCount,
        },
        maxFileSize: MAX_FILE_SIZE,
        rateLimit: {
            max: RATE_LIMIT_MAX,
            windowMs: RATE_LIMIT_WINDOW_MS,
        },
        status: 'ok',
        timeoutMs: CONVERT_TIMEOUT_MS,
    })
})

app.post('/convert', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    const started = Date.now()
    const logger = req.logger as Logger

    try {
        const file = req.file

        if (!file) {
            logger.warn('convert aborted', {reason: 'missing_file'})

            return res.status(412)
                .json({error: 'Missing required multipart field `file`'})
        }

        if (!isSupportedDocument(file.originalname)) {
            logger.warn('convert aborted', {
                filename: file.originalname,
                reason: 'unsupported_extension',
            })

            return res.status(412)
                .json({error: `Unsupported file extension "${file.originalname}". Only .docx is allowed`})
        }

        logger.info('convert start', {
            filename: file.originalname,
            sizeBytes: file.size,
        })

        if (pool.queuedCount > 0) {
            logger.debug('convert waiting', {
                queued: pool.queuedCount,
            })
        }

        const release = await pool.acquire()

        logger.debug('convert slot acquired', {
            active: pool.activeCount,
            queued: pool.queuedCount,
        })

        try {
            const pdf = await convertDocxToPdf(file.buffer, file.originalname, {
                timeoutMs: CONVERT_TIMEOUT_MS,
            })

            const baseName = sanitizeBaseName(file.originalname.replace(/\.docx$/i, ''), 'document')

            logger.info('convert done', {
                filename: `${baseName}.pdf`,
                sizeBytes: pdf.length,
                durationMs: Date.now() - started,
            })

            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Disposition', `inline; filename="${baseName}.pdf"`)
            res.send(pdf)
        } finally {
            release()
        }
    } catch (e) {
        next(e)
    }
})

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const logger = req.logger as Logger

    if (err instanceof ConversionError) {
        let status: number

        switch (err.code) {
            case 'UNSUPPORTED_TYPE':
                status = 400
                break
            case 'INVALID_CONTENT':
                status = 415
                break
            default:
                status = 500
        }

        logger.error('convert failed', {
            code: err.code,
            message: err.message,
            status,
            stderr: err.stderr,
        })

        return res.status(status)
            .json({error: err.message})
    }

    if (err instanceof multer.MulterError) {
        logger.error('upload failed', {
            code: err.code,
            message: err.message,
        })

        return res.status(400)
            .json({error: err.message})
    }

    logger.error('internal error', {
        message: err instanceof Error ? err.message : String(err),
    })

    res.status(500)
        .json({error: 'Internal conversion failure'})
})

app.listen(PORT, () => {
    console.log(`docmorph listening on port ${PORT} (auth ${AUTH_ENABLED ? `enabled, ${API_KEYS.size} key(s)` : 'disabled, open'}, rate ${RATE_LIMIT_MAX}/${RATE_LIMIT_WINDOW_MS}ms)`)
})
