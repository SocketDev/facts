import { groundTruthKey } from './ground-truth.mts'

import type { SocketFactsSbom } from '../contract/sbom.mts'
import type { GroundTruth } from './ground-truth.mts'

// Why a diff rather than a golden file: a golden file records what this
// implementation produced, so it agrees with itself forever. A ground-truth
// diff records what the BUILD produced, so it disagrees the moment an
// implementation stops running the build. That difference is the entire
// regression test for the #1385 divergence.

export function compareFactsToGroundTruth(
  facts: SocketFactsSbom,
  truth: GroundTruth,
): ConformanceComparison {
  const factsVersions = factsComponentVersions(facts)
  const components: ComponentDiff[] = []
  const ids = [
    ...new Set([...factsVersions.keys(), ...truth.components.keys()]),
  ].toSorted()
  for (let i = 0, { length } = ids; i < length; i += 1) {
    const id = ids[i]!
    const factsVersion = factsVersions.get(id)
    const buildVersion = truth.components.get(id)
    const verdict: ComponentVerdict =
      factsVersion !== undefined && buildVersion !== undefined
        ? factsVersion === buildVersion
          ? 'match'
          : 'version-mismatch'
        : factsVersion !== undefined
          ? 'extra'
          : 'missing'
    components.push({
      buildVersion,
      factsVersion,
      id,
      verdict,
    })
  }

  const factsEdgeMap = factsEdges(facts)
  const edges: EdgeDiff[] = []
  for (const [id, buildEdges] of truth.dependencies) {
    const claimed = factsEdgeMap.get(id) ?? new Set<string>()
    const matching: string[] = []
    const missing: string[] = []
    for (const edge of buildEdges) {
      if (claimed.has(edge)) {
        matching.push(edge)
      } else {
        missing.push(edge)
      }
    }
    const extra: string[] = []
    for (const edge of claimed) {
      if (!buildEdges.has(edge)) {
        extra.push(edge)
      }
    }
    edges.push({
      extra: extra.toSorted(),
      id,
      matching: matching.toSorted(),
      missing: missing.toSorted(),
    })
  }
  edges.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const countOf = (verdict: ComponentVerdict): number =>
    components.filter(diff => diff.verdict === verdict).length
  return {
    components,
    edges,
    summary: {
      buildCount: truth.components.size,
      extras: countOf('extra'),
      factsCount: factsVersions.size,
      matches: countOf('match'),
      missing: countOf('missing'),
      missingEdges: edges.reduce((n, edge) => n + edge.missing.length, 0),
      versionMismatches: countOf('version-mismatch'),
    },
  }
}

// A ground-truth report covers one configuration; the facts cover every
// configuration the emitter scanned. So an `extra` is expected and an `extra`
// edge is expected — a `missing` component, a `missing` edge, or a
// `version-mismatch` is not. This is the assertion, stated once, so a caller
// cannot accidentally assert a weaker one.
export function conformanceViolations(
  comparison: ConformanceComparison,
): string[] {
  const violations: string[] = []
  for (const diff of comparison.components) {
    if (diff.verdict === 'missing') {
      violations.push(
        `${diff.id}: the build resolved ${diff.buildVersion}, the facts carry no such component`,
      )
    } else if (diff.verdict === 'version-mismatch') {
      violations.push(
        `${diff.id}: the build resolved ${diff.buildVersion}, the facts report ${diff.factsVersion}`,
      )
    }
  }
  for (const edge of comparison.edges) {
    if (edge.missing.length) {
      violations.push(
        `${edge.id}: the build reports edges the facts omit — ${edge.missing.join(', ')}`,
      )
    }
  }
  return violations
}

export type ComponentVerdict =
  // Same module, same resolved version.
  | 'match'
  // The build resolved it; the facts do not carry it.
  | 'missing'
  // The facts carry it; this ground-truth report does not. Expected whenever
  // the report covers one configuration and the facts cover every one.
  | 'extra'
  // Both carry it, at different versions. Always a defect.
  | 'version-mismatch'

export type ComponentDiff = {
  id: string
  verdict: ComponentVerdict
  factsVersion?: string | undefined
  buildVersion?: string | undefined
}

export type EdgeDiff = {
  id: string
  matching: string[]
  // Edges the facts claim and the build does not.
  extra: string[]
  // Edges the build reports and the facts do not.
  missing: string[]
}

export type ConformanceComparison = {
  components: ComponentDiff[]
  edges: EdgeDiff[]
  summary: {
    buildCount: number
    factsCount: number
    matches: number
    extras: number
    missing: number
    versionMismatches: number
    missingEdges: number
  }
}

export function factsComponentVersions(
  facts: SocketFactsSbom,
): Map<string, string> {
  const versions = new Map<string, string>()
  const { components } = facts
  for (let i = 0, { length } = components; i < length; i += 1) {
    const component = components[i]!
    if (component.version) {
      versions.set(
        groundTruthKey(component.namespace ?? '', component.name),
        component.version,
      )
    }
  }
  for (const project of facts.projects ?? []) {
    if (project.version) {
      versions.set(
        groundTruthKey(project.namespace ?? '', project.name),
        project.version,
      )
    }
  }
  return versions
}

export function factsEdges(facts: SocketFactsSbom): Map<string, Set<string>> {
  const keyById = new Map<string, string>()
  const { components } = facts
  for (let i = 0, { length } = components; i < length; i += 1) {
    const component = components[i]!
    keyById.set(
      component.id,
      groundTruthKey(component.namespace ?? '', component.name),
    )
  }
  const edges = new Map<string, Set<string>>()
  const edgesFrom = (key: string): Set<string> => {
    let set = edges.get(key)
    if (!set) {
      set = new Set()
      edges.set(key, set)
    }
    return set
  }
  const addEdges = (from: string, ids: readonly string[]): void => {
    const set = edgesFrom(from)
    for (let i = 0, { length } = ids; i < length; i += 1) {
      const to = keyById.get(ids[i]!)
      if (to) {
        set.add(to)
      }
    }
  }
  for (let i = 0, { length } = components; i < length; i += 1) {
    const component = components[i]!
    addEdges(keyById.get(component.id)!, component.dependencies ?? [])
  }
  // A first-party module is a `project`, not a `component`, so its direct
  // dependencies hang off the project entry. A ground-truth tree roots at that
  // module and lists them as its children, so without this the root's whole
  // edge set reads as missing — which is a modeling difference, not a
  // divergence.
  for (const project of facts.projects ?? []) {
    addEdges(
      groundTruthKey(project.namespace ?? '', project.name),
      project.dependencies,
    )
  }
  return edges
}

export function renderConformanceReport(
  comparison: ConformanceComparison,
): string {
  const { summary } = comparison
  const lines = [
    'facts vs. the build’s own resolution:',
    `  components in the build report: ${summary.buildCount}`,
    `  components in the facts:        ${summary.factsCount}`,
    `  matching:                       ${summary.matches}`,
    `  missing from the facts:         ${summary.missing}`,
    `  extra in the facts:             ${summary.extras}`,
    `  version mismatches:             ${summary.versionMismatches}`,
    `  edges missing from the facts:   ${summary.missingEdges}`,
  ]
  const violations = conformanceViolations(comparison)
  if (violations.length) {
    lines.push('')
    lines.push('Divergence:')
    for (let i = 0, { length } = violations; i < length; i += 1) {
      lines.push(`  - ${violations[i]}`)
    }
  }
  return lines.join('\n')
}
