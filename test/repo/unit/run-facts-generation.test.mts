// The generation API validates the invocation before it spawns anything, so
// an under-specified call never reaches a build tool.
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { runFactsGeneration } from '../../../src/run/run-facts-generation.mts'

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

describe('runFactsGeneration', () => {
  it('validates before it spawns anything', async () => {
    await expect(
      runFactsGeneration(invocation({ bin: 'gradle' })),
    ).rejects.toThrow(/under-specified/)
  })
})
