import type { Hash } from "@/core/types";
import type { Transaction } from "@/ledger/transaction";

/**
  the signed/hashed portion of a block. Kept separate from the full
  `Block` because peers can gossip and validate headers (e.g. for
  light-client / fast-sync scenarios in later phases) before fetching
 * the full transaction list.
 */
export interface BlockHeader {
  readonly previousHash: Hash;
  readonly merkleRoot: Hash;
  readonly timestamp: number;
  readonly height: number;
}

/**
 * A block is content-addressed by `hash`, which is computed over the
 * header (not the transactions directly — that's what `merkleRoot` is
 * for). `hash` is stored rather than always recomputed so that chain
 * traversal (block -> previousHash lookup) doesn't repeatedly re-hash.
 */
export interface Block {
  readonly header: BlockHeader;
  readonly hash: Hash;
  readonly transactions: readonly Transaction[];
}
