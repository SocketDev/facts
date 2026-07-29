import { SOCKET_FACTS_SBOM_FORMAT } from './sbom.mts'
import {
  checkStringArray,
  contractError,
  describeType,
  isPlainObject,
} from './violations.mts'

import type { SocketFactsSbom, SocketFactsTool } from './sbom.mts'
import type { ContractValidation, ContractViolation } from './violations.mts'

export const SOCKET_FACTS_TOOLS: readonly SocketFactsTool[] = [
  'gradle',
  'maven',
  'sbt',
]

export function assertSocketFactsSbom(
  input: unknown,
  where: string,
): SocketFactsSbom {
  const result = validateSocketFactsSbom(input)
  if (result.ok) {
    return result.value
  }
  throw contractError(
    'Socket facts SBOM does not match the wire contract',
    where,
    result.violations,
  )
}

export function checkComponent(
  value: unknown,
  path: string,
  violations: ContractViolation[],
): void {
  if (!isPlainObject(value)) {
    violations.push({
      path,
      message: `saw ${describeType(value)}, wanted an object`,
    })
    return
  }
  checkPurl(value, path, violations)
  if (typeof value['id'] !== 'string') {
    violations.push({
      path: `${path}.id`,
      message: `saw ${describeType(value['id'])}, wanted a string`,
    })
  }
  for (const field of ['direct', 'dev']) {
    const flag = value[field]
    if (flag !== undefined && typeof flag !== 'boolean') {
      violations.push({
        path: `${path}.${field}`,
        message: `saw ${describeType(flag)}, wanted a boolean or the field omitted`,
      })
    }
  }
  if (value['dependencies'] !== undefined) {
    checkStringArray(value['dependencies'], `${path}.dependencies`, violations)
  }
}

export function checkMetadata(
  value: unknown,
  path: string,
  violations: ContractViolation[],
): void {
  if (value === undefined) {
    return
  }
  if (!isPlainObject(value)) {
    violations.push({
      path,
      message: `saw ${describeType(value)}, wanted an object`,
    })
    return
  }
  if (value['format'] !== SOCKET_FACTS_SBOM_FORMAT) {
    violations.push({
      path: `${path}.format`,
      message: `saw ${JSON.stringify(value['format'])}, wanted "${SOCKET_FACTS_SBOM_FORMAT}"`,
    })
  }
  if (!SOCKET_FACTS_TOOLS.some(tool => tool === value['tool'])) {
    violations.push({
      path: `${path}.tool`,
      message: `saw ${JSON.stringify(value['tool'])}, wanted one of ${SOCKET_FACTS_TOOLS.join(', ')}`,
    })
  }
  if (typeof value['toolVersion'] !== 'string') {
    violations.push({
      path: `${path}.toolVersion`,
      message: `saw ${describeType(value['toolVersion'])}, wanted a string`,
    })
  }
  checkOptionalString(value, 'javaVersion', path, violations)
}

export function checkOptionalString(
  container: Record<string, unknown>,
  field: string,
  path: string,
  violations: ContractViolation[],
): void {
  const value = container[field]
  if (value !== undefined && typeof value !== 'string') {
    violations.push({
      path: `${path}.${field}`,
      message: `saw ${describeType(value)}, wanted a string or the field omitted`,
    })
  }
}

export function checkProject(
  value: unknown,
  path: string,
  violations: ContractViolation[],
): void {
  if (!isPlainObject(value)) {
    violations.push({
      path,
      message: `saw ${describeType(value)}, wanted an object`,
    })
    return
  }
  checkPurl(value, path, violations)
  if (typeof value['subprojectDir'] !== 'string') {
    violations.push({
      path: `${path}.subprojectDir`,
      message: `saw ${describeType(value['subprojectDir'])}, wanted a string`,
    })
  }
  checkStringArray(value['dependencies'], `${path}.dependencies`, violations)
  checkStringArray(value['resolvedAs'], `${path}.resolvedAs`, violations)
}

export function checkPurl(
  value: Record<string, unknown>,
  path: string,
  violations: ContractViolation[],
): void {
  if (typeof value['type'] !== 'string') {
    violations.push({
      path: `${path}.type`,
      message: `saw ${describeType(value['type'])}, wanted a string`,
    })
  }
  if (typeof value['name'] !== 'string') {
    violations.push({
      path: `${path}.name`,
      message: `saw ${describeType(value['name'])}, wanted a string`,
    })
  }
  checkOptionalString(value, 'namespace', path, violations)
  checkOptionalString(value, 'version', path, violations)
  checkQualifiers(value['qualifiers'], `${path}.qualifiers`, violations)
}

export function checkQualifiers(
  value: unknown,
  path: string,
  violations: ContractViolation[],
): void {
  if (value === undefined) {
    return
  }
  if (!isPlainObject(value)) {
    violations.push({
      path,
      message: `saw ${describeType(value)}, wanted an object of string values`,
    })
    return
  }
  const keys = Object.keys(value)
  for (let i = 0, { length } = keys; i < length; i += 1) {
    const key = keys[i]!
    if (typeof value[key] !== 'string') {
      violations.push({
        path: `${path}.${key}`,
        message: `saw ${describeType(value[key])}, wanted a string`,
      })
    }
  }
}

// Deliberately NOT strict about unknown top-level keys: the SBOM travels to the
// Socket backend, which tolerates additive fields. The sidecar validator is the
// strict one, because its consumer is.
// Narrowing helper rather than a cast: the checks above already proved the
// shape, and an empty violation list is the proof.
export function isCheckedSbom(
  value: unknown,
  violations: readonly ContractViolation[],
): value is SocketFactsSbom {
  return isPlainObject(value) && violations.length === 0
}

export function validateSocketFactsSbom(
  input: unknown,
): ContractValidation<SocketFactsSbom> {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      violations: [
        {
          path: '(root)',
          message: `saw ${describeType(input)}, wanted an object`,
        },
      ],
    }
  }
  const violations: ContractViolation[] = []
  checkMetadata(input['metadata'], 'metadata', violations)
  const { components } = input
  if (!Array.isArray(components)) {
    violations.push({
      path: 'components',
      message: `saw ${describeType(components)}, wanted an array`,
    })
  } else {
    for (let i = 0, { length } = components; i < length; i += 1) {
      checkComponent(components[i], `components[${i}]`, violations)
    }
  }
  const { projects } = input
  if (projects !== undefined) {
    if (!Array.isArray(projects)) {
      violations.push({
        path: 'projects',
        message: `saw ${describeType(projects)}, wanted an array or the field omitted`,
      })
    } else {
      for (let i = 0, { length } = projects; i < length; i += 1) {
        checkProject(projects[i], `projects[${i}]`, violations)
      }
    }
  }
  return isCheckedSbom(input, violations)
    ? { ok: true, value: input }
    : { ok: false, violations }
}
