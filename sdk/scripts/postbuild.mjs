/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Finishes the dual ESM/CJS build.
 *
 * TypeScript does not emit input declaration files, so the single public
 * `src/types.d.ts` is copied into both output trees. The CJS tree also needs a
 * nested package manifest because the package root is `"type": "module"`.
 */

import { copyFileSync, writeFileSync } from 'node:fs'

for (const directory of ['dist/esm', 'dist/cjs']) {
    copyFileSync('src/types.d.ts', `${directory}/types.d.ts`)
}

writeFileSync('dist/cjs/package.json', `${JSON.stringify({type: 'commonjs'}, null, 2)}\n`)
