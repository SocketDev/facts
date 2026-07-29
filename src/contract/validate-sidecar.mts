import {
  checkNoUnknownKeys,
  checkStringArray,
  contractError,
  describeType,
  isPlainObject,
} from './violations.mts'

import type { ResolvedComponent, ResolvedPathsSidecar } from './sidecar.mts'
import type { ContractValidation, ContractViolation } from './violations.mts'

// Mirrors the consumer's strict schema exactly. Sorted so a reader can diff it
// against the consumer's field list at a glance.
export const RESOLVED_COMPONENT_FIELDS: readonly string[] = [
  'classifier',
  'ext',
  'group',
  'name',
  'sources',
  'targets',
  'version',
]

const REQUIRED_STRING_FIELDS: readonly string[] = [
  'ext',
  'group',
  'name',
  'version',
]

export function assertResolvedPathsSidecar(
  input: unknown,
  where: string,
): ResolvedPathsSidecar {
  const result = validateResolvedPathsSidecar(input)
  if (result.ok) {
    return result.value
  }
  throw contractError(
    'Resolved-paths sidecar does not match the wire contract',
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
  for (let i = 0, { length } = REQUIRED_STRING_FIELDS; i < length; i += 1) {
    const field = REQUIRED_STRING_FIELDS[i]!
    if (typeof value[field] !== 'string') {
      violations.push({
        path: `${path}.${field}`,
        message: `saw ${describeType(value[field])}, wanted a string`,
      })
    }
  }
  // An absent key and an explicit null are different bytes on the wire, and the
  // consumer's schema accepts only `string | null`.
  if (!('classifier' in value)) {
    violations.push({
      path: `${path}.classifier`,
      message:
        'field is absent, wanted an explicit JSON null when the artifact has no classifier',
    })
  } else if (
    value['classifier'] !== null &&
    typeof value['classifier'] !== 'string'
  ) {
    violations.push({
      path: `${path}.classifier`,
      message: `saw ${describeType(value['classifier'])}, wanted a string or an explicit null`,
    })
  }
  checkStringArray(value['sources'], `${path}.sources`, violations)
  checkStringArray(value['targets'], `${path}.targets`, violations)
  checkNoUnknownKeys(value, RESOLVED_COMPONENT_FIELDS, path, violations)
}

// Narrowing helper rather than a cast: the per-entry checks above already
// proved the shape, and an empty violation list is the proof.
export function isCheckedSidecar(
  value: unknown,
  violations: readonly ContractViolation[],
): value is ResolvedComponent[] {
  return Array.isArray(value) && violations.length === 0
}

export function validateResolvedPathsSidecar(
  input: unknown,
): ContractValidation<ResolvedPathsSidecar> {
  const violations: ContractViolation[] = []
  if (!Array.isArray(input)) {
    return {
      ok: false,
      violations: [
        {
          path: '(root)',
          message: `saw ${describeType(input)}, wanted a bare array of resolved components`,
        },
      ],
    }
  }
  for (let i = 0, { length } = input; i < length; i += 1) {
    checkComponent(input[i], `[${i}]`, violations)
  }
  return isCheckedSidecar(input, violations)
    ? { ok: true, value: input }
    : { ok: false, violations }
}
