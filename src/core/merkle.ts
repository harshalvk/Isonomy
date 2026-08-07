import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { asHash, type Hash } from "@/core/types";

/** merkel root of an empty transaction list */
const EMPTY_ROOT = asHash("0".repeat(64));

/** hashes two child nodes into their parent */
function combine(left: Hash, right: Hash): Hash {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  const combined = new Uint8Array(leftBytes.length + rightBytes.length);
  combined.set(leftBytes, 0);
  combined.set(rightBytes, leftBytes.length);
  return asHash(bytesToHex(sha256(combined)));
}

/** computes a merkle root over leaf hashes. odd levels duplicate the last node */
export function computeMerkleRoot(leaves: readonly Hash[]): Hash {
  if (leaves.length === 0) {
    return EMPTY_ROOT;
  }

  let level = [...leaves];
  while (level.length > 1) {
    const next: Hash[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;
      next.push(combine(left, right));
    }
    level = next;
  }

  return level[0]!;
}
