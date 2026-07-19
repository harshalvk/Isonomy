import type { Address, Amount, Hash, PublicKeyHex, SignatureHex } from "@/core/types";

/**
 * A reference to a specific output of a previous transaction.
 * (txId, outputIndex) is the unique key for a UTXO.
 */
export interface OutPoint {
  readonly txId: Hash;
  readonly outputIndex: number;
}

/**
 * Consumes a previously unspent output. The signature proves ownership of
 * the referenced output's address without ever exposing the private key —
 * it signs over the unsigned transaction body (see UnsignedTransaction).
 */
export interface TransactionInput {
  readonly outPoint: OutPoint;
  readonly publicKey: PublicKeyHex;
  readonly signature: SignatureHex;
}

/**
 * Creates a new spendable UTXO, assigning `amount` to `address`.
 */
export interface TransactionOutput {
  readonly address: Address;
  readonly amount: Amount;
}

/**
 * The payload that gets hashed to produce each input's signing message.
 * Deliberately excludes `id`, since the id is *derived* from these
 * contents — a transaction can't sign over its own hash.
 */
export interface UnsignedTransaction {
  readonly inputs: readonly TransactionInput[];
  readonly outputs: readonly TransactionOutput[];
  readonly timestamp: number;
}

/**
 * A fully-formed, content-addressed transaction.
 */
export interface Transaction extends UnsignedTransaction {
  readonly id: Hash;
}

/**
 * An output as tracked in the ledger's live UTXO set: it exists and has
 * not yet been consumed by any input. Once spent, it's removed from the
 * set entirely rather than marked — the UTXO set only ever holds spendable
 * outputs.
 */
export interface UTXO {
  readonly outPoint: OutPoint;
  readonly output: TransactionOutput;
}
