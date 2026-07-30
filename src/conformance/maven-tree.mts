import { errorMessage } from '@socketsecurity/lib/errors/message'

import { createGroundTruth, groundTruthKey } from './ground-truth.mts'

import type { GroundTruth } from './ground-truth.mts'

export type MavenTreeNode = {
  groupId?: string | undefined
  artifactId?: string | undefined
  version?: string | undefined
  children?: unknown[] | undefined
}

export function isMavenTreeNode(value: unknown): value is MavenTreeNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// `mvn dependency:tree -DoutputType=json`. The root node is the project itself,
// so it lands in `components` alongside its dependencies — the comparer treats
// the project as a component the facts SBOM must also agree about.
export function parseMavenDependencyTreeJson(json: string): GroundTruth {
  const truth = createGroundTruth()
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    throw new Error(
      `Ground-truth dependency tree is not valid JSON. ` +
        `Where: mvn dependency:tree -DoutputType=json. ` +
        `Saw ${errorMessage(e)}, wanted a JSON object. ` +
        `Fix: re-run the goal with -DoutputFile so Maven's own log lines cannot mix into the payload.`,
    )
  }
  if (!isMavenTreeNode(parsed)) {
    throw new Error(
      `Ground-truth dependency tree has no root node. ` +
        `Where: mvn dependency:tree -DoutputType=json. ` +
        `Saw ${Array.isArray(parsed) ? 'an array' : typeof parsed}, wanted an object. ` +
        `Fix: check the goal ran against a single module, not a reactor aggregate.`,
    )
  }
  walkMavenNode(parsed, undefined, truth)
  return truth
}

export function walkMavenNode(
  node: MavenTreeNode,
  parentKey: string | undefined,
  truth: GroundTruth,
): void {
  const { artifactId, groupId, version } = node
  if (!groupId || !artifactId || !version) {
    return
  }
  const key = groundTruthKey(groupId, artifactId)
  truth.components.set(key, version)
  if (parentKey) {
    let edges = truth.dependencies.get(parentKey)
    if (!edges) {
      edges = new Set()
      truth.dependencies.set(parentKey, edges)
    }
    edges.add(key)
  }
  const { children } = node
  if (!Array.isArray(children)) {
    return
  }
  for (let i = 0, { length } = children; i < length; i += 1) {
    const child = children[i]
    if (isMavenTreeNode(child)) {
      walkMavenNode(child, key, truth)
    }
  }
}
