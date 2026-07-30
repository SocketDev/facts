import path from 'node:path'

export type BuildTool = 'gradle' | 'maven' | 'sbt'

export const BUILD_TOOLS: readonly BuildTool[] = ['gradle', 'maven', 'sbt']

// The binary name each tool conventionally installs on PATH. Exported as
// KNOWLEDGE, not as a fallback: nothing in this package looks a binary up on
// PATH. A consumer that wants PATH resolution does the lookup itself, applies
// its own trust policy to the result, and passes the absolute path back in.
const CONVENTIONAL_BIN: Readonly<Record<BuildTool, string>> = Object.freeze({
  gradle: 'gradle',
  maven: 'mvn',
  sbt: 'sbt',
})

// Project-local wrapper filename, where the tool has that convention. A wrapper
// pins the build-tool version the project expects, which is why a consumer
// usually prefers it. sbt has no wrapper convention. POSIX names only.
const WRAPPER_FILENAME: Readonly<Partial<Record<BuildTool, string>>> =
  Object.freeze({
    gradle: 'gradlew',
    maven: 'mvnw',
  })

export function buildToolWrapperFilename(tool: BuildTool): string | undefined {
  return WRAPPER_FILENAME[tool]
}

// The absolute path a project-local wrapper WOULD occupy. Pure: it neither
// checks that the file exists nor decides that running it is acceptable. Both
// of those are the consumer's call, because the consumer is the party that
// knows whether the project directory is attacker-controlled.
export function buildToolWrapperPath(
  tool: BuildTool,
  projectDir: string,
): string | undefined {
  const filename = WRAPPER_FILENAME[tool]
  return filename ? path.resolve(projectDir, filename) : undefined
}

export function conventionalBuildToolBin(tool: BuildTool): string {
  return CONVENTIONAL_BIN[tool]
}

export function isBuildTool(value: unknown): value is BuildTool {
  return BUILD_TOOLS.some(tool => tool === value)
}
