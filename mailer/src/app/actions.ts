"use server";

import {
  mailEscrow,
  createReceiverTipLink,
  getReceiverEmail,
  EscrowTipLink,
  EscrowActionType,
  getRecordedEscrowActionsFromVault,
  RecordedEscrowAction,
} from "@tiplink/api";
import { PublicKey, Connection } from "@solana/web3.js";

const CONNECTION = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC as string,
  "confirmed",
);

export async function createReceiverTipLinkAction(
  toEmail: string,
): Promise<string> {
  const tiplink = await createReceiverTipLink(
    process.env.MAILER_API_KEY as string,
    toEmail,
  );
  return tiplink.toString();
}

export async function getReceiverEmailAction(
  pda: string,
): Promise<string | undefined> {
  const pdaPubKey = new PublicKey(pda);

  const escrowTipLink = await EscrowTipLink.get({
    connection: CONNECTION,
    pda: pdaPubKey,
    apiKey: process.env.MAILER_API_KEY as string,
  });

  if (escrowTipLink) {
    const email = await getReceiverEmail(
      process.env.MAILER_API_KEY as string,
      escrowTipLink.receiverTipLink,
    );

    return email;
  }

  // Escrow isn't live but might have been claimed. We'll check its history.
  const recordedActions = await getRecordedEscrowActionsFromVault(
    CONNECTION,
    pdaPubKey,
  );
  function isDeposit(
    action: RecordedEscrowAction,
  ): action is RecordedEscrowAction & {
    action: { receiverTipLink: PublicKey };
  } {
    return (
      action.action.type === EscrowActionType.DepositLamport ||
      action.action.type === EscrowActionType.DepositSpl
    );
  }
  const deposit = recordedActions.find(isDeposit);
  if (deposit) {
    const email = await getReceiverEmail(
      process.env.MAILER_API_KEY as string,
      deposit.action.receiverTipLink,
    );
    return email;
  }
  return undefined;
}

export async function mailEscrowAction(
  toEmail: string,
  pda: string,
  receiverTipLinkPublicKey: string,
  toName?: string,
  replyEmail?: string,
  replyName?: string,
): Promise<void> {
  const receiverTipLink = new PublicKey(receiverTipLinkPublicKey);

  await mailEscrow({
    apiKey: process.env.MAILER_API_KEY as string,
    toEmail,
    pda: new PublicKey(pda),
    receiverTipLink,
    toName,
    replyEmail,
    replyName,
  });
}
