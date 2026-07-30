import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import type { BuildTool } from '../../../../src/run/build-tool.mts'

// Set to a truthy value where the conformance matrix MUST run — a machine with
// the JVM toolchain installed, or a CI job that provisions one. A missing build
// tool then fails the suite instead of skipping it, so "the fixture is green"
// can never mean "the fixture never ran".
export const REQUIRE_COMPAT_ENV_VAR = 'SOCKET_FACTS_REQUIRE_COMPAT'

const BIN_ENV_VAR: Readonly<Record<BuildTool, string>> = Object.freeze({
  gradle: 'SOCKET_FACTS_GRADLE_BIN',
  maven: 'SOCKET_FACTS_MAVEN_BIN',
  sbt: 'SOCKET_FACTS_SBT_BIN',
})

const BIN_NAME: Readonly<Record<BuildTool, string>> = Object.freeze({
  gradle: 'gradle',
  maven: 'mvn',
  sbt: 'sbt',
})

export function compatIsRequired(): boolean {
  return Boolean(process.env[REQUIRE_COMPAT_ENV_VAR])
}

// An absolute path, because the generation API refuses anything else. Looks at
// the per-tool env override first, then walks PATH.
export function findBuildToolBin(tool: BuildTool): string | undefined {
  const override = process.env[BIN_ENV_VAR[tool]]
  if (override) {
    const resolved = path.isAbsolute(override)
      ? override
      : path.resolve(override)
    return existsSync(resolved) ? resolved : undefined
  }
  const entries = (process.env['PATH'] ?? '').split(path.delimiter)
  for (let i = 0, { length } = entries; i < length; i += 1) {
    const entry = entries[i]
    if (!entry) {
      continue
    }
    const candidate = path.join(entry, BIN_NAME[tool])
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

// The environment the fixture build runs with. Deliberately minimal: the
// generation API takes an explicit env, and a conformance run that inherited
// the developer's shell would not be reproducible.
export function compatEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env['PATH'] ?? '',
  }
  const javaHome = process.env['JAVA_HOME']
  if (javaHome) {
    env['JAVA_HOME'] = javaHome
  }
  const home = process.env['HOME']
  if (home) {
    env['HOME'] = home
  }
  return env
}

// Loud, not silent. A skipped conformance run prints why it skipped and what to
// install, and under REQUIRE_COMPAT it throws instead.
export function skipReasonFor(tool: BuildTool): string | undefined {
  const bin = findBuildToolBin(tool)
  if (bin) {
    return undefined
  }
  return (
    `No ${BIN_NAME[tool]} on PATH. ` +
    `Where: the ${tool} dynamic-version conformance fixture. ` +
    `Saw no executable, wanted a ${tool} install plus a JDK. ` +
    `Fix: install ${tool}, or point ${BIN_ENV_VAR[tool]} at its binary. ` +
    `Set ${REQUIRE_COMPAT_ENV_VAR}=1 to turn this skip into a failure.`
  )
}

export function enforceOrAnnounceSkip(reason: string): void {
  if (compatIsRequired()) {
    throw new Error(reason)
  }
  // oxlint-disable-next-line socket/no-console-prefer-logger -- a test-runner warning belongs on the runner's own stream, not a product logger.
  console.warn(`SKIPPED CONFORMANCE RUN: ${reason}`)
}
