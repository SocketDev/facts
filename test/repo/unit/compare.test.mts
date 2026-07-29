import { describe, expect, it } from 'vitest'

import {
  compareFactsToGroundTruth,
  conformanceViolations,
  renderConformanceReport,
} from '../../../src/conformance/compare.mts'
import { createGroundTruth } from '../../../src/conformance/ground-truth.mts'

import type { SocketFactsSbom } from '../../../src/contract/sbom.mts'
import type { GroundTruth } from '../../../src/conformance/ground-truth.mts'

function facts(overrides: Partial<SocketFactsSbom> = {}): SocketFactsSbom {
  return {
    components: [
      {
        id: 'demo.dyn:widget:jar:1.7',
        name: 'widget',
        namespace: 'demo.dyn',
        type: 'maven',
        version: '1.7',
      },
    ],
    metadata: {
      format: 'socket-facts-sbom',
      tool: 'gradle',
      toolVersion: '8.14',
    },
    ...overrides,
  }
}

function truthOf(
  components: Record<string, string>,
  dependencies: Record<string, string[]> = {},
): GroundTruth {
  const truth = createGroundTruth()
  for (const [id, version] of Object.entries(components)) {
    truth.components.set(id, version)
  }
  for (const [id, edges] of Object.entries(dependencies)) {
    truth.dependencies.set(id, new Set(edges))
  }
  return truth
}

// These are the assertions that make the conformance suite worth running: if
// the diff cannot see a divergence here, a green compat run means nothing.
describe('compareFactsToGroundTruth', () => {
  it('agrees when the facts carry what the build resolved', () => {
    const comparison = compareFactsToGroundTruth(
      facts(),
      truthOf({ 'demo.dyn:widget': '1.7' }),
    )
    expect(conformanceViolations(comparison)).toEqual([])
    expect(comparison.summary.matches).toBe(1)
  })

  it('catches a resolver that reported the selector instead of the resolution', () => {
    const comparison = compareFactsToGroundTruth(
      facts({
        components: [
          {
            id: 'demo.dyn:widget:jar:1.+',
            name: 'widget',
            namespace: 'demo.dyn',
            type: 'maven',
            version: '1.+',
          },
        ],
      }),
      truthOf({ 'demo.dyn:widget': '1.7' }),
    )
    expect(comparison.summary.versionMismatches).toBe(1)
    expect(conformanceViolations(comparison)).toEqual([
      'demo.dyn:widget: the build resolved 1.7, the facts report 1.+',
    ])
  })

  it('catches a component the build resolved and the facts dropped', () => {
    const comparison = compareFactsToGroundTruth(
      facts(),
      truthOf({ 'demo.dyn:gadget': '1.9', 'demo.dyn:widget': '1.7' }),
    )
    expect(conformanceViolations(comparison)).toEqual([
      'demo.dyn:gadget: the build resolved 1.9, the facts carry no such component',
    ])
  })

  it('catches an edge the build reports and the facts omit', () => {
    const comparison = compareFactsToGroundTruth(
      facts(),
      truthOf(
        { 'demo.dyn:transitive': '2.0', 'demo.dyn:widget': '1.7' },
        { 'demo.dyn:widget': ['demo.dyn:transitive'] },
      ),
    )
    expect(comparison.summary.missingEdges).toBe(1)
    expect(conformanceViolations(comparison).join('\n')).toContain(
      'demo.dyn:widget: the build reports edges the facts omit — demo.dyn:transitive',
    )
  })

  // A ground-truth report covers one configuration or scope; the facts cover
  // every one the emitter scanned. Treating that as a divergence would make the
  // suite fail on correct output.
  it('tolerates a component the facts carry from another configuration', () => {
    const comparison = compareFactsToGroundTruth(
      facts({
        components: [
          ...facts().components,
          {
            id: 'org.junit:junit:jar:5.0',
            name: 'junit',
            namespace: 'org.junit',
            type: 'maven',
            version: '5.0',
          },
        ],
      }),
      truthOf({ 'demo.dyn:widget': '1.7' }),
    )
    expect(comparison.summary.extras).toBe(1)
    expect(conformanceViolations(comparison)).toEqual([])
  })

  it('reads a first-party module’s edges off its project entry', () => {
    const comparison = compareFactsToGroundTruth(
      facts({
        projects: [
          {
            dependencies: ['demo.dyn:widget:jar:1.7'],
            name: 'app',
            namespace: 'demo',
            resolvedAs: [],
            subprojectDir: '.',
            type: 'maven',
            version: '1.0.0',
          },
        ],
      }),
      truthOf(
        { 'demo:app': '1.0.0', 'demo.dyn:widget': '1.7' },
        { 'demo:app': ['demo.dyn:widget'] },
      ),
    )
    expect(conformanceViolations(comparison)).toEqual([])
  })
})

describe('renderConformanceReport', () => {
  it('leads with the counts and names every divergence', () => {
    const report = renderConformanceReport(
      compareFactsToGroundTruth(
        facts(),
        truthOf({ 'demo.dyn:gadget': '1.9', 'demo.dyn:widget': '1.7' }),
      ),
    )
    expect(report).toContain('components in the build report: 2')
    expect(report).toContain('Divergence:')
    expect(report).toContain('demo.dyn:gadget')
  })
})
