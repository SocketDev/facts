import { existsSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertMavenExtensionBuilt,
  EMITTERS_DIR,
  emitterAssetPath,
  gradleInitScriptPath,
  MAVEN_EXTENSION_JAR_FILENAME,
  mavenExtensionJarPath,
  sbtPluginSourcePath,
} from '../../../src/assets.mts'

describe('emitter asset resolution', () => {
  it('ships the Gradle init script', () => {
    expect(existsSync(gradleInitScriptPath())).toBe(true)
  })

  it('ships the sbt plugin source', () => {
    expect(existsSync(sbtPluginSourcePath())).toBe(true)
  })

  it('ships the Maven extension sources and its wrapper', () => {
    const extensionDir = path.join(EMITTERS_DIR, 'maven-extension')
    expect(existsSync(path.join(extensionDir, 'pom.xml'))).toBe(true)
    expect(existsSync(path.join(extensionDir, 'mvnw'))).toBe(true)
  })

  it('routes each tool to its own asset', () => {
    expect(emitterAssetPath('gradle')).toBe(gradleInitScriptPath())
    expect(emitterAssetPath('maven')).toBe(mavenExtensionJarPath())
    expect(emitterAssetPath('sbt')).toBe(sbtPluginSourcePath())
  })

  it('resolves every asset under the package root, not the caller’s cwd', () => {
    for (const assetPath of [
      gradleInitScriptPath(),
      mavenExtensionJarPath(),
      sbtPluginSourcePath(),
    ]) {
      expect(path.isAbsolute(assetPath)).toBe(true)
      expect(assetPath.startsWith(EMITTERS_DIR)).toBe(true)
    }
  })
})

// Maven with no extension on the ext class path runs to completion and emits
// nothing, so an absent jar has to throw before the build starts.
describe('assertMavenExtensionBuilt', () => {
  it('returns the jar path or explains how to produce it', () => {
    if (existsSync(mavenExtensionJarPath())) {
      expect(assertMavenExtensionBuilt()).toBe(mavenExtensionJarPath())
      return
    }
    let message = ''
    try {
      assertMavenExtensionBuilt()
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain(MAVEN_EXTENSION_JAR_FILENAME)
    expect(message).toContain('Saw no file')
    expect(message).toContain('build:maven-extension')
  })
})
