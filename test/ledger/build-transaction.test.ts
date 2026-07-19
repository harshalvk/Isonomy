import { describe, expect, test } from "bun:test";
import { createWalletAccount } from "@/wallet/crypto";
import { buildTransaction } from "@/ledger/build-transaction";
import { asHash } from "@/core/types";
import type { UTXO } from "@/ledger/transaction";

function makeFundingUtxo(ownerAddress: ReturnType<typeof createWalletAccount>["address"]): UTXO {
  return {
    outPoint: { txId: asHash("genesis"), outputIndex: 0 },
    output: { address: ownerAddress, amount: 100n },
  };
}

describe("buildTransaction", () => {
  test("produces a transaction whose id is deterministic for identical inputs", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    const params = {
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
      timestamp: 1_700_000_000_000,
    };

    const txOne = buildTransaction(params);
    const txTwo = buildTransaction(params);

    expect(txOne.id).toBe(txTwo.id);
  });

  test("splits value across multiple outputs (payment + change)", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    const tx = buildTransaction({
      inputs: [{ utxo, keyPair: alice.keyPair }],
      outputs: [
        { address: bob.address, amount: 40n },
        { address: alice.address, amount: 60n },
      ],
    });

    expect(tx.outputs).toHaveLength(2);
    expect(tx.inputs).toHaveLength(1);
  });

  test("throws when a keypair does not own the UTXO it claims to spend", () => {
    const alice = createWalletAccount();
    const mallory = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    expect(() =>
      buildTransaction({
        inputs: [{ utxo, keyPair: mallory.keyPair }],
        outputs: [{ address: mallory.address, amount: 100n }],
      }),
    ).toThrow(/does not own/);
  });

  test("throws when input total does not equal output total", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    expect(() =>
      buildTransaction({
        inputs: [{ utxo, keyPair: alice.keyPair }],
        outputs: [{ address: bob.address, amount: 999n }],
      }),
    ).toThrow(/does not equal/);
  });

  test("throws when given no inputs", () => {
    const bob = createWalletAccount();

    expect(() =>
      buildTransaction({
        inputs: [],
        outputs: [{ address: bob.address, amount: 1n }],
      }),
    ).toThrow(/no inputs/);
  });

  test("throws when given no outputs", () => {
    const alice = createWalletAccount();
    const utxo = makeFundingUtxo(alice.address);

    expect(() =>
      buildTransaction({
        inputs: [{ utxo, keyPair: alice.keyPair }],
        outputs: [],
      }),
    ).toThrow(/no outputs/);
  });
});
