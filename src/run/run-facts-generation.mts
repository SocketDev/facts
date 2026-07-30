import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  assertMavenExtensionBuilt,
  gradleInitScriptPath,
  SBT_PLUGIN_FILENAME,
  sbtPluginSourcePath,
} from '../assets.mts'
import { applyBuildEnvPolicy } from './env.mts'
import { assertFactsInvocation } from './invocation.mts'
import { factsGenerationTimeoutMs } from './timeouts.mts'
import {
  assembleFromRecords,
  runBuildToolNeverThrow,
  withTmpDir,
} from './spawn-build-tool.mts'

import type { BuildEnvPolicy } from './env.mts'
import type { FactsInvocation } from './invocation.mts'
import type { FactsGenerationResult } from './result.mts'
import type { SpawnConfig } from './spawn-build-tool.mts'

const FACTS_TASK = 'socketFacts'

export type FactsGenerationOptions = FactsInvocation & {
  // Reachability only: also materialize resolved artifact paths.
  withFiles?: boolean | undefined
  // Path to a newline-delimited GAV file scoping `withFiles` materialization;
  // absent means materialize everything.
  populateFilesFor?: string | undefined
  includeConfigs?: string | undefined
  excludeConfigs?: string | undefined
  // Scan-root-relative paths whose subprojects are skipped wholesale. Source-
  // file-level exclusion belongs to the downstream reachability analysis.
  excludePaths?: readonly string[] | undefined
  // Default 'scrub'. See env.mts for what 'scrub' removes and why.
  envPolicy?: BuildEnvPolicy | undefined
  stdio?: 'inherit' | 'pipe' | undefined
  signal?: AbortSignal | undefined
  // Ceiling on the build tool's wall time; 0 disables it. Defaults to
  // SOCKET_FACTS_TIMEOUT_MS, then to DEFAULT_FACTS_GENERATION_TIMEOUT_MS.
  timeoutMs?: number | undefined
}

export function emitterProps(
  config: FactsGenerationOptions,
  prefix: '-D' | '-P',
): string[] {
  const cfg = { __proto__: null, ...config } as typeof config
  const props: string[] = []
  if (cfg.withFiles) {
    props.push(`${prefix}socket.withFiles=true`)
  }
  if (cfg.populateFilesFor) {
    props.push(`${prefix}socket.populateFilesFor=${cfg.populateFilesFor}`)
  }
  if (cfg.includeConfigs) {
    props.push(`${prefix}socket.includeConfigs=${cfg.includeConfigs}`)
  }
  if (cfg.excludeConfigs) {
    props.push(`${prefix}socket.excludeConfigs=${cfg.excludeConfigs}`)
  }
  if (cfg.excludePaths?.length) {
    // CSV: an entry can never contain a comma, because the CLI flag these come
    // from is itself comma-split.
    props.push(`${prefix}socket.excludePaths=${cfg.excludePaths.join(',')}`)
  }
  return props
}

// Runs one build tool's Socket facts emitter against an already-resolved,
// already-vetted invocation and assembles the records it emits. Writes no
// files: the caller persists the SBOM and consumes the artifact paths.
export async function runFactsGeneration(
  config: FactsGenerationOptions,
): Promise<FactsGenerationResult> {
  const cfg = { __proto__: null, ...config } as typeof config
  assertFactsInvocation(config)
  switch (cfg.tool) {
    case 'gradle':
      return await runGradle(config)
    case 'maven':
      return await runMaven(config)
    case 'sbt':
      return await runSbt(config)
    default:
      throw new Error(
        `Unsupported build tool. Where: runFactsGeneration. Saw ${String(cfg.tool)}, wanted gradle, maven, or sbt. Fix: pass one of the supported BuildTool values.`,
      )
  }
}

