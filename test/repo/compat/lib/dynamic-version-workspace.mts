import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The fixture publishes several versions of each module into a hermetic local
// repository and then asks for them by a selector that names none of those
// versions. What the emitter reports is therefore the resolver's answer, not
// anything a reader of the build file could have copied out of it.
export type DynamicVersionCase = {
  // How the build file asks for the module.
  selector: string
  group: string
  name: string
  // Every version published to the local repository.
  published: readonly string[]
  // The version the resolver must pick.
  resolves: string
  // The on-disk filename the resolver must pick, when it differs from the
  // version (a unique SNAPSHOT publishes under a timestamped filename).
  resolvesFile?: string | undefined
}

export const SNAPSHOT_TIMESTAMP = '20260101.101010'

export const SNAPSHOT_BUILD_NUMBER = '3'

// A wildcard, a bounded range, and a unique SNAPSHOT. Each one is a shape the
// existing literal-version compat matrix has none of, and each one is a shape a
// cache read or a static parse of the build file gets wrong.
export const DYNAMIC_VERSION_CASES: readonly DynamicVersionCase[] = [
  {
    group: 'demo.dyn',
    name: 'gadget',
    published: ['1.3', '1.9', '2.5'],
    resolves: '1.9',
    selector: '[1.0,2.0)',
  },
  {
    group: 'demo.dyn',
    name: 'sprocket',
    published: ['1.0-SNAPSHOT'],
    resolves: '1.0-SNAPSHOT',
    resolvesFile: `sprocket-1.0-${SNAPSHOT_TIMESTAMP}-${SNAPSHOT_BUILD_NUMBER}.jar`,
    selector: '1.0-SNAPSHOT',
  },
  {
    group: 'demo.dyn',
    name: 'widget',
    published: ['1.0', '1.7', '2.0'],
    resolves: '1.7',
    selector: '1.+',
  },
]

const COMPAT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export const FIXTURE_SOURCE_DIR: string = path.join(
  COMPAT_DIR,
  'gradle-dynamic-version',
)

export const MAVEN_FIXTURE_SOURCE_DIR: string = path.join(
  COMPAT_DIR,
  'maven-dynamic-version',
)

// Maven has no wildcard selector, so the wildcard case is Gradle-only. The
// range and the SNAPSHOT apply to both.
export const MAVEN_DYNAMIC_VERSION_CASES: readonly DynamicVersionCase[] =
  DYNAMIC_VERSION_CASES.filter(entry => !entry.selector.includes('+'))

export const COMPUTED_VERSION_FILENAME = 'computed-version.txt'

export type DynamicVersionWorkspace = {
  projectDir: string
  gradleUserHome: string
  // Generated per run, so it appears in no committed file. The emitted project
  // record has to carry exactly this.
  computedProjectVersion: string
  cleanup: () => Promise<void>
}

// A jar is a zip, and dependency resolution never opens one, so the fixture
// publishes the 22-byte end-of-central-directory record that makes an empty but
// structurally valid archive. That keeps the fixture free of a `jar` dependency
// and free of committed binaries.
export function emptyZipBytes(): Buffer {
  return Buffer.from([
    0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0,
  ])
}

function pomFor(group: string, name: string, version: string): string {
  return [
    '<project xmlns="http://maven.apache.org/POM/4.0.0">',
    '  <modelVersion>4.0.0</modelVersion>',
    `  <groupId>${group}</groupId>`,
    `  <artifactId>${name}</artifactId>`,
    `  <version>${version}</version>`,
    '  <packaging>jar</packaging>',
    '</project>',
    '',
  ].join('\n')
}

function moduleMetadataFor(entry: DynamicVersionCase): string {
  const latest = entry.published[entry.published.length - 1]!
  return [
    '<metadata>',
    `  <groupId>${entry.group}</groupId>`,
    `  <artifactId>${entry.name}</artifactId>`,
    '  <versioning>',
    `    <latest>${latest}</latest>`,
    `    <release>${latest}</release>`,
    '    <versions>',
    ...entry.published.map(version => `      <version>${version}</version>`),
    '    </versions>',
    '  </versioning>',
    '</metadata>',
    '',
  ].join('\n')
}

function snapshotMetadataFor(entry: DynamicVersionCase): string {
  const value = `1.0-${SNAPSHOT_TIMESTAMP}-${SNAPSHOT_BUILD_NUMBER}`
  const updated = SNAPSHOT_TIMESTAMP.replace('.', '')
  const snapshotVersion = (extension: string): string =>
    [
      '      <snapshotVersion>',
      `        <extension>${extension}</extension>`,
      `        <value>${value}</value>`,
      `        <updated>${updated}</updated>`,
      '      </snapshotVersion>',
    ].join('\n')
  return [
    '<metadata>',
    `  <groupId>${entry.group}</groupId>`,
    `  <artifactId>${entry.name}</artifactId>`,
    `  <version>${entry.resolves}</version>`,
    '  <versioning>',
    '    <snapshot>',
    `      <timestamp>${SNAPSHOT_TIMESTAMP}</timestamp>`,
    `      <buildNumber>${SNAPSHOT_BUILD_NUMBER}</buildNumber>`,
    '    </snapshot>',
    '    <snapshotVersions>',
    snapshotVersion('jar'),
    snapshotVersion('pom'),
    '    </snapshotVersions>',
    '  </versioning>',
    '</metadata>',
    '',
  ].join('\n')
}

