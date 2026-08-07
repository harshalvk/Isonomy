import { describe, expect, test } from "bun:test";
import { createWalletAccount } from "@/wallet/crypto";
import { buildTransaction } from "@/ledger/build-transaction";
import { buildBlock } from "@/ledger/build-block";
import { Chain } from "@/ledger/chain";
import { asHash } from "@/core/types";

describe("Chain", () => {
  test("starts with a genesis block funding the given allocations", () => {
    const alice = createWalletAccount();
    const chain = new Chain([{ address: alice.address, amount: 100n }]);

    expect(chain.blocks).toHaveLength(1);
    expect(chain.tip.header.height).toBe(0);

    const utxo = chain.lookupUtxo({ txId: asHash("genesis"), outputIndex: 0 });
    expect(utxo?.output.amount).toBe(100n);
  });

  test("accepts a valid block extending the tip and updates the UTXO set", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const chain = new Chain([{ address: alice.address, amount: 100n }]);

    const fundingUtxo = chain.lookupUtxo({ txId: asHash("genesis"), outputIndex: 0 })!;
    const tx = buildTransaction({
      inputs: [{ utxo: fundingUtxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
    });
    const block = buildBlock({
      previousHash: chain.tip.hash,
      height: chain.tip.header.height + 1,
      transactions: [tx],
    });

    const result = chain.appendBlock(block);

    expect(result.accepted).toBe(true);
    expect(chain.blocks).toHaveLength(2);
    expect(chain.lookupUtxo(fundingUtxo.outPoint)).toBeUndefined();
    expect(chain.lookupUtxo({ txId: tx.id, outputIndex: 0 })?.output.amount).toBe(100n);
  });

  test("allows a transaction to spend an output created earlier in the same block", () => {
    const alice = createWalletAccount();
    const bob = createWalletAccount();
    const carol = createWalletAccount();
    const chain = new Chain([{ address: alice.address, amount: 100n }]);

    const fundingUtxo = chain.lookupUtxo({ txId: asHash("genesis"), outputIndex: 0 })!;
    const txOne = buildTransaction({
      inputs: [{ utxo: fundingUtxo, keyPair: alice.keyPair }],
      outputs: [{ address: bob.address, amount: 100n }],
      timestamp: 1,
    });
    const txTwo = buildTransaction({
      inputs: [
        {
          utxo: { outPoint: { txId: txOne.id, outputIndex: 0 }, output: txOne.outputs[0]! },
          keyPair: bob.keyPair,
        },
      ],
      outputs: [{ address: carol.address, amount: 100n }],
      timestamp: 2,
    });
    const block = buildBlock({
      previousHash: chain.tip.hash,
      height: 1,
      transactions: [txOne, txTwo],
    });

    const result = chain.appendBlock(block);

    expect(result.accepted).toBe(true);
    expect(chain.lookupUtxo({ txId: txTwo.id, outputIndex: 0 })?.output.amount).toBe(100n);
  });

  test("rejects a block that does not extend the current tip", () => {
    const alice = createWalletAccount();
    const chain = new Chain([{ address: alice.address, amount: 100n }]);

    const block = buildBlock({
      previousHash: asHash("not-the-tip".padEnd(64, "0")),
      height: 1,
      transactions: [],
    });

    const result = chain.appendBlock(block);

    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.reason).toContain("does not extend");
    }
  });

  test("rejects a block containing an invalid transaction, leaving state unchanged", () => {
    const alice = createWalletAccount();
    const mallory = createWalletAccount();
    const chain = new Chain([{ address: alice.address, amount: 100n }]);

    const fundingUtxo = chain.lookupUtxo({ txId: asHash("genesis"), outputIndex: 0 })!;
    const legitTx = buildTransaction({
      inputs: [{ utxo: fundingUtxo, keyPair: alice.keyPair }],
      outputs: [{ address: mallory.address, amount: 100n }],
    });
    const forgedTx = {
      ...legitTx,
      inputs: [{ ...legitTx.inputs[0]!, publicKey: mallory.keyPair.publicKey }],
    };
    const block = buildBlock({
      previousHash: chain.tip.hash,
      height: 1,
      transactions: [forgedTx],
    });

    const result = chain.appendBlock(block);

    expect(result.accepted).toBe(false);
    expect(chain.lookupUtxo(fundingUtxo.outPoint)?.output.amount).toBe(100n);
    expect(chain.blocks).toHaveLength(1);
  });
});
