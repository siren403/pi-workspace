export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertIncludes<T>(items: T[], expected: T, label: string): void {
  assert(items.includes(expected), `${label}: expected ${String(expected)} in ${items.map(String).join(", ")}`);
}

export function assertNotIncludes<T>(items: T[], expected: T, label: string): void {
  assert(!items.includes(expected), `${label}: did not expect ${String(expected)} in ${items.map(String).join(", ")}`);
}

export function assertEqual<T>(actual: T, expected: T, label: string): void {
  assert(actual === expected, `${label}: expected ${String(expected)}, got ${String(actual)}`);
}
