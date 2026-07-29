/*
 * @file Rolldown configuration for the published bundle.
 *
 *   Source is ESM `.mts`; output is CJS, the fleet publish shape. Three entry
 *   points, matching the `exports` map:
 *
 *   - `index` — the generation API plus every re-export.
 *   - `contract` — types and validators only, for a consumer that parses or
 *     emits the wire formats and never spawns a build.
 *   - `assets` — emitter path resolution, for a consumer that wires the
 *     emitters into a build it drives itself.
 *
 *   The emitter assets themselves are not bundled: they are Gradle/Scala/Java
 *   artifacts a build tool reads off disk, so they ship under `emitters/` and
 *   `src/assets.mts` resolves them relative to the package root.
 */

import path from 'node:path'

import type { RolldownOptions } from 'rolldown'

import { REPO_ROOT } from '../../scripts/fleet/paths.mts'

const srcPath = path.join(REPO_ROOT, 'src')
const distPath = path.join(REPO_ROOT, 'dist')

const config: RolldownOptions = {
  external: [/^@socketsecurity\//, /^node:/],
  input: {
    assets: path.join(srcPath, 'assets.mts'),
    conformance: path.join(srcPath, 'conformance', 'index.mts'),
    contract: path.join(srcPath, 'contract', 'index.mts'),
    index: path.join(srcPath, 'index.mts'),
  },
  output: {
    dir: distPath,
    entryFileNames: '[name].js',
    format: 'cjs',
    sourcemap: false,
  },
  platform: 'node',
}

export default config
