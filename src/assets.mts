import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { BuildTool } from './run/build-tool.mts'

// Every emitter path in this package is built from here. `src/assets.mts` and
// `dist/assets.js` are both one level below the package root, so the same
// relative step works whether a consumer imports the source or the bundle.
const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export const EMITTERS_DIR: string = path.join(PACKAGE_ROOT, 'emitters')

export const GRADLE_INIT_SCRIPT_FILENAME = 'socket-facts.init.gradle'

export const SBT_PLUGIN_FILENAME = 'SocketFactsPlugin.scala'

export const SBT_PLUGIN_SOURCE_FILENAME = 'socket-facts.plugin.scala'

export const MAVEN_EXTENSION_JAR_FILENAME = 'socket-facts-maven-extension.jar'

export const MAVEN_EXTENSION_DIR: string = path.join(
  EMITTERS_DIR,
  'maven-extension',
)

// Fail closed. Maven with no extension on `-Dmaven.ext.class.path` runs to
// completion and emits nothing, which downstream reads as "this project has no
// dependencies" rather than as a failure — so an absent jar has to throw here,
// before the build runs.
export function assertMavenExtensionBuilt(): string {
  const jarPath = mavenExtensionJarPath()
  if (existsSync(jarPath)) {
    return jarPath
  }
  throw new Error(
    `Maven facts extension jar is missing. ` +
      `Where: ${jarPath}. ` +
      `Saw no file, wanted the built extension jar that ships with this package. ` +
      `Fix: in a published install this is a packaging defect — reinstall @socketsecurity/facts; ` +
      `in a local checkout run \`pnpm run build:maven-extension\` (needs a JDK).`,
  )
}

export function emitterAssetPath(tool: BuildTool): string {
  switch (tool) {
    case 'gradle':
      return gradleInitScriptPath()
    case 'maven':
      return mavenExtensionJarPath()
    case 'sbt':
      return sbtPluginSourcePath()
    default:
      throw new Error(
        `Unsupported build tool. Where: emitterAssetPath. Saw ${String(tool)}, wanted gradle, maven, or sbt. Fix: pass one of the supported BuildTool values.`,
      )
  }
}

export function gradleInitScriptPath(): string {
  return path.join(EMITTERS_DIR, GRADLE_INIT_SCRIPT_FILENAME)
}

export function mavenExtensionJarPath(): string {
  return path.join(MAVEN_EXTENSION_DIR, MAVEN_EXTENSION_JAR_FILENAME)
}

export function sbtPluginSourcePath(): string {
  return path.join(EMITTERS_DIR, SBT_PLUGIN_SOURCE_FILENAME)
}
