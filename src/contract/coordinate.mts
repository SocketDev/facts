export interface MavenCoordinateKeyOptions {
  groupId?: string | undefined
  artifactId?: string | undefined
  type?: string | undefined
  classifier?: string | undefined
  version?: string | undefined
}

// Coordinate-based (not `id`-based) so it also matches foreign SBOMs like
// CycloneDX. Empty segments dropped.
export function mavenCoordinateKey(
  options?: MavenCoordinateKeyOptions | undefined,
): string {
  const { groupId, artifactId, type, classifier, version } = {
    __proto__: null,
    ...options,
  } as MavenCoordinateKeyOptions
  return [groupId, artifactId, type, classifier, version]
    .filter(Boolean)
    .join(':')
}
