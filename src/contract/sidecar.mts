// The `--compute-artifacts-sidecar` wire format: one entry per coordinate the
// build resolved. Per coordinate: `targets`/`sources` present → resolved, and
// the consumer uses the paths; both empty → a pom/BOM that resolved with no
// artifact, which is not a failure; the coordinate absent → the consumer
// resolves that coordinate itself, with a best-effort probe of local caches,
// then `mvn -Dtransitive=false dependency:get`, then HTTP.
//
// So the sidecar is an accelerator, not an authority. A coordinate we omit is
// not dropped from the scan — it is handed back to exactly the reach-time
// resolution this format exists to avoid, at that path's cost and
// reliability. Treat a coverage gap as a correctness concern to surface, not
// as a silent fallback: see docs/agents.md/repo/contract.md.
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
