/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import assert from 'node:assert/strict'
import {access} from 'node:fs/promises'
import {createRequire} from 'node:module'
import test from 'node:test'

test('ESM entry point exposes the public API', async () => {
    const module = await import('../dist/esm/index.js')
    assert.equal(typeof module.DocMorphClient, 'function')
    assert.equal(typeof module.DocMorphError, 'function')
})

test('CommonJS entry points expose the public API', () => {
    const require = createRequire(import.meta.url)

    const module = require('../dist/cjs/index.js')
    assert.equal(typeof module.DocMorphClient, 'function')
    assert.equal(typeof module.DocMorphError, 'function')

    const nodeModule = require('../dist/cjs/node.js')
    assert.equal(typeof nodeModule.convertFile, 'function')
})

test('the single types.d.ts is copied into both builds', async () => {
    await access(new URL('../dist/esm/types.d.ts', import.meta.url))
    await access(new URL('../dist/cjs/types.d.ts', import.meta.url))
})
