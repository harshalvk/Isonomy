import { describe, expect, test } from "bun:test";
import { createWalletAccount } from "@/wallet/crypto";
import { buildTransaction } from "@/ledger/build-transaction";
import { Mempool } from "@/ledger/mempool";
import { asHash } from "@/core/types";
import type { UTXO } from "@/ledger/transaction";

function fundedUtxo(address: ReturnType<typeof createWalletAccount>["address"]): UTXO {
  return {
    outPoint: { txId: asHash("genesis"), outputIndex: 0 },
    output: { address, amount: 100n },
  };
}

describe("Mempool", () => {
  test("accepts a valid transaction", () => {
    const harshal = createWalletAccount();
    const elon = createWalletAccount();
    const utxo = fundedUtxo(harshal.address);
    const mempool = new Mempool(() => utxo);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: harshal.keyPair }],
      outputs: [{ address: elon.address, amount: 100n }],
    });

    expect(mempool.addTransaction(tx)).toEqual({ accepted: true });
    expect(mempool.size).toBe(1);
    expect(mempool.has(tx.id)).toBe(true);
  });

  test("rejects a transaction spending an outpoint another pending transaction already spends", () => {
    const harshal = createWalletAccount();
    const elon = createWalletAccount();
    const mark = createWalletAccount();
    const utxo = fundedUtxo(harshal.address);
    const mempool = new Mempool(() => utxo);

    const txOne = buildTransaction({
      inputs: [{ utxo, keyPair: harshal.keyPair }],
      outputs: [{ address: elon.address, amount: 100n }],
      timestamp: 1,
    });
    const txTwo = buildTransaction({
      inputs: [{ utxo, keyPair: harshal.keyPair }],
      outputs: [{ address: mark.address, amount: 100n }],
      timestamp: 2,
    });

    expect(mempool.addTransaction(txOne)).toEqual({ accepted: true });
    const result = mempool.addTransaction(txTwo);
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.reason).toContain("conflicts with a pending transaction");
    }
  });

  test("accepts a chained pending transaction spending another pending transaction's output", () => {
    const harshal = createWalletAccount();
    const elon = createWalletAccount();
    const mark = createWalletAccount();
    const utxo = fundedUtxo(harshal.address);
    const mempool = new Mempool(() => utxo);
    const txOne = buildTransaction({
      inputs: [{ utxo, keyPair: harshal.keyPair }],
      outputs: [{ address: elon.address, amount: 100n }],
    });
    mempool.addTransaction(txOne);
    const txTwo = buildTransaction({
      inputs: [
        {
          utxo: { outPoint: { txId: txOne.id, outputIndex: 0 }, output: txOne.outputs[0]! },
          keyPair: elon.keyPair, // fixed: elon owns this output, not mark
        },
      ],
      outputs: [{ address: mark.address, amount: 100n }],
      timestamp: 2,
    });
    expect(mempool.addTransaction(txTwo)).toEqual({ accepted: true });
    expect(mempool.size).toBe(2);
  });

  test("rejects a duplicate submission of the same transaction", () => {
    const harshal = createWalletAccount();
    const elon = createWalletAccount();
    const utxo = fundedUtxo(harshal.address);
    const mempool = new Mempool(() => utxo);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: harshal.keyPair }],
      outputs: [{ address: elon.address, amount: 100n }],
    });

    mempool.addTransaction(tx);
    const result = mempool.addTransaction(tx);

    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.reason).toContain("already in mempool");
    }
  });

  test("removeConfirmed frees reservations so the spent outpoint stays gone but the mempool empties", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = fundedUtxo(alice.address);
    const mempool = new Mempool(() => utxo);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
    });
    mempool.addTransaction(tx);

    mempool.removeConfirmed([tx.id]);

    expect(mempool.size).toBe(0);
    expect(mempool.has(tx.id)).toBe(false);
  });
});
