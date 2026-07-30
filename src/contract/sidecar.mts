// The `--compute-artifacts-sidecar` wire format: one entry per coordinate the
// build resolved. Per coordinate: `targets`/`sources` present → resolved, and
// the consumer uses the paths; both empty → a pom/BOM that resolved with no
// artifact, which is not a failure; the coordinate absent → this run did not
// resolve it.
export type ResolvedComponent = {
  group: string
  name: string
  version: string
  ext: string
  // The serialized sidecar carries an explicit JSON null for "no classifier";
  // omitting the key would change the wire shape a `.strict()` consumer parses.
  // socket-lint: allow prefer-undefined-over-null
  classifier: string | null
  // Classpath entries (jars / first-party output dirs).
  targets: string[]
  // First-party source roots; [] for external deps.
  sources: string[]
}

// Bare array, no envelope. Adding one is a coordinated release, not a local
// edit: see docs/agents.md/repo/contract.md.
export type ResolvedPathsSidecar = ResolvedComponent[]

// Resolved on-disk paths for a `withFiles` run, keyed by coordinate. In-memory
// only — this never crosses a process boundary, so Map/Set are fine here where
// they would not be in the sidecar above. `targets` = classpath entries (jars /
// module output dirs); `sources` = module source roots.
export type ResolvedArtifactPaths = {
  targetsByCoord: Map<string, string[]>
  // ext/classifier-agnostic, to recover the variant when an ingested ext is
  // untrustworthy (Gradle lockfile / version-catalog hardcode ext=jar).
  targetsByGav: Map<string, string[]>
  sourcesByCoord: Map<string, string[]>
  coords: Set<string>
}
