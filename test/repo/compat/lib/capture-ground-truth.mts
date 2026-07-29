import { spawn } from '@socketsecurity/lib/process/spawn/child'

import { parseGradleDependencyTree } from '../../../../src/conformance/ground-truth.mts'
import { parseMavenDependencyTreeJson } from '../../../../src/conformance/maven-tree.mts'

import type { GroundTruth } from '../../../../src/conformance/ground-truth.mts'

// Capture the build tool's OWN authoritative resolution, so a conformance case
// diffs against what the build computed rather than against a golden file this
// implementation wrote. A golden file agrees with itself forever; the build
// does not.
//
// Nothing here falls back. sdxgen's comparable harness returns early when the
// tool is missing or the goal fails, which reports green on a machine where the
// oracle never ran — the exact shape of the gap this suite exists to close. A
// failure here throws, and the caller decides between a loud skip and a hard
// failure via SOCKET_FACTS_REQUIRE_COMPAT.

export type GroundTruthCapture = {
  truth: GroundTruth
  raw: string
}

function outputOf(result: { stdout?: unknown | undefined }): string {
  return typeof result.stdout === 'string' ? result.stdout : ''
}

function captureFailure(what: string, where: string, detail: string): Error {
  return new Error(
    `Could not capture the build's own resolution. ` +
      `Where: ${where}. ` +
      `Saw ${detail}, wanted ${what}. ` +
      `Fix: run the command by hand in the fixture workspace to see the tool's own error; ` +
      `a conformance case must never pass without an oracle to diff against.`,
  )
}

export async function captureGradleGroundTruth(
  bin: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  opts: readonly string[],
  configuration: string,
): Promise<GroundTruthCapture> {
  let raw = ''
  try {
    const result = await spawn(
      bin,
      [
        ...opts,
        '--no-daemon',
        '--console=plain',
        '-q',
        'dependencies',
        '--configuration',
        configuration,
      ],
      { cwd, env, stdio: 'pipe' },
    )
    raw = outputOf(result)
  } catch (e) {
    throw captureFailure(
      `Gradle's own \`dependencies --configuration ${configuration}\` report`,
      'captureGradleGroundTruth',
      `the task failed (${(e as Error).message})`,
    )
  }
  const truth = parseGradleDependencyTree(raw)
  if (truth.components.size === 0) {
    throw captureFailure(
      'at least one resolved module in the report',
      'captureGradleGroundTruth',
      'an empty dependency report',
    )
  }
  return { raw, truth }
}

// The dependency plugin is an artifact Maven has to resolve, which the
// fixture's own mirrored-away Central cannot serve. The oracle therefore runs
// against the caller's normal local repository while the fixture's file
// repository still supplies every `demo.dyn` coordinate, so the two runs agree
// about the module under test and differ only in where the plugin came from.
export async function captureMavenGroundTruth(
  bin: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  opts: readonly string[],
  outputFile: string,
): Promise<GroundTruthCapture> {
  try {
    await spawn(
      bin,
      [
        ...opts,
        '--batch-mode',
        '-q',
        'org.apache.maven.plugins:maven-dependency-plugin:3.8.1:tree',
        '-DoutputType=json',
        `-DoutputFile=${outputFile}`,
      ],
      { cwd, env, stdio: 'pipe' },
    )
  } catch (e) {
    throw captureFailure(
      "Maven's own dependency:tree report",
      'captureMavenGroundTruth',
      `the goal failed (${(e as Error).message})`,
    )
  }
  const { promises: fs } = await import('node:fs')
  let raw: string
  try {
    raw = await fs.readFile(outputFile, 'utf8')
  } catch {
    throw captureFailure(
      'the dependency:tree JSON the goal was told to write',
      'captureMavenGroundTruth',
      `no file at ${outputFile}`,
    )
  }
  return { raw, truth: parseMavenDependencyTreeJson(raw) }
}
