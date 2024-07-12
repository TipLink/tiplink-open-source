import { PublicKey } from "@solana/web3.js";

import { EscrowTipLink, TipLink } from ".";
import { isEmailValid } from "./email";
import { BACKEND_URL_BASE } from "./escrow/constants";

const DEFAULT_ENCLAVE_ENDPOINT = "https://mailer.tiplink.io";
const ENCLAVE_ENDPOINT =
  process !== undefined && process.env !== undefined
    ? process.env.NEXT_PUBLIC_ENCLAVE_ENDPOINT_OVERRIDE ??
      DEFAULT_ENCLAVE_ENDPOINT
    : DEFAULT_ENCLAVE_ENDPOINT;

/**
 * Asynchronously calls secure enclave to create a TipLink, store it with an associated email, and return its public key.
 *
 * @param apiKey - The API key to be used for the request.
 * @param email - The email address to be associated with the receiver tiplink.
 * @returns A promise that resolves to the PublicKey of the receiver tiplink.
 * @throws Throws an error if the HTTPS request fails with a non-ok status.
 */
export async function createReceiverTipLink(
  apiKey: string,
  email: string
): Promise<PublicKey> {
  if (!(await isEmailValid(email))) {
    throw new Error("Invalid email address");
  }

  const endpoint = `${ENCLAVE_ENDPOINT}/api/v1/generated-tiplinks/create`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`HTTP error, status: ${res.status}`);
  }

  interface ResBody {
    data: {
      publicKey: string;
    };
  }
  const {
    data: { publicKey: publicKeyStr },
  }: ResBody = await res.json();

  return new PublicKey(publicKeyStr);
}

/**
 * Asynchronously calls secure enclave to retrieve the email associated with a receiver TipLink.
 *
 * @param apiKey - The API key to be used for the request.
 * @param publicKey - The public key of the TipLink for which to retrieve the associated email.
 * @returns A promise that resolves to the email address associated with the provided TipLink public key.
 * @throws Throws an error if the HTTPS request fails with a non-ok status.
 */
export async function getReceiverEmail(
  apiKey: string,
  publicKey: PublicKey
): Promise<string> {
  // We actually no longer hit the enclave here but we'll keep in this file
  // since the enclave manages this data.
  const endpoint = `${BACKEND_URL_BASE}/api/v1/generated-tiplinks/${publicKey.toString()}/email`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP error, status: ${res.status}`);
  }

  interface ResBody {
    data: {
      email: string;
    };
  }
  const {
    data: { email },
  }: ResBody = await res.json();

  return email;
}

/**
 * @deprecated We are sunsetting this feature and will only be supporting
 * emailiing EscrowTipLinks. We recommend not using this feature.
 *
 * Asynchronously emails a TipLink.
 *
 * @param apiKey - The API key to be used for the request.
 * @param tipLink - The TipLink object to be sent.
 * @param toEmail - The email address of the recipient.
 * @param toName - Optional name of the recipient for the email.
 * @param replyEmail - Optional email address for the recipient to reply to.
 * @param replyName - Optional name of the sender for the email.
 * @returns A promise that resolves when the email has been sent.
 * @throws Throws an error if the HTTP request fails with a non-ok status.
 */
export async function mail(
  apiKey: string,
  tipLink: TipLink,
  toEmail: string,
  toName?: string,
  replyEmail?: string,
  replyName?: string
): Promise<void> {
  if (!(await isEmailValid(toEmail))) {
    throw new Error("Invalid email address");
  }

  const url = `${ENCLAVE_ENDPOINT}/api/v1/email/send`;

  const body = {
    toEmail: toEmail,
    toName,
    replyEmail,
    replyName,
    tiplinkUrl: tipLink.url.toString(),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP error, status: ${res.status}`);
  }
  console.log("TipLink sent!", res);
}

/**
 * @param apiKey - The API key to be used for the request.
 * @param escrowTipLink - The Escrow TipLink to be sent. Includes the toEmail and receiver TipLink public key.
 * @param toName - Optional name of the recipient for the email.
 * @param replyEmail - Optional email address for the recipient to reply to.
 * @param replyName - Optional name of the sender for the email.
 * @returns A promise that resolves when the email has been sent.
 * @throws Throws an error if the HTTP request fails with a non-ok status.
 */
interface MailEscrowWithObjArgs {
  apiKey: string;
  escrowTipLink: EscrowTipLink;
  toName?: string;
  replyEmail?: string;
  replyName?: string;
}

/**
 * @param apiKey - The API key to be used for the request.
 * @param toEmail - The email address of the recipient.
 * @param pda - The public key of the escrow vault.
 * @param receiverTipLink - The public key of the receiver TipLink.
 * @param toName - Optional name of the recipient for the email.
 * @param replyEmail - Optional email address for the recipient to reply to.
 * @param replyName - Optional name of the sender for the email.
 * @returns A promise that resolves when the email has been sent.
 * @throws Throws an error if the HTTP request fails with a non-ok status.
 */
interface MailEscrowWithValsArgs {
  apiKey: string;
  toEmail: string;
  pda: PublicKey;
  receiverTipLink: PublicKey;
  toName?: string;
  replyEmail?: string;
  replyName?: string;
}

/**
 * Asynchronously emails a deposited Escrow TipLink to a pre-defined recipient.
 */
export async function mailEscrow(
  args: MailEscrowWithObjArgs | MailEscrowWithValsArgs
): Promise<void> {
  // TODO: Require API key / ensure deposited

  const { apiKey, toName, replyEmail, replyName } = args;
  const { escrowTipLink } = args as MailEscrowWithObjArgs;
  let { toEmail, pda, receiverTipLink } = args as MailEscrowWithValsArgs;

  if (escrowTipLink) {
    toEmail = escrowTipLink.toEmail;
    pda = escrowTipLink.pda;
    receiverTipLink = escrowTipLink.receiverTipLink;
  }

  if (!(await isEmailValid(toEmail))) {
    throw new Error("Invalid email address");
  }

  // Sanity check; error checking occurs in the enclave and on-chain program
  if (!toEmail || !pda || !receiverTipLink) {
    throw new Error("Improper escrow.");
  }

  const url = `${ENCLAVE_ENDPOINT}/api/v1/email/send/escrow`;

  const receiverUrlOverride =
    process !== undefined && process.env !== undefined
      ? process.env.NEXT_PUBLIC_ESCROW_RECEIVER_URL_OVERRIDE
      : undefined;

  const body = {
    toEmail,
    toName,
    replyEmail,
    replyName,
    pda: pda.toString(),
    tiplinkPublicKey: receiverTipLink.toString(),
    receiverUrlOverride,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP error, status: ${res.status}`);
  }
  console.log("Escrow TipLink sent!", res);
}
