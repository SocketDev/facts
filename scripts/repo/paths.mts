/**
 * @file Repo-specific path constants. Inherits every fleet path by re-export
 *   (one path, one owner) and adds only the paths this package owns: the
 *   emitter assets and the source tree.
 */

import path from 'node:path'

import { REPO_ROOT } from '../fleet/paths.mts'

export * from '../fleet/paths.mts'

/**
 * The three build-tool emitters that ship as package data.
 */
export const EMITTERS_DIR = path.join(REPO_ROOT, 'emitters')

/**
 * Maven core-extension sources plus the wrapper that builds them.
 */
export const MAVEN_EXTENSION_DIR = path.join(EMITTERS_DIR, 'maven-extension')

/**
 * Built jar, at the path `src/assets.mts` resolves at runtime.
 */
export const MAVEN_EXTENSION_JAR = path.join(
  MAVEN_EXTENSION_DIR,
  'socket-facts-maven-extension.jar',
)

/**
 * The generation API and the wire contracts.
 */
export const SRC_DIR = path.join(REPO_ROOT, 'src')
