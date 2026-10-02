// A lookup in a fixed table by a key that may come from user text. `TABLE[key]` would also find
// the object's inherited members, so text like "constructor" or "toString" would return a
// function instead of falling back. Only the table's own entries count here.
export function own<T>(table: Readonly<Record<string, T>>, key: unknown): T | undefined {
  return typeof key === "string" && Object.hasOwn(table, key) ? table[key] : undefined;
}
