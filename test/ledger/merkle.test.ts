import { describe, expect, test } from "bun:test";
import { asHash } from "@/core/types";
import { computeMerkleRoot } from "@/core/merkle";

describe("computeMerkleRoot", () => {
  test("empty list returns the zero hash", () => {
    expect(computeMerkleRoot([])).toBe(asHash("0".repeat(64)));
  });

  test("single leaf returns that leaf unchanged", () => {
    const leaf = asHash("a".repeat(64));
    expect(computeMerkleRoot([leaf])).toBe(leaf);
  });

  test("is deterministic for the same leaves in the same order", () => {
    const leaves = [asHash("a".repeat(64)), asHash("b".repeat(64)), asHash("c".repeat(64))];
    expect(computeMerkleRoot(leaves)).toBe(computeMerkleRoot(leaves));
  });

  test("leaf order affects the root", () => {
    const a = asHash("a".repeat(64));
    const b = asHash("b".repeat(64));
    expect(computeMerkleRoot([a, b])).not.toBe(computeMerkleRoot([b, a]));
  });

  test("handles odd leaf counts", () => {
    const leaves = [asHash("a".repeat(64)), asHash("b".repeat(64)), asHash("c".repeat(64))];
    expect(() => computeMerkleRoot(leaves)).not.toThrow();
  });
});
