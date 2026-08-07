import { sha256 } from "@noble/hashes/sha2.js";
import { asHash, type Hash } from "@/core/types";
import type { Transaction } from "./transaction";
import type { Block, BlockHeader } from "./block";
import { bytesToHex } from "@noble/curves/utils.js";
import { canonicalBytes } from "@/core/serialize";
import { computeMerkleRoot } from "@/core/merkle";

export interface BuildBlockParams {
  readonly previousHash: Hash;
  readonly height: number;
  readonly transactions: readonly Transaction[];
  readonly timestamp?: number;
}

/** build a block: computes its merkle root, then hashes the header */
export function buildBlock(params: BuildBlockParams): Block {
  const timestamp = params.timestamp ?? Date.now();
  const merkleRoot = computeMerkleRoot(params.transactions.map((tx) => tx.id));

  const header: BlockHeader = {
    previousHash: params.previousHash,
    merkleRoot,
    timestamp,
    height: params.height,
  };

  const hash = asHash(bytesToHex(sha256(canonicalBytes(header))));

  return { header, hash, transactions: params.transactions };
}
