export function checkNoUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  violations: ContractViolation[],
): void {
  const keys = Object.keys(value)
  for (let i = 0, { length } = keys; i < length; i += 1) {
    const key = keys[i]!
    if (!allowed.includes(key)) {
      violations.push({
        path: `${path}.${key}`,
        message: `unknown field; the consumer parses this shape with a strict schema and rejects the whole payload on an unrecognized key. Adding a field is a coordinated release — see docs/agents.md/repo/contract.md`,
      })
    }
  }
}

export function checkStringArray(
  value: unknown,
  path: string,
  violations: ContractViolation[],
): void {
  if (!Array.isArray(value)) {
    violations.push({
      path,
      message: `saw ${describeType(value)}, wanted an array of strings`,
    })
    return
  }
  for (let i = 0, { length } = value; i < length; i += 1) {
    if (typeof value[i] !== 'string') {
      violations.push({
        path: `${path}[${i}]`,
        message: `saw ${describeType(value[i])}, wanted a string`,
      })
    }
  }
}

// What / Where / Saw vs. wanted / Fix, with the per-violation detail as the
// saw-vs-wanted body.
export function contractError(
  what: string,
  where: string,
  violations: readonly ContractViolation[],
): Error {
  const body = violations
    .map(violation => `  - ${violation.path}: ${violation.message}`)
    .join('\n')
  return new Error(
    `${what}. Where: ${where}. Saw:\n${body}\nFix: correct the producer so the payload matches @socketsecurity/facts/contract, or coordinate a contract change with every consumer before emitting the new shape.`,
  )
}

export function describeType(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'an array'
  }
  return `a ${typeof value}`
}

export type ContractViolation = {
  // JSON pointer-ish path to the offending value, e.g. `components[3].name`.
  path: string
  // What was wrong, phrased saw-vs-wanted.
  message: string
}

export type ContractValidation<T> =
  | { ok: true; value: T }
  | { ok: false; violations: ContractViolation[] }

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
