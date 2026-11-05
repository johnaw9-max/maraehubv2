// Minimal local assertions (std/assert is not reachable from this sandbox).
export function assert(cond: unknown, msg = 'assertion failed'): asserts cond { if (!cond) throw new Error(msg); }
export function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
