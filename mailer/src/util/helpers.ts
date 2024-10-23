import {
  ComputeBudgetProgram,
  Transaction,
  Connection,
  SignatureStatus,
} from "@solana/web3.js";

import {
  DEFAULT_COMPUTE_UNIT_PRICE,
  DEFAULT_COMPUTE_UNIT_LIMIT,
} from "./constants";

export function getPriorityFeesLamports(
  computeUnitPrice = DEFAULT_COMPUTE_UNIT_PRICE,
  computeUnitLimit = DEFAULT_COMPUTE_UNIT_LIMIT,
): number {
  return (computeUnitPrice * computeUnitLimit) / 1_000_000;
}

export function insertPriorityFeesIxs(
  tx: Transaction,
  computeUnitPrice = DEFAULT_COMPUTE_UNIT_PRICE,
  computeUnitLimit = DEFAULT_COMPUTE_UNIT_LIMIT,
): void {
  const ixs = [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: computeUnitPrice,
    }),
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnitLimit,
    }),
  ];

  tx.instructions.unshift(...ixs);
}

export async function isConnected(connection: Connection): Promise<boolean> {
  try {
    const version = await connection.getVersion();
    console.log("Connected to cluster, version:", version["solana-core"]);
    return true;
  } catch (err) {
    console.error("Failed to connect to cluster:", err);
    return false;
  }
}
