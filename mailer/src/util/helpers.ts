import { ComputeBudgetProgram, TransactionInstruction } from "@solana/web3.js";

export function getPriorityIxs(computeUnits: number): TransactionInstruction[] {
  const computeUnitPrice = 50000;

  return [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnits,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: computeUnitPrice,
    }),
  ];
}
