// The `--compute-artifacts-sidecar` wire format: one entry per coordinate the
// build resolved. Per coordinate: `targets`/`sources` present → resolved, and
// the consumer uses the paths; both empty → a pom/BOM (or a NuGet package with
// no runtime assemblies) that resolved with no artifact, which is not a
// failure, because the emitters are fail-closed and record a failure instead
// of an empty entry when an artifact is genuinely missing; the coordinate
// absent → the consumer
// resolves that coordinate itself, with a best-effort probe of local caches,
// then `mvn -Dtransitive=false dependency:get`, then HTTP.
//
// So the sidecar is an accelerator, not an authority. A coordinate we omit is
// not dropped from the scan — it is handed back to exactly the reach-time
// resolution this format exists to avoid, at that path's cost and
// reliability. Treat a coverage gap as a correctness concern to surface, not
// as a silent fallback: see docs/agents.md/repo/contract.md.
// One coordinate can exist in two ecosystems at once — a groupless NuGet id
// and a Maven artifactId collide on the same key — so the ecosystem tag is
// part of the identity, not decoration. The producer ALWAYS writes it; a
// consumer that does not know the key reads a missing tag as 'maven', which
// is what every sidecar written before the tag existed meant.
//
// Emitting this field is gated on the consumer's schema accepting it: see
// "An additive field is a coordinated release" in
// docs/agents.md/repo/contract.md.
export type ResolvedComponent = {
  group: string
  name: string
  version: string
  ext: string
  // The serialized sidecar carries an explicit JSON null for "no classifier";
  // omitting the key would change the wire shape a `.strict()` consumer parses.
  // oxlint-disable-next-line socket/prefer-undefined-over-null -- wire shape
  classifier: string | null
  // The artifact's purl `type`, carried verbatim as the ecosystem
  // discriminator each consumer filters on: 'maven' for gradle/sbt/maven,
  // 'nuget' for dotnet. It is exactly the facts component's `type`, so there
  // is no narrowing and no re-derivation.
  //
  // Optional in the TYPE, always written by the PRODUCER. Every sidecar this
  // package emits carries the tag; the optionality exists so reading a
  // sidecar written before the tag existed is still valid, and such a payload
  // means 'maven'. Read it as `entry.ecosystem ?? 'maven'`.
  ecosystem?: string | undefined
  // Classpath entries (jars / first-party output dirs). For NuGet, runtime
  // (lib/) assemblies and first-party build outputs.
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
