// This file is largely copied / shared with anchor program repo

import "dotenv/config";

import { IdlEvents, BorshInstructionCoder, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
  PartiallyDecodedInstruction,
  ParsedInstruction,
  ConfirmedSignatureInfo,
} from "@solana/web3.js";
import { getMint, Mint } from "@solana/spl-token";

import { TiplinkEscrow, IDL } from "./anchor-generated/types/tiplink_escrow"; // This is different in anchor program repo
import { sleep } from "../helpers";

// TODO for Events
//  1. Differentiate between lamport / SPL
//  2. Add more helpful data
//  3. Convert to CPI event once client parsing utilities are available

export type DepositEvent = IdlEvents<TiplinkEscrow>["DepositEvent"];

export type WithdrawEvent = IdlEvents<TiplinkEscrow>["WithdrawEvent"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asDepositEvent(e: any): DepositEvent | undefined {
  try {
    if (
      e.name === "DepositEvent" &&
      e.data &&
      e.data.pda instanceof PublicKey &&
      e.data.depositor instanceof PublicKey &&
      e.data.tiplink instanceof PublicKey
    ) {
      return e.data;
    }
  } catch {
    // Do nothing
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asWithdrawEvent(e: any): WithdrawEvent | undefined {
  try {
    if (
      e.name === "WithdrawEvent" &&
      e.data &&
      e.data.pda instanceof PublicKey &&
      e.data.depositor instanceof PublicKey &&
      e.data.tiplink instanceof PublicKey
    ) {
      return e.data;
    }
  } catch {
    // Do nothing
  }
  return undefined;
}

export enum EscrowActionType {
  DepositLamport = "DepositLamport",
  WithdrawLamport = "WithdrawLamport",
  DepositSpl = "DepositSpl",
  WithdrawSpl = "WithdrawSpl",
}

export type EscrowActionDepositLamport = {
  type: EscrowActionType.DepositLamport;
  depositor: PublicKey;
  pda: PublicKey;
  receiverTipLink: PublicKey;
  amount: number;
};

export type EscrowActionWithdrawLamport = {
  type: EscrowActionType.WithdrawLamport;
  authority: PublicKey;
  destination: PublicKey;
  pda: PublicKey;
};

export type EscrowActionDepositSpl = {
  type: EscrowActionType.DepositSpl;
  depositor: PublicKey;
  pda: PublicKey;
  receiverTipLink: PublicKey;
  amount: number;
  mint: Mint;
};

export type EscrowActionWithdrawSpl = {
  type: EscrowActionType.WithdrawSpl;
  authority: PublicKey;
  destination: PublicKey;
  pda: PublicKey;
  mint: Mint;
};

export type EscrowAction =
  | EscrowActionDepositLamport
  | EscrowActionWithdrawLamport
  | EscrowActionDepositSpl
  | EscrowActionWithdrawSpl;

export async function interpretIx(
  connection: Connection,
  partiallyDecodedIx: PartiallyDecodedInstruction
): Promise<EscrowAction | undefined> {
  const coder = new BorshInstructionCoder(IDL);
  const ix = coder.decode(partiallyDecodedIx.data, "base58");

  if (!ix) {
    return undefined;
  }

  // TODO: Possibly get account indices from IDL

  if (ix.name === "initializeLamport") {
    const { amount } = ix.data as { amount: BN };
    return {
      type: EscrowActionType.DepositLamport,
      depositor: partiallyDecodedIx.accounts[0],
      pda: partiallyDecodedIx.accounts[1],
      receiverTipLink: partiallyDecodedIx.accounts[3],
      amount: amount.toNumber(),
    };
  }
  if (ix.name === "withdrawLamport") {
    return {
      type: EscrowActionType.WithdrawLamport,
      authority: partiallyDecodedIx.accounts[0],
      destination: partiallyDecodedIx.accounts[1],
      pda: partiallyDecodedIx.accounts[2],
    };
  }
  if (ix.name === "initializeSpl") {
    const { amount } = ix.data as { amount: BN };
    const mint = await getMint(connection, partiallyDecodedIx.accounts[6]);
    return {
      type: EscrowActionType.DepositSpl,
      depositor: partiallyDecodedIx.accounts[0],
      pda: partiallyDecodedIx.accounts[2],
      receiverTipLink: partiallyDecodedIx.accounts[5],
      amount: amount.toNumber(),
      mint,
    };
  }
  if (ix.name === "withdrawSpl") {
    const mint = await getMint(connection, partiallyDecodedIx.accounts[5]);
    return {
      type: EscrowActionType.WithdrawSpl,
      authority: partiallyDecodedIx.accounts[0],
      destination: partiallyDecodedIx.accounts[1],
      pda: partiallyDecodedIx.accounts[3],
      mint,
    };
  }

  throw new Error("Unknown escrow instruction");
}

export async function interpretTx(
  connection: Connection,
  sig: string
): Promise<(EscrowAction | undefined)[]> {
  const parsedTx = await connection.getParsedTransaction(sig, {
    maxSupportedTransactionVersion: 0,
  });
  if (!parsedTx || !parsedTx.meta || !parsedTx.meta.logMessages) {
    return [];
  }

  const { instructions } = parsedTx.transaction.message;
  const actions: (EscrowAction | undefined)[] = [];
  // Sequential to avoid jest issues: https://github.com/jestjs/jest/issues/11617
  for (const ix of instructions as (
    | ParsedInstruction
    | PartiallyDecodedInstruction
  )[]) {
    // Only handle PartiallyDecodedInstruction
    if (!("data" in ix)) {
      actions.push(undefined);
    } else {
      const action = await interpretIx(connection, ix);
      actions.push(action);
    }
  }
  return actions;
}

/**
 * @remarks This should be run on the backend and cached. If the escrow vault
 * gets spammed, this function will be slow. Once Anchor CPI events are fully
 * supported we will move to that.
 *
 * @param delay - Delay between RPC requests to avoid rate limiting
 */
export async function getAllEscrowActions(
  connection: Connection,
  pda: PublicKey,
  delayMs = 400
): Promise<EscrowAction[]> {
  // Limit set to 1,000
  const totalSigInfos: ConfirmedSignatureInfo[] = [];
  let sigInfos = await connection.getConfirmedSignaturesForAddress2(pda);
  while (sigInfos.length > 0) {
    totalSigInfos.push(...sigInfos);
    // eslint-disable-next-line no-await-in-loop
    sigInfos = await connection.getConfirmedSignaturesForAddress2(pda, {
      before: sigInfos[sigInfos.length - 1].signature,
    });
  }

  const sigs = totalSigInfos.map((sigInfo) => sigInfo.signature);

  const totalActions: EscrowAction[] = [];
  for (const sig of sigs) {
    // eslint-disable-next-line no-await-in-loop
    const actions = await interpretTx(connection, sig);
    for (const action of actions) {
      if (action) {
        totalActions.push(action);
      }
      await sleep(delayMs);
    }
  }

  return totalActions;
}
