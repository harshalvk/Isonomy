import { bytesToHex } from "@noble/hashes/utils.js";
import { asHash } from "@/core/types";
import { deriveAddress, verifyHash } from "@/wallet/crypto";
import { computeCoreHash } from "@/ledger/build-transaction";
import type { OutPoint, Transaction, UTXO } from "@/ledger/transaction";

export type TransactionValidationResult =
  { readonly valid: true } | { readonly valid: false; readonly reason: string };

/**
 * Looks up whether an outpoint is currently unspent. Passed in rather
 * than baked in as a direct dependency on a concrete UTXO-set
 * implementation — Phase 1 doesn't have persistent storage yet (that's
 * Phase 3), so this keeps validation testable against a plain in-memory
 * Map today and swappable for a real UTXO store later without touching
 * this function.
 */

export type UtxoLookup = (outPoint: OutPoint) => UTXO | undefined;

function outPointKey(outPoint: OutPoint): string {
  return `${outPoint.txId}:${String(outPoint.outputIndex)}`;
}

/**
 * Validates a transaction against the current UTXO set. Returns a
 * result object rather than throwing — transaction validation in a
 * mempool/consensus context is a query ("is this acceptable?"), not an
 * exceptional control flow, and callers need the specific rejection
 * reason to log or relay back to the submitter.
 *
 * Checks, in order (cheapest / most obviously-wrong first):
 * 1. Structural sanity — has inputs, has outputs.
 * 2. No duplicate outpoints within the transaction itself.
 * 3. The `id` field matches what its contents actually hash to — the
 *    `id` on an incoming transaction is untrusted wire data and must
 *    never be taken at face value.
 * 4. Every input references a UTXO that actually exists (rejects
 *    double-spends of already-consumed outputs and outright fabricated
 *    references).
 * 5. Every input's public key actually derives the address that owns
 *    the UTXO it claims to spend — without this check, a valid
 *    signature from *any* keypair would pass, since a signature alone
 *    only proves "the signer knows some private key," not "the signer
 *    owns this specific output."
 * 6. Every input's signature verifies against the transaction's core
 *    hash.
 * 7. Total input value equals total output value.
 */
export function validateTransaction(
  transaction: Transaction,
  lookupUtxo: UtxoLookup,
): TransactionValidationResult {
  if (transaction.inputs.length === 0) {
    return {
      valid: false,
      reason: "transaction has no inputs",
    };
  }
  if (transaction.outputs.length === 0) {
    return {
      valid: false,
      reason: "transaction has no outputs",
    };
  }

  const outPoints = transaction.inputs.map((input) => input.outPoint);

  const seenOutPoints = new Set<string>();
  for (const outPoint of outPoints) {
    const key = outPointKey(outPoint);
    if (seenOutPoints.has(key)) {
      return { valid: false, reason: `duplicate input outpoint: ${key}` };
    }
    seenOutPoints.add(key);
  }

  const coreHash = computeCoreHash(outPoints, transaction.outputs, transaction.timestamp);
  const recomputedId = asHash(bytesToHex(coreHash));
  if (recomputedId !== transaction.id) {
    return { valid: false, reason: "transaction id does not match its contents" };
  }

  let totalInput = 0n;
  for (const input of transaction.inputs) {
    const utxo = lookupUtxo(input.outPoint);
    if (!utxo) {
      return {
        valid: false,
        reason: `referenced utxo not found or already spent: ${outPointKey(input.outPoint)}`,
      };
    }

    const claimedOwner = deriveAddress(input.publicKey);
    if (claimedOwner !== utxo.output.address) {
      return {
        valid: false,
        reason: `public key does not match utxo owner for ${outPointKey(input.outPoint)}`,
      };
    }

    if (!verifyHash(input.publicKey, coreHash, input.signature)) {
      return {
        valid: false,
        reason: `invalid signature for input ${outPointKey(input.outPoint)}`,
      };
    }

    totalInput += utxo.output.amount;
  }

  const totalOutput = transaction.outputs.reduce((sum, output) => sum + output.amount, 0n);
  if (totalInput !== totalInput) {
    return {
      valid: false,
      reason: `input total (${totalInput.toString()}) does not equal output total (${totalOutput.toString()})`,
    };
  }

  return { valid: true };
}