export async function runGradle(
  config: FactsGenerationOptions,
): Promise<FactsGenerationResult> {
  const cfg = { __proto__: null, ...config } as typeof config
  return await withTmpDir('socket-gradle-facts-', async tmp => {
    const recordsFile = path.join(tmp, 'records.tsv')
    // The configuration cache stays off: the init script's resolvedConfiguration
    // API and its shared accumulator are not cache-safe.
    const args = [
      '--init-script',
      gradleInitScriptPath(),
      '-Dorg.gradle.configuration-cache=false',
      `-Psocket.recordsFile=${recordsFile}`,
      ...emitterProps(config, '-P'),
      ...cfg.opts,
      FACTS_TASK,
      '--no-daemon',
      '--console=plain',
    ]
    const out = await runBuildToolNeverThrow(
      cfg.bin,
      args,
      spawnConfigFor(config),
    )
    return await assembleFromRecords(out, recordsFile)
  })
}

export async function runMaven(
  config: FactsGenerationOptions,
): Promise<FactsGenerationResult> {
  const cfg = { __proto__: null, ...config } as typeof config
  const jarPath = assertMavenExtensionBuilt()
  return await withTmpDir('socket-maven-facts-', async tmp => {
    const recordsFile = path.join(tmp, 'records.tsv')
    // `validate` is the cheapest phase that reaches afterSessionEnd; no compile
    // is needed, because the analysis reads configured paths, not classes.
    const props = [
      `-Dmaven.ext.class.path=${jarPath}`,
      '-Dsocket.task=socket-facts',
      `-Dsocket.recordsFile=${recordsFile}`,
      ...emitterProps(config, '-D'),
    ]
    const args = [...props, ...cfg.opts, '--batch-mode', 'validate']
    const out = await runBuildToolNeverThrow(
      cfg.bin,
      args,
      spawnConfigFor(config),
    )
    return await assembleFromRecords(out, recordsFile)
  })
}

export async function runSbt(
  config: FactsGenerationOptions,
): Promise<FactsGenerationResult> {
  const cfg = { __proto__: null, ...config } as typeof config
  return await withTmpDir('socket-sbt-facts-', async globalBase => {
    await writeSbtPlugin(globalBase)
    const recordsFile = path.join(globalBase, 'records.tsv')
    // A fresh per-run global base rather than ~/.sbt: sbt executes everything
    // under plugins/, so a shared path is a code-injection surface. BSP is off
    // for this run.
    const props = [
      `-Dsbt.global.base=${globalBase}`,
      '-Dsbt.server.autostart=false',
      `-Dsocket.recordsFile=${recordsFile}`,
      ...emitterProps(config, '-D'),
    ]
    // sbt's launcher does not always honor JAVA_HOME, and never overrides a
    // caller-supplied --java-home.
    const javaHome = cfg.env['JAVA_HOME']
    const javaHomeOpt =
      javaHome && !cfg.opts.includes('--java-home')
        ? ['--java-home', javaHome]
        : []
    const args = [...javaHomeOpt, ...props, ...cfg.opts, '--batch', FACTS_TASK]
    const out = await runBuildToolNeverThrow(
      cfg.bin,
      args,
      spawnConfigFor(config),
    )
    return await assembleFromRecords(out, recordsFile)
  })
}

export function spawnConfigFor(config: FactsGenerationOptions): SpawnConfig {
  const cfg = { __proto__: null, ...config } as typeof config
  return {
    cwd: cfg.cwd,
    env: applyBuildEnvPolicy(cfg.env, cfg.envPolicy ?? 'scrub'),
    stdio: cfg.stdio ?? 'pipe',
    timeoutMs: cfg.timeoutMs ?? factsGenerationTimeoutMs(),
    ...(cfg.signal ? { signal: cfg.signal } : {}),
  }
}

export async function writeSbtPlugin(globalBase: string): Promise<void> {
  const source = await fs.readFile(sbtPluginSourcePath(), 'utf8')
  const pluginsDir = path.join(globalBase, 'plugins')
  await fs.mkdir(pluginsDir, { recursive: true })
  await fs.writeFile(path.join(pluginsDir, SBT_PLUGIN_FILENAME), source)
}
