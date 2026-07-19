import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  asAddress,
  asPrivateKeyHex,
  asPublicKeyHex,
  asSignatureHex,
  type Address,
  type PrivateKeyHex,
  type PublicKeyHex,
  type SignatureHex,
} from "@/core/types";
import type { KeyPair, WalletAccount } from "./types";

// humna-readable prefix so addresses are visually distinguishable from raw hashes
const ADDRESS_PREFIX = "iso1";

// number of bytes of the pubkey hash used for the address (160 bits, same as bitcoin's)
const ADDRESS_HASH_BYTES = 20;

// generates a new secp256k1 keypair
// `randomSecretKey`, never `Math.random()` or any other non-cryptographic
// source - private keys must be unpredicateble
export function generateKeyPair(): KeyPair {
  const secretKey = secp256k1.utils.randomSecretKey();
  const publicKey = secp256k1.getPublicKey(secretKey, true); // true = compressed (33 bytes)

  return {
    privateKey: asPrivateKeyHex(bytesToHex(secretKey)),
    publicKey: asPublicKeyHex(bytesToHex(publicKey)),
  };
}

// derives a wallet address from a public key: sha-256(pubkey), truncated
// to 20 bytes, prefixed for readability; one-way - an address can never be
// reversed back to the public key, only compared against one
export function deriveAddress(publicKey: PublicKeyHex): Address {
  const publicKeyBytes = hexToBytes(publicKey);
  const hashed = sha256(publicKeyBytes);
  const truncated = hashed.slice(0, ADDRESS_HASH_BYTES);

  return asAddress(`${ADDRESS_PREFIX}${bytesToHex(truncated)}`);
}

// convenicne wrapper: generates a keypari and derives its address in
// one call, producing a ready-to-use WalletAccount
export function createWalletAccount(): WalletAccount {
  const keyPair = generateKeyPair();

  return {
    keyPair,
    address: deriveAddress(keyPair.publicKey),
  };
}

// hashes an arbitrary message to the 32-byte digest that secp256k1
// signing/verification operates on. transactions sig over the has of
// their unsigned form, never the raw bytes directly
export function hashMessage(message: Uint8Array): Uint8Array {
  return sha256(message);
}

/**
 * signs a 32-byte message has with a private key, producing a compace
 * (64-bytes / 128 hex char) sig
 */
export function signHash(privateKey: PrivateKeyHex, messageHash: Uint8Array): SignatureHex {
  const signatureByes = secp256k1.sign(messageHash, hexToBytes(privateKey));

  return asSignatureHex(bytesToHex(signatureByes));
}

/**
 * verifies that `signature` over `messageHash` was produced by the
 * private key corresopnding to `publicKey`; returns `false` rather than
 * throwing on malformed input - callers doing transaction validation
 * should treat "invalid" and "malformed" identically(reject the tx),
 * not crach the validation pipeline
 */
export function verifyHash(
  pubkey: PublicKeyHex,
  messageHash: Uint8Array,
  signature: SignatureHex,
): boolean {
  try {
    return secp256k1.verify(hexToBytes(signature), messageHash, hexToBytes(pubkey));
  } catch {
    return false;
  }
}
