// Environment variables every JVM build tool reads as extra JVM/tool arguments.
// Each one is an argument-injection channel into a build this package is about
// to spawn, so they are removed unless a caller explicitly asks for the
// environment to pass through untouched. JAVA_HOME is deliberately absent: it
// selects a JDK rather than injecting arguments, and sbt's launcher needs it.
export const BUILD_TOOL_ARGUMENT_ENV_VARS: readonly string[] = [
  'GRADLE_OPTS',
  'JAVA_OPTS',
  'JAVA_TOOL_OPTIONS',
  'JDK_JAVA_OPTIONS',
  'MAVEN_OPTS',
  'SBT_OPTS',
  '_JAVA_OPTIONS',
]

export function applyBuildEnvPolicy(
  env: NodeJS.ProcessEnv,
  policy: BuildEnvPolicy,
): NodeJS.ProcessEnv {
  return policy === 'scrub' ? scrubBuildToolEnv(env) : env
}

export type BuildEnvPolicy = 'as-given' | 'scrub'

export function scrubBuildToolEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const scrubbed: NodeJS.ProcessEnv = Object.assign(Object.create(null), env)
  for (
    let i = 0, { length } = BUILD_TOOL_ARGUMENT_ENV_VARS;
    i < length;
    i += 1
  ) {
    delete scrubbed[BUILD_TOOL_ARGUMENT_ENV_VARS[i]!]
  }
  return scrubbed
}
