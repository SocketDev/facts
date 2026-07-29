import { existsSync, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { safeDelete } from '@socketsecurity/lib/fs/safe'
import { spawn } from '@socketsecurity/lib/process/spawn/child'

import { assembleFacts } from '../pipeline/assemble.mts'
import { parseRecords } from '../pipeline/records.mts'

import type { FactsGenerationResult } from './result.mts'

export async function assembleFromRecords(
  out: BuildToolOutput,
  recordsFile: string,
): Promise<FactsGenerationResult> {
  const text = existsSync(recordsFile)
    ? await fs.readFile(recordsFile, 'utf8')
    : ''
  const { artifactPaths, facts, report } = assembleFacts(parseRecords(text))
  return {
    artifactPaths,
    code: out.code,
    facts,
    report,
    stderr: out.stderr,
    stdout: out.stdout,
  }
}

export type BuildToolOutput = {
  code: number
  stdout: string
  stderr: string
}

export type SpawnConfig = {
  cwd: string
  env: NodeJS.ProcessEnv
  signal?: AbortSignal | undefined
  stdio: 'inherit' | 'pipe'
  // 0 means no ceiling. See run/timeouts.mts.
  timeoutMs: number
}

// A build tool that exits non-zero still leaves a usable records file, because
// the emitter writes failure records before the build gives up. Only a
// launch-level error — a missing executable, whose `code` is a string like
// 'ENOENT' — propagates.
// A build tool that exits non-zero rejects with the spawn-result shape: a
// numeric exit `code` plus captured output. A launch failure — a missing
// executable — carries a string `code` like 'ENOENT' and is NOT this.
export function isProcessExitError(value: unknown): value is {
  code: number
  stderr?: unknown | undefined
  stdout?: unknown | undefined
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown | undefined }).code === 'number'
  )
}

export async function runBuildToolNeverThrow(
  bin: string,
  args: readonly string[],
  config: SpawnConfig,
): Promise<BuildToolOutput> {
  try {
    const result = await spawn(bin, [...args], {
      cwd: config.cwd,
      env: config.env,
      stdio: config.stdio,
      ...(config.timeoutMs > 0 ? { timeout: config.timeoutMs } : {}),
      ...(config.signal ? { signal: config.signal } : {}),
    })
    return {
      code: result.code,
      stdout: typeof result.stdout === 'string' ? result.stdout : '',
      stderr: typeof result.stderr === 'string' ? result.stderr : '',
    }
  } catch (e) {
    if (isProcessExitError(e)) {
      return {
        code: e.code,
        stdout: typeof e.stdout === 'string' ? e.stdout : '',
        stderr: typeof e.stderr === 'string' ? e.stderr : '',
      }
    }
    throw e
  }
}

export async function withTmpDir<T>(
  prefix: string,
  fn: (tmpDir: string) => Promise<T>,
): Promise<T> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  try {
    return await fn(tmpDir)
  } finally {
    await safeDelete(tmpDir).catch(() => {})
  }
}