async function publishVersion(
  repoDir: string,
  entry: DynamicVersionCase,
  version: string,
): Promise<void> {
  const versionDir = path.join(
    repoDir,
    ...entry.group.split('.'),
    entry.name,
    version,
  )
  await fs.mkdir(versionDir, { recursive: true })
  const isSnapshot = version.endsWith('-SNAPSHOT')
  const base = isSnapshot
    ? `${entry.name}-1.0-${SNAPSHOT_TIMESTAMP}-${SNAPSHOT_BUILD_NUMBER}`
    : `${entry.name}-${version}`
  await fs.writeFile(
    path.join(versionDir, `${base}.pom`),
    pomFor(entry.group, entry.name, version),
  )
  await fs.writeFile(path.join(versionDir, `${base}.jar`), emptyZipBytes())
  if (isSnapshot) {
    await fs.writeFile(
      path.join(versionDir, 'maven-metadata.xml'),
      snapshotMetadataFor(entry),
    )
  }
}

export async function publishLocalRepo(repoDir: string): Promise<void> {
  for (let i = 0, { length } = DYNAMIC_VERSION_CASES; i < length; i += 1) {
    const entry = DYNAMIC_VERSION_CASES[i]!
    for (
      let j = 0, { length: versionCount } = entry.published;
      j < versionCount;
      j += 1
    ) {
      await publishVersion(repoDir, entry, entry.published[j]!)
    }
    if (entry.published.length > 1) {
      const moduleDir = path.join(
        repoDir,
        ...entry.group.split('.'),
        entry.name,
      )
      await fs.writeFile(
        path.join(moduleDir, 'maven-metadata.xml'),
        moduleMetadataFor(entry),
      )
    }
  }
}

// A copy under os.tmpdir(), never the committed fixture: the build writes
// `build/`, `.gradle/`, and a generated local repository, and a conformance run
// must not be able to dirty the tree it is asserting against.
export async function createDynamicVersionWorkspace(): Promise<DynamicVersionWorkspace> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'socket-facts-dynver-'))
  const projectDir = path.join(root, 'project')
  await fs.cp(FIXTURE_SOURCE_DIR, projectDir, { recursive: true })
  await publishLocalRepo(path.join(projectDir, 'localrepo'))
  const computedProjectVersion = `0.0.0-resolved-${Date.now()}`
  await fs.writeFile(
    path.join(projectDir, COMPUTED_VERSION_FILENAME),
    `${computedProjectVersion}\n`,
  )
  return {
    computedProjectVersion,
    gradleUserHome: path.join(root, 'gradle-home'),
    projectDir,
    cleanup: async () => {
      await fs.rm(root, { force: true, recursive: true })
    },
  }
}

export type MavenDynamicVersionWorkspace = {
  projectDir: string
  localRepositoryDir: string
  settingsFile: string
  computedProjectVersion: string
  cleanup: () => Promise<void>
}

// Mirrors Central to an unreachable URL so the fixture cannot silently resolve
// a real artifact: everything it reports has to have come from the generated
// repository, which is the whole point of the assertion.
function offlineSettingsXml(): string {
  return [
    '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">',
    '  <mirrors>',
    '    <mirror>',
    '      <id>socket-facts-no-network</id>',
    '      <name>the conformance fixture resolves offline</name>',
    '      <url>file:///dev/null/socket-facts-unreachable</url>',
    '      <mirrorOf>central</mirrorOf>',
    '    </mirror>',
    '  </mirrors>',
    '</settings>',
    '',
  ].join('\n')
}

export async function createMavenDynamicVersionWorkspace(): Promise<MavenDynamicVersionWorkspace> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'socket-facts-mvn-dynver-'),
  )
  const projectDir = path.join(root, 'project')
  await fs.cp(MAVEN_FIXTURE_SOURCE_DIR, projectDir, { recursive: true })
  await publishLocalRepo(path.join(projectDir, 'localrepo'))
  const settingsFile = path.join(root, 'settings.xml')
  await fs.writeFile(settingsFile, offlineSettingsXml())
  return {
    computedProjectVersion: `0.0.0-resolved-${Date.now()}`,
    localRepositoryDir: path.join(root, 'm2'),
    projectDir,
    settingsFile,
    cleanup: async () => {
      await fs.rm(root, { force: true, recursive: true })
    },
  }
}
