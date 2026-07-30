// The invocation contract is the trust boundary: every field this package
// refuses to guess is a decision the consumer owns.
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { assertFactsInvocation } from '../../../src/run/invocation.mts'

import type { FactsInvocation } from '../../../src/run/invocation.mts'

function invocation(overrides: Partial<FactsInvocation> = {}): FactsInvocation {
  return {
    bin: path.resolve('/opt/gradle/bin/gradle'),
    cwd: path.resolve('/repo'),
    env: {},
    opts: [],
    tool: 'gradle',
    ...overrides,
  }
}

describe('assertFactsInvocation', () => {
  it('accepts a fully specified invocation', () => {
    const value = invocation()
    expect(assertFactsInvocation(value)).toBe(value)
  })

  it('accepts an empty opts array and an empty env', () => {
    expect(() =>
      assertFactsInvocation(invocation({ env: {}, opts: [] })),
    ).not.toThrow()
  })

  // Every case below is something this package could plausibly have guessed —
  // a PATH lookup, a wrapper probe, process.env, process.cwd(). It guesses
  // none of them, because guessing is the consumer's trust decision.
  const underSpecified: ReadonlyArray<[string, Partial<FactsInvocation>]> = [
    ['a missing bin', { bin: undefined as unknown as string }],
    ['an empty bin', { bin: '' }],
    ['a relative bin', { bin: './gradlew' }],
    ['a bare bin name', { bin: 'gradle' }],
    ['a missing opts', { opts: undefined as unknown as string[] }],
    ['a non-string opt', { opts: [1] as unknown as string[] }],
    ['a missing env', { env: undefined as unknown as NodeJS.ProcessEnv }],
    ['a missing cwd', { cwd: undefined as unknown as string }],
    ['a relative cwd', { cwd: 'repo' }],
    ['an unsupported tool', { tool: 'bazel' as FactsInvocation['tool'] }],
  ]

  for (const [label, overrides] of underSpecified) {
    it(`refuses ${label} rather than defaulting it`, () => {
      expect(() => assertFactsInvocation(invocation(overrides))).toThrow(
        /under-specified/,
      )
    })
  }

  it('names the field, what it wanted, and who must fix it', () => {
    let message = ''
    try {
      assertFactsInvocation(invocation({ bin: 'gradle' }))
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('`bin`')
    expect(message).toContain('Where: runFactsGeneration')
    expect(message).toContain('an absolute path')
    expect(message).toContain('Fix: resolve and validate')
    expect(message).toContain('refuses to guess')
  })
})
