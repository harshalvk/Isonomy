import { describe, expect, test } from "bun:test";
import { createWalletAccount } from "@/wallet/crypto";
import { buildTransaction } from "@/ledger/build-transaction";
import { validateTransaction, type UtxoLookup } from "@/ledger/validate-transaction";
import { asHash } from "@/core/types";
import type { UTXO } from "@/ledger/transaction";

function makeFundingUtxo(ownerAddress: ReturnType<typeof createWalletAccount>["address"]): UTXO {
  return {
    outPoint: { txId: asHash("genesis"), outputIndex: 0 },
    output: { address: ownerAddress, amount: 100n },
  };
}

function lookupFrom(...utxos: UTXO[]): UtxoLookup {
  const map = new Map<string, UTXO>();
  for (const utxo of utxos) {
    map.set(`${utxo.outPoint.txId}:${String(utxo.outPoint.outputIndex)}`, utxo);
  }
  return (outPoint) => map.get(`${outPoint.txId}:${String(outPoint.outputIndex)}`);
}

describe("validateTransaction", () => {
  test("accepts a correctly built transaction", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
    });

    expect(validateTransaction(tx, lookupFrom(utxo))).toEqual({ valid: true });
  });

  test("rejects a transaction whose id has been swapped to hide a tampered amount", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
    });
    const tampered = { ...tx, outputs: [{ address: bob.address, amount: 100_000n }] };

    const result = validateTransaction(tampered, lookupFrom(utxo));

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("id does not match");
    }
  });

  test("rejects a transaction referencing a UTXO that isn't in the lookup set", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
    });

    // note: empty lookup — the UTXO the tx spends is not registered as unspent
    const result = validateTransaction(tx, lookupFrom());

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("not found");
    }
  });

  test("rejects a transaction with a duplicated input outpoint", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
    });
    const forged = { ...tx, inputs: [tx.inputs[0]!, tx.inputs[0]!] };

    const result = validateTransaction(forged, lookupFrom(utxo));

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("duplicate input");
    }
  });

  test("rejects a transaction where the public key does not match the UTXO owner", () => {
    const alice = createWalletAccount();
    const mallory = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
    });
    // forge the input to claim mallory's public key spent alice's utxo
    const forged = {
      ...tx,
      inputs: [{ ...tx.inputs[0]!, publicKey: mallory.keyPair.publicKey }],
    };

    const result = validateTransaction(forged, lookupFrom(utxo));

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("does not match utxo owner");
    }
  });

  test("rejects a transaction with an invalid signature", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
    });
    const otherTx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
      timestamp: (tx.timestamp ?? 0) + 1,
    });
    // splice in a signature that's valid for a *different* transaction
    const forged = {
      ...tx,
      inputs: [{ ...tx.inputs[0]!, signature: otherTx.inputs[0]!.signature }],
    };

    const result = validateTransaction(forged, lookupFrom(utxo));

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("invalid signature");
    }
  });

  test("rejects a transaction with no inputs", () => {
    const bob = createWalletAccount();
    const forged = {
      id: asHash("fake"),
      inputs: [],
      outputs: [{ address: bob.address, amount: 1n }],
      timestamp: Date.now(),
    };

    const result = validateTransaction(forged, lookupFrom());

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("no inputs");
    }
  });
});
