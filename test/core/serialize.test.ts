import { describe, expect, test } from "bun:test";
import { canonicalBytes } from "@/core/serialize";

function toText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("canonicalBytes", () => {
  test("produces identical output regardless of object key construction order", () => {
    const a = { alpha: 1, beta: 2 };
    const b = { beta: 2, alpha: 1 };

    expect(toText(canonicalBytes(a))).toBe(toText(canonicalBytes(b)));
  });

  test("preserves array order (order is semantically meaningful for arrays)", () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };

    expect(toText(canonicalBytes(a))).not.toBe(toText(canonicalBytes(b)));
  });

  test("serializes bigint as a string rather than throwing", () => {
    const value = { amount: 100n };

    expect(() => canonicalBytes(value)).not.toThrow();
    expect(toText(canonicalBytes(value))).toContain("100");
  });

  test("nested objects are canonicalized recursively", () => {
    const a = { outer: { z: 1, a: 2 } };
    const b = { outer: { a: 2, z: 1 } };

    expect(toText(canonicalBytes(a))).toBe(toText(canonicalBytes(b)));
  });

  test("different data produces different bytes", () => {
    const a = { amount: 100n };
    const b = { amount: 101n };

    expect(toText(canonicalBytes(a))).not.toBe(toText(canonicalBytes(b)));
  });
});
