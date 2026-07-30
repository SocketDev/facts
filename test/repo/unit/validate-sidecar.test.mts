import { describe, expect, it } from 'vitest'

import {
  assertResolvedPathsSidecar,
  RESOLVED_COMPONENT_FIELDS,
  validateResolvedPathsSidecar,
} from '../../../src/contract/validate-sidecar.mts'

import type { ResolvedComponent } from '../../../src/contract/sidecar.mts'

function component(
  overrides: Partial<ResolvedComponent> = {},
): Record<string, unknown> {
  return {
    classifier: null,
    ext: 'jar',
    group: 'org.example',
    name: 'lib',
    sources: [],
    targets: ['/repo/lib.jar'],
    version: '1.2.3',
    ...overrides,
  }
}

describe('validateResolvedPathsSidecar', () => {
  it('accepts a bare array of well-formed components', () => {
    const result = validateResolvedPathsSidecar([component()])
    expect(result.ok).toBe(true)
  })

  it('accepts the empty sidecar', () => {
    expect(validateResolvedPathsSidecar([]).ok).toBe(true)
  })

  it('rejects an envelope object around the array', () => {
    const result = validateResolvedPathsSidecar({
      components: [component()],
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.violations[0]?.path).toBe('(root)')
  })

  it('rejects an omitted classifier, because the wire form is an explicit null', () => {
    const entry = component()
    delete entry['classifier']
    const result = validateResolvedPathsSidecar([entry])
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.violations[0]?.path).toBe(
      '[0].classifier',
    )
    expect(result.ok === false && result.violations[0]?.message).toContain(
      'explicit JSON null',
    )
  })

  it('accepts a string classifier', () => {
    expect(
      validateResolvedPathsSidecar([component({ classifier: 'sources' })]).ok,
    ).toBe(true)
  })

  // The consumer parses this payload with a strict schema, so an additive field
  // is a hard parse failure on its side. Catching it here means the producer
  // fails before it writes a sidecar the consumer will reject wholesale.
  it('rejects an unknown field the way the strict consumer would', () => {
    const result = validateResolvedPathsSidecar([
      component({}) && { ...component(), schemaVersion: 2 },
    ])
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.violations[0]?.path).toBe(
      '[0].schemaVersion',
    )
  })

  it('reports every malformed field rather than the first', () => {
    const result = validateResolvedPathsSidecar([
      { classifier: null, ext: 1, group: 2, name: 3, sources: 4, targets: 5 },
    ])
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.violations.length).toBeGreaterThan(4)
  })

  it('keeps its field list in sync with the serialized shape', () => {
    expect([...RESOLVED_COMPONENT_FIELDS]).toEqual(
      Object.keys(component()).toSorted(),
    )
  })
})

describe('assertResolvedPathsSidecar', () => {
  it('returns the payload when it conforms', () => {
    const payload = [component()]
    expect(assertResolvedPathsSidecar(payload, 'a test')).toBe(payload)
  })

  it('throws with what, where, saw, and fix', () => {
    let message = ''
    try {
      assertResolvedPathsSidecar('not a sidecar', 'a test')
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('does not match the wire contract')
    expect(message).toContain('Where: a test')
    expect(message).toContain('Saw:')
    expect(message).toContain('Fix:')
  })
})
