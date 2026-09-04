import { validateTransaction, type UtxoLookup } from "@/ledger/validate-transaction";
import type { Hash } from "@/core/types";
import type { OutPoint, Transaction, UTXO } from "@/ledger/transaction";

export type MempoolAddResult =
  { readonly accepted: true } | { readonly accepted: false; readonly reason: string };

function outPointKey(outPoint: OutPoint): string {
  return `${outPoint.txId}-${String(outPoint.outputIndex)}`;
}

export class Mempool {
  private readonly transactions = new Map<Hash, Transaction>();
  private readonly reservedOutPoints = new Set<string>();
  private readonly pendingUtxos = new Map<string, UTXO>();

  constructor(private readonly lookupCommittedUtxo: UtxoLookup) {}

  get size(): number {
    return this.transactions.size;
  }

  has(txId: Hash): boolean {
    return this.transactions.has(txId);
  }

  /* pending transactions, oldest first (no fee-baed ordering yet) */
  list(): readonly Transaction[] {
    return [...this.transactions.values()];
  }

  /* validates and admits a transaction, reserving the outpoints it spends */
  addTransaction(tx: Transaction): MempoolAddResult {
    if (this.transactions.has(tx.id)) {
      return { accepted: false, reason: "transaction already in mempool" };
    }

    for (const input of tx.inputs) {
      if (this.reservedOutPoints.has(outPointKey(input.outPoint))) {
        return {
          accepted: false,
          reason: `conflicts with a pending transaction spending ${outPointKey(input.outPoint)}`,
        };
      }
    }

    // sees both committed utxos and other pending transaction's outputs,
    // so chained pending this.transactions (B spends A's output) can validate.
    const lookup: UtxoLookup = (outPoint) => {
      const key = outPointKey(outPoint);
      return this.pendingUtxos.get(key) ?? this.lookupCommittedUtxo(outPoint);
    };

    const result = validateTransaction(tx, lookup);
    if (!result.valid) {
      return { accepted: false, reason: result.reason };
    }

    for (const input of tx.inputs) {
      this.reservedOutPoints.add(outPointKey(input.outPoint));
    }
    tx.outputs.forEach((output, index) => {
      const outPoint: OutPoint = { txId: tx.id, outputIndex: index };
      this.pendingUtxos.set(outPointKey(outPoint), { outPoint, output });
    });
    this.transactions.set(tx.id, tx);

    return { accepted: true };
  }

  // drops confirmed transactions (call after a block lands) and frees their reservations
  removeConfirmed(txIds: readonly Hash[]): void {
    for (const txId of txIds) {
      const tx = this.transactions.get(txId);
      if (!tx) continue;

      for (const input of tx.inputs) {
        this.reservedOutPoints.delete(outPointKey(input.outPoint));
      }
      tx.outputs.forEach((_, index) => {
        this.pendingUtxos.delete(outPointKey({ txId: tx.id, outputIndex: index }));
      });
      this.transactions.delete(txId);
    }
  }
}
