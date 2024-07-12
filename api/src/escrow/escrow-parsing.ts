// This file is largely copied / shared with anchor program repo

import "dotenv/config";

import {
  IdlEvents,
  BorshInstructionCoder,
  BN,
  Instruction,
} from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
  ConfirmedSignatureInfo,
  MessageCompiledInstruction,
  CompiledInstruction,
} from "@solana/web3.js";
import { getMint, Mint } from "@solana/spl-token";

import { TiplinkEscrow, IDL } from "./anchor-generated/types/tiplink_escrow"; // This is different in anchor program repo
import { sleep } from "../helpers";
import { BACKEND_URL_BASE } from "./constants";

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

export type RecordedEscrowAction = {
  slot: number;
  blockTime: number | null | undefined;
  txSig: string;
  ixIndex: number;
  innerIxIndex?: number;
  action: EscrowAction;
};

export function serializeRecordedEscrowActions(
  recordedActions: RecordedEscrowAction[]
): any[] {
  return recordedActions.map((recordedAction) => {
    let serializedAction: any;

    switch (recordedAction.action.type) {
      case EscrowActionType.DepositLamport:
        serializedAction = {
          ...recordedAction,
          action: {
            ...recordedAction.action,
            pda: recordedAction.action.pda.toBase58(),
            depositor: recordedAction.action.depositor.toBase58(),
            receiverTipLink: recordedAction.action.receiverTipLink.toBase58(),
          },
        };
        break;

      case EscrowActionType.WithdrawLamport:
        serializedAction = {
          ...recordedAction,
          action: {
            ...recordedAction.action,
            pda: recordedAction.action.pda.toBase58(),
            authority: recordedAction.action.authority.toBase58(),
            destination: recordedAction.action.destination.toBase58(),
          },
        };
        break;

      case EscrowActionType.DepositSpl:
        serializedAction = {
          ...recordedAction,
          action: {
            ...recordedAction.action,
            pda: recordedAction.action.pda.toBase58(),
            depositor: recordedAction.action.depositor.toBase58(),
            receiverTipLink: recordedAction.action.receiverTipLink.toBase58(),
            mint: recordedAction.action.mint.address.toBase58(),
          },
        };
        break;

      case EscrowActionType.WithdrawSpl:
        serializedAction = {
          ...recordedAction,
          action: {
            ...recordedAction.action,
            pda: recordedAction.action.pda.toBase58(),
            authority: recordedAction.action.authority.toBase58(),
            destination: recordedAction.action.destination.toBase58(),
            mint: recordedAction.action.mint.address.toBase58(),
          },
        };
        break;

      default:
        throw new Error("Unknown action type");
    }

    return serializedAction;
  });
}

export async function deserializeRecordedEscrowActions(
  connection: Connection,
  serializedRecordedActions: any[]
): Promise<RecordedEscrowAction[]> {
  return Promise.all(
    serializedRecordedActions.map(async (serializedRecordedAction) => {
      if (
        serializedRecordedAction.action.type === EscrowActionType.DepositLamport
      ) {
        return {
          ...serializedRecordedAction,
          action: {
            ...serializedRecordedAction.action,
            pda: new PublicKey(serializedRecordedAction.action.pda),
            depositor: new PublicKey(serializedRecordedAction.action.depositor),
            receiverTipLink: new PublicKey(
              serializedRecordedAction.action.receiverTipLink
            ),
          },
        };
      }

      if (
        serializedRecordedAction.action.type ===
        EscrowActionType.WithdrawLamport
      ) {
        return {
          ...serializedRecordedAction,
          action: {
            ...serializedRecordedAction.action,
            pda: new PublicKey(serializedRecordedAction.action.pda),
            authority: new PublicKey(serializedRecordedAction.action.authority),
            destination: new PublicKey(
              serializedRecordedAction.action.destination
            ),
          },
        };
      }

      if (
        serializedRecordedAction.action.type === EscrowActionType.DepositSpl
      ) {
        // eslint-disable-next-line no-case-declarations
        const mint = await getMint(
          connection,
          new PublicKey(serializedRecordedAction.action.mint)
        );
        return {
          ...serializedRecordedAction,
          action: {
            ...serializedRecordedAction.action,
            pda: new PublicKey(serializedRecordedAction.action.pda),
            depositor: new PublicKey(serializedRecordedAction.action.depositor),
            receiverTipLink: new PublicKey(
              serializedRecordedAction.action.receiverTipLink
            ),
            mint,
          },
        };
      }

      if (
        serializedRecordedAction.action.type === EscrowActionType.WithdrawSpl
      ) {
        // eslint-disable-next-line no-case-declarations
        const mint = await getMint(
          connection,
          new PublicKey(serializedRecordedAction.action.mint)
        );
        return {
          ...serializedRecordedAction,
          action: {
            ...serializedRecordedAction.action,
            pda: new PublicKey(serializedRecordedAction.action.pda),
            authority: new PublicKey(serializedRecordedAction.action.authority),
            destination: new PublicKey(
              serializedRecordedAction.action.destination
            ),
            mint,
          },
        };
      }

      throw new Error("Unknown action type");
    })
  );
}

