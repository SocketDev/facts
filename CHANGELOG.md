# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- `runFactsGeneration` — runs a JVM build tool's Socket facts emitter against an
  already-resolved, already-validated invocation and returns the assembled SBOM,
  resolution report, and resolved artifact paths.
- `@socketsecurity/facts/contract` — the `.socket.facts.json` SBOM and
  resolved-paths sidecar types with runtime validators, so a producer and a
  consumer can share one definition instead of two hand-maintained copies.
- `@socketsecurity/facts/assets` — resolvers for the bundled Gradle init script,
  sbt plugin, and Maven extension jar, with a fail-closed check that a published
  install carrying no jar throws instead of emitting an empty SBOM.
- A dynamically-versioned conformance fixture asserting the emitters report the
  version the build resolved, which a cache read or a static parse cannot.
