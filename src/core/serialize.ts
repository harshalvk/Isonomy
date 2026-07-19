/**
 * recursively converts a value into a canoncial, json-serializable shape:
 * - `bigint` (ouut `Amount` type) becomes a string, since `JSON.stringify` throws a raw bigint
 * - object keys are sorted alphabetically, so two objects with idential
 * data but different construction order still serialize identically
 * - array order is preserved as-is - order is semantically meaningful
 * for arrays (e.g. transaction input order) in a way it isn't for object keys
 */
function canonicalize(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const result: Record<string, unknown> = {};

    for (const key of sortedKeys) {
      result[key] = canonicalize(record[key]);
    }
    return result;
  }

  return value;
}

/**
 * serializes a vlaue to a deterministic byte sequence, suitable as input
 * to a hash funciton. two calls with structurally identical data
 * (same keys/values, any construction order) always produce idential bytes — this is the property a content-addressed
 * system (transaction ids, block hashes) depends on
 */
export function canonicalBytes(value: unknown): Uint8Array {
  const json = JSON.stringify(canonicalize(value));

  return new TextEncoder().encode(json);
}
