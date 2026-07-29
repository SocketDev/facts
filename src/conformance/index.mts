export {
  compareFactsToGroundTruth,
  conformanceViolations,
  renderConformanceReport,
} from './compare.mts'
export type {
  ComponentDiff,
  ComponentVerdict,
  ConformanceComparison,
  EdgeDiff,
} from './compare.mts'
export {
  createGroundTruth,
  groundTruthKey,
  parseGradleDependencyRow,
  parseGradleDependencyTree,
} from './ground-truth.mts'
export type { GradleRow, GroundTruth } from './ground-truth.mts'
export { isMavenTreeNode, parseMavenDependencyTreeJson } from './maven-tree.mts'
export type { MavenTreeNode } from './maven-tree.mts'
