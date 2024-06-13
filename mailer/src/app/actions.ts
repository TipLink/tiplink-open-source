"use server";

import {
  TipLink,
  mail,
  mailEscrow,
  createReceiverTipLink,
  getReceiverEmail,
  EscrowTipLink,
  getAllRecordedEscrowActions,
  EscrowActionType,
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

  // The following function might take a while if the PDA has been spammed with
  // transactions that it needs to sift through. We recommend running this on a
  // backend and cache-ing the result.
  const recordedActions = await getAllRecordedEscrowActions(
    CONNECTION,
    pdaPubKey,
  );
  // eslint-disable-next-line no-restricted-syntax
  for (const recordedAction of recordedActions) {
    if (
      recordedAction.action.type === EscrowActionType.DepositLamport ||
      recordedAction.action.type === EscrowActionType.DepositSpl
    ) {
      // eslint-disable-next-line no-await-in-loop
      const email = await getReceiverEmail(
        process.env.MAILER_API_KEY as string,
        recordedAction.action.receiverTipLink,
      );
      return email;
    }
  }

  return undefined;
}

export async function mailAction(
  tipLinkUrl: string,
  toEmail: string,
  toName?: string,
  replyEmail?: string,
  replyName?: string,
): Promise<void> {
  const tipLink = await TipLink.fromLink(tipLinkUrl);

  await mail(
    process.env.MAILER_API_KEY as string,
    tipLink,
    toEmail,
    toName,
    replyEmail,
    replyName,
  );
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
