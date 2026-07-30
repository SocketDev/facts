// The `.socket.facts.json` wire format. A second implementation parses these
// bytes, so treat the shape as frozen: see docs/agents.md/repo/contract.md for
// the release choreography an additive field needs.

export type AnyPURL = {
  type: string
  namespace?: string | undefined
  name: string
  version?: string | undefined
  qualifiers?: Record<string, string> | undefined
}

export const SOCKET_FACTS_SBOM_FORMAT = 'socket-facts-sbom'

export type SocketFactsTool = 'gradle' | 'maven' | 'sbt'

// No sources/targets here: those are local absolute paths, returned in-memory
// as ResolvedArtifactPaths, never serialized into the SBOM.
export type SocketFactsSbom = {
  metadata?: SocketFactsSbomMetadata | undefined
  projects?: SocketFactsSbomProject[] | undefined
  components: SocketFactsSbomComponent[]
}

export type SocketFactsSbomMetadata = {
  format: typeof SOCKET_FACTS_SBOM_FORMAT
  tool: SocketFactsTool
  toolVersion: string
  javaVersion?: string | undefined
}

export type SocketFactsSbomComponent = AnyPURL & {
  id: string
  direct?: boolean | undefined
  dev?: boolean | undefined
  dependencies?: string[] | undefined
}

export type SocketFactsSbomProject = AnyPURL & {
  subprojectDir: string
  dependencies: string[]
  resolvedAs: string[]
}
