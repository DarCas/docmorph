# SDK (`sdk/`)

`@darcas/docmorph-sdk` is the published isomorphic client for the service. It is
a separate npm package inside this repository, **not** an npm workspace: install
and build it from `sdk/`, never from the repository root.

## Commands

All commands run in `sdk/`:

| Command | Purpose |
| --- | --- |
| `npm install` | Install the two dev dependencies (TypeScript, `@types/node`). |
| `npm run typecheck` | `tsc -p tsconfig.json --noEmit`. |
| `npm run build` | Clean, emit ESM, emit CJS, run `scripts/postbuild.mjs`. |
| `npm test` | Runs the build, then `node --test` against `dist/`. |
| `npm pack --dry-run` | Inspect the exact published file list. |
| `npm run clean` | Remove `dist/`. |

There is no lint config and no test framework; `node:test` is used directly.

## Layout

```text
sdk/
  src/
    types.d.ts      every public type alias, union and interface
    errors.ts       DocMorphError (runtime class)
    client.ts       DocMorphClient (fetch, validation, retries, timeouts)
    index.ts        main entry point
    node.ts         convertFile helper, exported as ./node
  scripts/
    postbuild.mjs   copies types.d.ts and writes the CJS package marker
  tests/
    client.test.mjs  HTTP behaviour against a local mock server
    exports.test.mjs ESM/CJS entry points and declaration presence
    types.ts         compile-time public-surface check
```

## Invariants

1. **Zero runtime dependencies.** The core uses only web-standard APIs
   (`fetch`, `FormData`, `Blob`, `AbortController`). Node built-ins are only
   allowed in `src/node.ts`, which is behind the `./node` subpath.
2. **Public types live only in `src/types.d.ts`.** Classes stay in `.ts` so the
   compiler checks them. TypeScript never emits an input declaration file, so
   `scripts/postbuild.mjs` copies `types.d.ts` into both output trees. Never
   hand-edit `dist/`, and never move a public type into `client.ts` without
   updating this split.
3. **Dual build, single source.** `tsconfig.esm.json` emits ESM to
   `dist/esm/`; `tsconfig.cjs.json` emits CommonJS to `dist/cjs/`. The package
   root is `"type": "module"`, so `postbuild.mjs` writes
   `dist/cjs/package.json` with `{"type": "commonjs"}`.
4. **Exports map is the contract.** `.` and `./node` each expose `types` and
   `default` for both `import` and `require`. Keep declaration paths in sync
   with the build output.
5. **Tests run against `dist/`, not `src/`.** `pretest` builds first. The suite
   uses a real `node:http` server on an ephemeral port and never calls
   `soffice`; it covers request shape, auth headers, status-to-code mapping,
   retry policy, timeout, abort, payload validation and `convertFile`. It also
   asserts that the two public methods are own enumerable properties and that
   destructured calls work.
6. **API drift is manual.** There is no code generation from the service. A
   route, status code, error body or health field change must update
   `client.ts`, `types.d.ts`, `tests/client.test.mjs` and `README.md` together.
7. **Declarations keep JSDoc.** Both SDK tsconfigs set `removeComments: false`
   (unlike the service) so IntelliSense shows the public documentation.
8. **No Node types leak into the core.** `index.d.ts` must stay consumable with
   `lib: ["DOM"]` only; `node.ts` is the only Node-specific declaration.
9. **Public methods are instance arrow fields.** `health` and `convert` are
   assigned in the class body so they appear as own enumerable properties and
   keep their instance binding when destructured (`const {convert} = client`).
   Private helpers stay on the prototype. Do not convert the public methods back
   to prototype methods: destructuring would throw on `#private` access.

## Local verification

```bash
cd sdk
npm install
npm run typecheck
npm test
npm pack --dry-run
```

Package smoke test (catches a broken `exports` map):

```bash
cd sdk
npm pack
mkdir -p /tmp/docmorph-sdk-smoke && cd /tmp/docmorph-sdk-smoke
npm init -y
npm install /path/to/darcas-docmorph-sdk-0.1.0.tgz
node -e "const sdk=require('@darcas/docmorph-sdk'); console.log(typeof sdk.DocMorphClient)"
node --input-type=module -e "import {DocMorphClient} from '@darcas/docmorph-sdk'; console.log(typeof DocMorphClient)"
```

Type-check a consumer with `moduleResolution: NodeNext` against the installed
tarball; this is the only check that exercises the `types` conditions.

## End-to-end check (Docker)

Real conversions still require the Docker image. Build it first (the compose
file has no `build:` stanza), then point the SDK at the mapped port:

```bash
docker build -t ghcr.io/darcas/docmorph:latest .
docker compose up -d   # fresh clone: docker compose -f docker-compose.dist.yml up -d

cd sdk && npm run build
node --input-type=module -e "
import {DocMorphClient} from './dist/esm/index.js'
import {convertFile} from './dist/esm/node.js'
import {writeFile} from 'node:fs/promises'
const client = new DocMorphClient({baseUrl: 'http://localhost:3001'})
const result = await convertFile(client, '/path/to/document.docx')
await writeFile('/tmp/sdk-e2e.pdf', result.bytes)
console.log(result.filename, result.bytes.byteLength)
"
```

The output must start with `%PDF`. Never report an SDK conversion as verified
without this Docker step.

## Release

1. Bump `sdk/package.json` by hand (never `npm version`, which would create a
   `v*` tag).
2. Commit and push, then tag `sdk-vX.Y.Z` and push the tag.
3. `.github/workflows/sdk.yml` runs the Node 20/22 matrix, checks that the tag
   equals the package version, and publishes with
   `npm publish --access public --provenance`.

Prerequisites: an npm trusted publisher configured for this workflow. On npmjs.com
the package settings must list `DarCas` / `docmorph` / `sdk.yml` and allow
`npm publish` (staged publishing alone requires a manual 2FA approval). The job
authenticates with OIDC through `id-token: write`; it holds no npm token, so a
`NPM_TOKEN` secret does nothing. Trusted publishing needs npm ≥ 11.5.1, hence
`node-version: 24` in that job. A brand-new trusted publisher configuration
expires if it is not validated by a first successful publish within two days.