export async function parseEscrowIx(
  connection: Connection,
  compIx: MessageCompiledInstruction | CompiledInstruction,
  accountKeys: PublicKey[]
): Promise<EscrowAction | undefined> {
  const coder = new BorshInstructionCoder(IDL);
  let ix: Instruction | null;
  // CompiledInstruction uses a base58 string
  if (typeof compIx.data === "string") {
    ix = coder.decode(compIx.data, "base58");
    // MessageCompiledInstruction uses a Uint8Array
  } else {
    ix = coder.decode(Buffer.from(compIx.data), "base58");
  }

  if (!ix) {
    return undefined;
  }

  let keyIndices: number[];
  if ("accounts" in compIx) {
    keyIndices = compIx.accounts;
  } else {
    keyIndices = compIx.accountKeyIndexes;
  }

  // TODO: Get desired indices from IDL instead of magic numbers

  if (ix.name === "initializeLamport") {
    const { amount } = ix.data as { amount: BN };
    return {
      type: EscrowActionType.DepositLamport,
      depositor: accountKeys[keyIndices[0]],
      pda: accountKeys[keyIndices[1]],
      receiverTipLink: accountKeys[keyIndices[3]],
      amount: amount.toNumber(),
    };
  }
  if (ix.name === "withdrawLamport") {
    return {
      type: EscrowActionType.WithdrawLamport,
      authority: accountKeys[keyIndices[0]],
      destination: accountKeys[keyIndices[1]],
      pda: accountKeys[keyIndices[2]],
    };
  }
  if (ix.name === "initializeSpl") {
    const { amount } = ix.data as { amount: BN };
    const mint = await getMint(connection, accountKeys[keyIndices[6]]);
    return {
      type: EscrowActionType.DepositSpl,
      depositor: accountKeys[keyIndices[0]],
      pda: accountKeys[keyIndices[2]],
      receiverTipLink: accountKeys[keyIndices[5]],
      amount: amount.toNumber(),
      mint,
    };
  }
  if (ix.name === "withdrawSpl") {
    const mint = await getMint(connection, accountKeys[keyIndices[5]]);
    return {
      type: EscrowActionType.WithdrawSpl,
      authority: accountKeys[keyIndices[0]],
      destination: accountKeys[keyIndices[1]],
      pda: accountKeys[keyIndices[3]],
      mint,
    };
  }

  throw new Error("Unknown escrow instruction");
}

/**
 * @remarks Only use this on the backend for a custom parsing setup. Otherwise,
 * use `getRecordedEscrowActionsFromTx`
 */
