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
- `@socketsecurity/facts/conformance` — parsers for a build tool's own
  dependency report plus a diff that fails on any component, version, or edge
  where the emitted facts and the build disagree.
- A dynamically-versioned conformance fixture for Gradle and Maven, asserting
  the emitters report what the build resolved rather than what the build file
  says. A wildcard, a bounded range, a SNAPSHOT, and a per-run project version
  make that unreachable by a cache read or a static parse.
- A wall-clock ceiling on the build-tool spawn, overridable with
  `SOCKET_FACTS_TIMEOUT_MS`.
