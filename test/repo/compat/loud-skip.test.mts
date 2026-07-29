import path from 'node:path'
import process from 'node:process'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  compatEnv,
  enforceOrAnnounceSkip,
  findBuildToolBin,
  REQUIRE_COMPAT_ENV_VAR,
  skipReasonFor,
} from './lib/toolchain.mts'

// A conformance suite that skips quietly reports green on a machine where it
// never ran, which is the exact failure mode the dynamic-version fixture exists
// to prevent. These tests hold the skip path to the same standard as the
// assertions it guards.

const MISSING_GRADLE = '/socket-facts/definitely/not/a/gradle'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('findBuildToolBin', () => {
  it('ignores an override that points at nothing', () => {
    vi.stubEnv('SOCKET_FACTS_GRADLE_BIN', MISSING_GRADLE)
    expect(findBuildToolBin('gradle')).toBeUndefined()
  })

  it('returns an absolute path, which the generation API requires', () => {
    const bin = findBuildToolBin('gradle')
    if (bin) {
      expect(path.isAbsolute(bin)).toBe(true)
    }
  })
})

describe('skipReasonFor', () => {
  it('explains what is missing, what was wanted, and how to fix it', () => {
    vi.stubEnv('PATH', '')
    const reason = skipReasonFor('gradle')
    expect(reason).toBeDefined()
    expect(reason).toContain('Where:')
    expect(reason).toContain('Saw no executable, wanted')
    expect(reason).toContain('Fix: install gradle')
    expect(reason).toContain(REQUIRE_COMPAT_ENV_VAR)
  })
})

describe('enforceOrAnnounceSkip', () => {
  it('warns loudly when the toolchain is merely absent', () => {
    vi.stubEnv(REQUIRE_COMPAT_ENV_VAR, '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    enforceOrAnnounceSkip('no gradle here')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('SKIPPED CONFORMANCE RUN')
  })

  it('fails instead of skipping where the matrix is required', () => {
    vi.stubEnv(REQUIRE_COMPAT_ENV_VAR, '1')
    expect(() => enforceOrAnnounceSkip('no gradle here')).toThrow(
      'no gradle here',
    )
  })
})

describe('compatEnv', () => {
  it('carries PATH so the build tool can find its own helpers', () => {
    expect(compatEnv()['PATH']).toBe(process.env['PATH'] ?? '')
  })

  it('carries nothing the fixture did not ask for', () => {
    vi.stubEnv('GRADLE_OPTS', '-Dinjected=true')
    expect(compatEnv()['GRADLE_OPTS']).toBeUndefined()
  })
})
