import { describe, expect, it } from 'vitest'

import {
  applyBuildEnvPolicy,
  BUILD_TOOL_ARGUMENT_ENV_VARS,
  scrubBuildToolEnv,
} from '../../../src/run/env.mts'

// socket-cli's facts spawn inherited process.env wholesale, so anything that
// set one of these reached the build as extra JVM arguments. Scrubbing is the
// default here; a caller that wants the old behavior asks for it by name.
describe('scrubBuildToolEnv', () => {
  it('removes every argument-injection variable', () => {
    const env: NodeJS.ProcessEnv = { PATH: '/usr/bin' }
    for (const name of BUILD_TOOL_ARGUMENT_ENV_VARS) {
      env[name] = '-Dinjected=true'
    }
    const scrubbed = scrubBuildToolEnv(env)
    for (const name of BUILD_TOOL_ARGUMENT_ENV_VARS) {
      expect(scrubbed[name]).toBeUndefined()
    }
  })

  it('covers the four variables the extraction review named', () => {
    for (const name of [
      'GRADLE_OPTS',
      'JAVA_TOOL_OPTIONS',
      'MAVEN_OPTS',
      '_JAVA_OPTIONS',
    ]) {
      expect(BUILD_TOOL_ARGUMENT_ENV_VARS).toContain(name)
    }
  })

  it('keeps JAVA_HOME, which selects a JDK rather than injecting arguments', () => {
    expect(BUILD_TOOL_ARGUMENT_ENV_VARS).not.toContain('JAVA_HOME')
    expect(scrubBuildToolEnv({ JAVA_HOME: '/jdk' })['JAVA_HOME']).toBe('/jdk')
  })

  it('leaves unrelated variables alone', () => {
    const scrubbed = scrubBuildToolEnv({ CI: '1', PATH: '/usr/bin' })
    expect(scrubbed['CI']).toBe('1')
    expect(scrubbed['PATH']).toBe('/usr/bin')
  })

  it('does not mutate the caller’s environment', () => {
    const env: NodeJS.ProcessEnv = { GRADLE_OPTS: '-Xmx1g' }
    scrubBuildToolEnv(env)
    expect(env['GRADLE_OPTS']).toBe('-Xmx1g')
  })
})

describe('applyBuildEnvPolicy', () => {
  it('scrubs under the scrub policy', () => {
    expect(
      applyBuildEnvPolicy({ MAVEN_OPTS: '-Xmx1g' }, 'scrub')['MAVEN_OPTS'],
    ).toBeUndefined()
  })

  it('passes the environment through untouched under as-given', () => {
    const env: NodeJS.ProcessEnv = { MAVEN_OPTS: '-Xmx1g' }
    expect(applyBuildEnvPolicy(env, 'as-given')).toBe(env)
  })
})
