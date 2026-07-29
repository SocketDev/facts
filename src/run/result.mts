import type { SocketFactsSbom } from '../contract/sbom.mts'
import type { ResolvedArtifactPaths } from '../contract/sidecar.mts'
import type { ResolutionReport } from '../report/report-types.mts'

export type FactsGenerationResult = {
  // The build tool's exit code. A non-zero code with a populated `report` is an
  // unresolved dependency; a non-zero code with nothing at all is a crashed
  // build. The caller's policy layer decides which of those blocks a scan.
  code: number
  facts: SocketFactsSbom
  report: ResolutionReport
  artifactPaths: ResolvedArtifactPaths
  // Captured build-tool output; empty when stdio is 'inherit'.
  stderr: string
  stdout: string
}
