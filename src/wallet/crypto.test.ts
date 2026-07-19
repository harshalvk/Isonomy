import { describe, expect, test } from "bun:test";
import {
  createWalletAccount,
  deriveAddress,
  generateKeyPair,
  hashMessage,
  signHash,
  verifyHash,
} from "@/wallet/crypto";

describe("generateKeyPair", () => {
  test("produces a private key and a compressed public key", () => {
    const keyPair = generateKeyPair();

    // 32-byte private key -> 64 hex chars
    expect(keyPair.privateKey).toHaveLength(64);
    // 33-byte compressed public key -> 66 hex chars
    expect(keyPair.publicKey).toHaveLength(66);
  });

  test("produces a different keypair on every call", () => {
    const first = generateKeyPair();
    const second = generateKeyPair();

    expect(first.privateKey).not.toBe(second.privateKey);
    expect(first.publicKey).not.toBe(second.publicKey);
  });
});

describe("deriveAddress", () => {
  test("is deterministic for the same public key", () => {
    const keyPair = generateKeyPair();

    const addressOne = deriveAddress(keyPair.publicKey);
    const addressTwo = deriveAddress(keyPair.publicKey);

    expect(addressOne).toBe(addressTwo);
  });

  test("produces different addresses for different public keys", () => {
    const keyPairA = generateKeyPair();
    const keyPairB = generateKeyPair();

    expect(deriveAddress(keyPairA.publicKey)).not.toBe(deriveAddress(keyPairB.publicKey));
  });

  test("is prefixed for readability", () => {
    const keyPair = generateKeyPair();
    const address = deriveAddress(keyPair.publicKey);

    expect(address.startsWith("iso1")).toBe(true);
  });
});

describe("createWalletAccount", () => {
  test("returns a keypair whose public key derives the returned address", () => {
    const account = createWalletAccount();

    expect(deriveAddress(account.keyPair.publicKey)).toBe(account.address);
  });
});

describe("signHash / verifyHash", () => {
  test("a valid signature verifies against the signer's public key", () => {
    const keyPair = generateKeyPair();
    const messageHash = hashMessage(new TextEncoder().encode("transfer 10 to iso1abc"));

    const signature = signHash(keyPair.privateKey, messageHash);

    expect(verifyHash(keyPair.publicKey, messageHash, signature)).toBe(true);
  });

  test("a signature does not verify against a different public key", () => {
    const signer = generateKeyPair();
    const impostor = generateKeyPair();
    const messageHash = hashMessage(new TextEncoder().encode("transfer 10 to iso1abc"));

    const signature = signHash(signer.privateKey, messageHash);

    expect(verifyHash(impostor.publicKey, messageHash, signature)).toBe(false);
  });

  test("a signature does not verify against a tampered message", () => {
    const keyPair = generateKeyPair();
    const originalHash = hashMessage(new TextEncoder().encode("transfer 10 to iso1abc"));
    const tamperedHash = hashMessage(new TextEncoder().encode("transfer 10000 to iso1abc"));

    const signature = signHash(keyPair.privateKey, originalHash);

    expect(verifyHash(keyPair.publicKey, tamperedHash, signature)).toBe(false);
  });

  test("verifyHash returns false rather than throwing on a malformed signature", () => {
    const keyPair = generateKeyPair();
    const messageHash = hashMessage(new TextEncoder().encode("transfer 10 to iso1abc"));
    const malformedSignature = "not-a-real-signature";

    expect(() =>
      verifyHash(keyPair.publicKey, messageHash, malformedSignature as never),
    ).not.toThrow();
    expect(verifyHash(keyPair.publicKey, messageHash, malformedSignature as never)).toBe(false);
  });
});
