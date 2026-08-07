import { describe, expect, test } from "bun:test";
import { buildBlock } from "@/ledger/build-block";
import { asHash } from "@/core/types";

describe("buildBlock", () => {
  test("an empty block has the empty-list merkle root", () => {
    const block = buildBlock({
      previousHash: asHash("0".repeat(64)),
      height: 1,
      transactions: [],
      timestamp: 1_700_000_000_000,
    });

    expect(block.header.merkleRoot).toBe(asHash("0".repeat(64)));
  });

  test("hash changes when previousHash changes", () => {
    const blockA = buildBlock({
      previousHash: asHash("a".repeat(64)),
      height: 1,
      transactions: [],
      timestamp: 1_700_000_000_000,
    });
    const blockB = buildBlock({
      previousHash: asHash("b".repeat(64)),
      height: 1,
      transactions: [],
      timestamp: 1_700_000_000_000,
    });

    expect(blockA.hash).not.toBe(blockB.hash);
  });

  test("hash is deterministic for identical params", () => {
    const params = {
      previousHash: asHash("a".repeat(64)),
      height: 1,
      transactions: [],
      timestamp: 1_700_000_000_000,
    };

    expect(buildBlock(params).hash).toBe(buildBlock(params).hash);
  });
});
