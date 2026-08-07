import { validateTransaction, type UtxoLookup } from "@/ledger/validate-transaction";
import { buildBlock } from "@/ledger/build-block";
import { computeMerkleRoot } from "@/core/merkle";
import { asHash } from "@/core/types";
import type { Block } from "@/ledger/block";
import type { OutPoint, TransactionOutput, UTXO } from "@/ledger/transaction";

const GENESIS_PREVIOUS_HASH = asHash("0".repeat(64));
const GENESIS_TX_ID = asHash("genesis");

export type ChainAppendResult =
  { readonly accepted: true } | { readonly accepted: false; readonly reason: string };

function utxoKey(OutPoint: OutPoint): string {
  return `${OutPoint.txId}:${String(OutPoint.outputIndex)}`;
}

/** in-memory blockchain: an ordered block list plus the utxo set derived from it */
export class Chain {
  private readonly chainBlocks: Block[] = [];
  private readonly utxoSet = new Map<string, UTXO>();

  constructor(genesisAllocations: readonly TransactionOutput[]) {
    genesisAllocations.forEach((output, index) => {
      const outPoint: OutPoint = { txId: GENESIS_TX_ID, outputIndex: index };
      this.utxoSet.set(utxoKey(outPoint), { outPoint, output });
    });

    const genesis = buildBlock({
      previousHash: GENESIS_PREVIOUS_HASH,
      height: 0,
      transactions: [],
      timestamp: 0,
    });
    this.chainBlocks.push(genesis);
  }

  get blocks(): readonly Block[] {
    return this.chainBlocks;
  }

  get tip(): Block {
    return this.chainBlocks[this.chainBlocks.length - 1]!;
  }

  /** looks up a utxo against the chain's current (committed) state */
  lookupUtxo: UtxoLookup = (outPoint) => this.utxoSet.get(utxoKey(outPoint));

  /**
   * validates and appends a block. transactions apply sequentially against
   * a working utxo copy, so a tx may spend an output created earlier in
   * the same block. committed state only mutates once the whole block
   * passes - a rejected block leaves state untouched
   */
  appendBlock(block: Block): ChainAppendResult {
    if (block.header.previousHash !== this.tip.hash) {
      return { accepted: false, reason: "block does not extend the current tip" };
    }
    if (block.header.height !== this.tip.header.height + 1) {
      return { accepted: false, reason: "block height is not sequential" };
    }

    const expectedRoot = computeMerkleRoot(block.transactions.map((tx) => tx.id));
    if (expectedRoot !== block.header.merkleRoot) {
      return { accepted: false, reason: "merkle root does not match transactions" };
    }

    const workingSet = new Map(this.utxoSet);
    for (const tx of block.transactions) {
      const result = validateTransaction(tx, (outPoint) => workingSet.get(utxoKey(outPoint)));
      if (!result.valid) {
        return { accepted: false, reason: `invliad transaction ${tx.id}: ${result.reason}` };
      }

      for (const input of tx.inputs) {
        workingSet.delete(utxoKey(input.outPoint));
      }
      tx.outputs.forEach((output, index) => {
        const outPoint: OutPoint = { txId: tx.id, outputIndex: index };
        workingSet.set(utxoKey(outPoint), { outPoint, output });
      });
    }

    this.chainBlocks.push(block);
    this.utxoSet.clear();
    for (const [key, value] of workingSet) {
      this.utxoSet.set(key, value);
    }

    return { accepted: true };
  }
}
