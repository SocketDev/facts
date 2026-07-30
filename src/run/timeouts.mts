import process from 'node:process'

// A build that hangs hangs the scan. socket-cli's facts spawn had no ceiling at
// all, so a wedged daemon or a repository that never answers stalled the whole
// run with no signal. The ceiling is generous rather than tight: dependency
// resolution on a large multi-module project legitimately takes minutes, and a
// premature kill would look exactly like the empty-SBOM failure this package
// exists to make impossible.

export const FACTS_GENERATION_TIMEOUT_ENV_VAR = 'SOCKET_FACTS_TIMEOUT_MS'

export const DEFAULT_FACTS_GENERATION_TIMEOUT_MS = 900_000

export function factsGenerationTimeoutMs(): number {
  return parseTimeoutMs(
    process.env[FACTS_GENERATION_TIMEOUT_ENV_VAR],
    DEFAULT_FACTS_GENERATION_TIMEOUT_MS,
  )
}

// `Number(raw) || fallback` would swallow an explicit 0, which is the way a
// caller asks for no ceiling at all.
export function parseTimeoutMs(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || raw === '') {
    return fallback
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
