/*
 * @file Exports-map generator config.
 *
 *   The bundle has three entry points — `index`, `contract`, and `assets` —
 *   but `tsc --emitDeclarationOnly` writes one `.d.mts` per source module, so
 *   a declaration lands beside the entry declarations for every file under
 *   `src/`. Those are not separate public entry points: the three entry
 *   declarations re-export everything through them, and that is the only way a
 *   consumer reaches them.
 *
 *   Giving each one its own `exports` subpath would advertise an API surface
 *   this package does not intend to keep stable — `src/pipeline/`,
 *   `src/report/`, and `src/run/` are internal layout, and the pipeline pieces
 *   consumers do compose with are re-exported from the root entry. They are
 *   declared generator-ignored instead. rolldown's shared chunks are ignored
 *   for the same reason: they are bundler output, not API.
 */

/**
 * Shape the exports generator and `public-files-are-exported` both read.
 */
export interface PackageExportsConfig {
  readonly ignore: readonly string[]
}

export const config: PackageExportsConfig = {
  ignore: [
    'dist/*.d.mts',
    'dist/contract/*.d.mts',
    'dist/pipeline/*.d.mts',
    'dist/report/*.d.mts',
    'dist/rolldown-runtime-*.js',
    'dist/run/*.d.mts',
    'dist/validate-sidecar-*.js',
  ],
}
