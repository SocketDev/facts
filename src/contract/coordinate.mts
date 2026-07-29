// Coordinate-based (not `id`-based) so it also matches foreign SBOMs like
// CycloneDX. Empty segments dropped.
export function mavenCoordinateKey(
  groupId: string | undefined,
  artifactId: string | undefined,
  type: string | undefined,
  classifier: string | undefined,
  version: string | undefined,
): string {
  return [groupId, artifactId, type, classifier, version]
    .filter(Boolean)
    .join(':')
}
