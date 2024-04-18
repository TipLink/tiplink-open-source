"use server";

import {
  TipLink,
  mail,
  mailEscrow,
  createReceiverTipLink,
  getReceiverEmail,
} from "@tiplink/api";
import { PublicKey } from "@solana/web3.js";

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
  receiverTipLinkPublicKey: string,
): Promise<string> {
  const receiverTipLink = new PublicKey(receiverTipLinkPublicKey);

  const receiverEmail = await getReceiverEmail(
    process.env.MAILER_API_KEY as string,
    receiverTipLink,
  );

  return receiverEmail;
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
  depositorUrl: string,
  receiverTipLinkPublicKey: string,
  toName?: string,
  replyEmail?: string,
  replyName?: string,
): Promise<void> {
  const receiverTipLink = new PublicKey(receiverTipLinkPublicKey);

  await mailEscrow({
    apiKey: process.env.MAILER_API_KEY as string,
    toEmail,
    depositorUrl: new URL(depositorUrl),
    receiverTipLink,
    toName,
    replyEmail,
    replyName,
  });
}