export async function parseEscrowTx(
  connection: Connection,
  sig: string
): Promise<RecordedEscrowAction[]> {
  // Get transaction details
  const txRes = await connection.getTransaction(sig, {
    maxSupportedTransactionVersion: 1,
  });
  if (!txRes) {
    return [];
  }

  // Get slot
  const { slot } = txRes;
  const { blockTime } = txRes;

  // Get account keys
  const accountKeys = txRes.transaction.message.staticAccountKeys;
  const writeLutKeys =
    txRes.meta?.loadedAddresses?.writable.map((str) => new PublicKey(str)) ??
    [];
  const readLutKeys =
    txRes.meta?.loadedAddresses?.readonly.map((str) => new PublicKey(str)) ??
    [];
  // Writeable addresses come first
  accountKeys.push(...writeLutKeys, ...readLutKeys);
  const { compiledInstructions: outerIxs } = txRes.transaction.message;

  // Parse outer instructions
  const recordedActions: (RecordedEscrowAction | undefined)[] =
    await Promise.all(
      outerIxs.map(async (ix, index) => {
        const action = await parseEscrowIx(connection, ix, accountKeys);
        if (!action) {
          return undefined;
        }
        return {
          slot,
          blockTime,
          txSig: sig,
          ixIndex: index,
          action,
        };
      })
    );

  // Parse inner instructions
  const compiledInnerIxs = txRes.meta?.innerInstructions || [];
  const recordedInnerActions: (RecordedEscrowAction | undefined)[][] =
    await Promise.all(
      compiledInnerIxs.map(async (compInnerIx) => {
        const innerActions = await Promise.all(
          compInnerIx.instructions.map(async (innerIx, innerIndex) => {
            const action = await parseEscrowIx(
              connection,
              innerIx,
              accountKeys
            );
            if (!action) {
              return undefined;
            }
            return {
              slot,
              blockTime,
              txSig: sig,
              ixIndex: compInnerIx.index,
              innerIxIndex: innerIndex,
              action,
            };
          })
        );
        return innerActions;
      })
    );

  // Combine outer and inner actions
  recordedActions.push(...recordedInnerActions.flat());

  // Filter undefined
  const filteredRecordedActions = recordedActions.filter(
    (action): action is RecordedEscrowAction => action !== undefined
  );

  return filteredRecordedActions;
}

/**
 * @remarks Only use this on the backend for a custom parsing setup. Otherwise,
 * use `getRecordedEscrowActionsFromVault`
 * @param delay - Delay between RPC requests to avoid rate limiting
 */
export async function getAllRecordedEscrowActions(
  connection: Connection,
  pda: PublicKey,
  delayMs = 400
): Promise<RecordedEscrowAction[]> {
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

  const totalRecordedActions: RecordedEscrowAction[] = [];
  for (const sig of sigs) {
    // eslint-disable-next-line no-await-in-loop
    const recordedActions = await parseEscrowTx(connection, sig);
    totalRecordedActions.push(...recordedActions);
    // eslint-disable-next-line no-await-in-loop
    await sleep(delayMs);
  }

  // Sort by most recent
  totalRecordedActions.sort((a, b) => {
    // Try slot first
    if (a.slot !== b.slot) {
      return b.slot - a.slot;
    }
    // If in the same transaction (unlikely), sort by index
    if (a.txSig !== b.txSig) {
      return b.ixIndex - a.ixIndex;
    }
    // If in the same index (unlikely), sort by inner index
    if (a.innerIxIndex !== undefined && b.innerIxIndex !== undefined) {
      return b.innerIxIndex - a.innerIxIndex;
    }
    // Otherwise (unlikely), just return 0
    // It may be possible to see the order of transactions in a block but this is
    // overkill
    return 0;
  });

  return totalRecordedActions;
}

export async function getRecordedEscrowActionsFromVault(
  connection: Connection,
  pda: PublicKey
): Promise<RecordedEscrowAction[]> {
  const res = await fetch(
    `${BACKEND_URL_BASE}/api/v1/escrow/${pda.toBase58()}`
  );
  const json = await res.json();
  const { data } = json;
  const serializedRecordedActions = data.recordedEscrowActions;
  return deserializeRecordedEscrowActions(
    connection,
    serializedRecordedActions
  );
}

export async function getRecordedEscrowActionsFromTx(
  connection: Connection,
  sig: string
): Promise<RecordedEscrowAction[]> {
  const res = await fetch(`${BACKEND_URL_BASE}/api/v1/transaction/${sig}`);
  const json = await res.json();
  const { data } = json;
  const serializedRecordedActions = data.recordedEscrowActions;
  return deserializeRecordedEscrowActions(
    connection,
    serializedRecordedActions
  );
}
