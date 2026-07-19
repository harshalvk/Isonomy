import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { asHash, type Hash } from "@/core/types";
import { canonicalBytes } from "@/core/serialize";
import { deriveAddress, signHash } from "@/wallet/crypto";
import type { KeyPair } from "@/wallet/types";
import type {
  OutPoint,
  Transaction,
  TransactionInput,
  TransactionOutput,
  UTXO,
} from "@/ledger/transaction";

/**
 * a utxo paired with the keyPari that owns it - required to sign for spending it.
 */
export interface SpendableUtxo {
  readonly utxo: UTXO;
  readonly keyPair: KeyPair;
}

export interface BuildTransactionParams {
  readonly inputs: readonly SpendableUtxo[];
  readonly outputs: readonly TransactionOutput[];
  // deafults to Date.now(); overrriabled for deterministic tests
  readonly timestamp?: number;
}

/**
 * the part fo a transaction that gets hashed to produce both the
 * transaction id and the message each input signs. deliberately exclues
 * `publicKey` / `signature` from the inputs - including a signature in the
 * data it sigsns is circular, and letting the id depend on signature
 * would mean two byte-different signature over the same economic
 * transaction produce two different ids (malleability)
 * the id is therefore a pure function of *what* is being spent and *where it's going*, never of the proof that authorized it
 */
export function computeCoreHash(
  outPoints: readonly OutPoint[],
  outputs: readonly TransactionOutput[],
  timestamp: number,
): Uint8Array {
  return sha256(canonicalBytes({ outPoints, outputs, timestamp }));
}

/**
 * Assembles and signs a transaction spending `inputs` to `outputs`.
 *
 * Two invariants are enforced here rather than left to the caller:
 * 1. Each supplied keypair must actually own the UTXO it's spending
 *    (its derived address must match the UTXO's address) — signing with
 *    a keypair that doesn't own the output it claims to spend would
 *    produce a transaction that fails validation anyway, so we fail
 *    fast with a clear error instead of a confusing downstream rejection.
 * 2. Total input value must exactly equal total output value — this
 *    build has no implicit fee/burn. If you want a fee, add a
 *    fee-collector output explicitly; if there's leftover value, add a
 *    change output back to the sender. Silent value destruction is not
 *    an option in a ledger.
 */

export function buildTransaction(params: BuildTransactionParams): Transaction {
  if (params.inputs.length === 0) {
    throw new Error("cannot build a transaction with no inputs");
  }
  if (params.outputs.length === 0) {
    throw new Error("cannot build a transaction with no outputs");
  }

  for (const { utxo, keyPair } of params.inputs) {
    const owner = deriveAddress(keyPair.publicKey);
    if (owner !== utxo.output.address) {
      throw new Error(
        `keypair does not own utxo ${utxo.outPoint.txId}: ${utxo.outPoint.outputIndex}`,
      );
    }
  }

  const totalInput = params.inputs.reduce((sum, { utxo }) => sum + utxo.output.amount, 0n);
  const totalOutput = params.outputs.reduce((sum, output) => sum + output.amount, 0n);
  if (totalInput !== totalOutput) {
    throw new Error(
      `input total (${totalInput.toString()}) does not equal output total (${totalOutput.toString()})`,
    );
  }

  const timestamp = params.timestamp ?? Date.now();
  const outPoints = params.inputs.map(({ utxo }) => utxo.outPoint);
  const coreHash = computeCoreHash(outPoints, params.outputs, timestamp);
  const id: Hash = asHash(bytesToHex(coreHash));

  const inputs: TransactionInput[] = params.inputs.map(({ utxo, keyPair }) => ({
    outPoint: utxo.outPoint,
    publicKey: keyPair.publicKey,
    signature: signHash(keyPair.privateKey, coreHash),
  }));

  return {
    id,
    inputs,
    outputs: params.outputs,
    timestamp,
  };
}
