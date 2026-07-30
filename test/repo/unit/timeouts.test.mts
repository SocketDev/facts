import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_FACTS_GENERATION_TIMEOUT_MS,
  FACTS_GENERATION_TIMEOUT_ENV_VAR,
  factsGenerationTimeoutMs,
  parseTimeoutMs,
} from '../../../src/run/timeouts.mts'

describe('parseTimeoutMs', () => {
  it('falls back on an absent or blank value', () => {
    expect(parseTimeoutMs(undefined, 7)).toBe(7)
    expect(parseTimeoutMs('', 7)).toBe(7)
  })

  // `Number(raw) || fallback` would swallow this, and 0 is how a caller asks
  // for no ceiling at all.
  it('honors an explicit zero', () => {
    expect(parseTimeoutMs('0', 7)).toBe(0)
  })

  it('falls back on a value that is not a non-negative number', () => {
    expect(parseTimeoutMs('soon', 7)).toBe(7)
    expect(parseTimeoutMs('-1', 7)).toBe(7)
    expect(parseTimeoutMs('Infinity', 7)).toBe(7)
  })
})

describe('factsGenerationTimeoutMs', () => {
  it('defaults to a ceiling generous enough for a real multi-module build', () => {
    vi.stubEnv(FACTS_GENERATION_TIMEOUT_ENV_VAR, '')
    expect(factsGenerationTimeoutMs()).toBe(DEFAULT_FACTS_GENERATION_TIMEOUT_MS)
    vi.unstubAllEnvs()
  })

  it('takes the environment override', () => {
    vi.stubEnv(FACTS_GENERATION_TIMEOUT_ENV_VAR, '1234')
    expect(factsGenerationTimeoutMs()).toBe(1234)
    vi.unstubAllEnvs()
  })
})
