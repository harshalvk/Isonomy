import type { Address, PrivateKeyHex, PublicKeyHex } from "@/core/types";

/**
 * A secp256k1 keypair. `privateKey` never leaves the wallet layer —
 * ledger/network code should only ever see `publicKey` and `Address`.
 */
export interface KeyPair {
  readonly privateKey: PrivateKeyHex;
  readonly publicKey: PublicKeyHex;
}

/**
 * A wallet account pairs a keypair with its derived address. Kept as a
 * separate type from `KeyPair` because address derivation is a pure
 * function of the public key — this shape makes that relationship
 * explicit rather than recomputing the address ad hoc wherever it's
 * needed.
 */
export interface WalletAccount {
  readonly keyPair: KeyPair;
  readonly address: Address;
}
