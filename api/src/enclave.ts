import { PublicKey } from "@solana/web3.js";

import { EscrowTipLink, TipLink } from ".";
import { isEmailValid } from "./email";

const DEFAULT_ENCLAVE_ENDPOINT = "https://mailer.tiplink.io";
const ENCLAVE_ENDPOINT =
  typeof process === "undefined"
    ? DEFAULT_ENCLAVE_ENDPOINT
    : process?.env?.NEXT_PUBLIC_ENCLAVE_ENDPOINT_OVERRIDE ??
      DEFAULT_ENCLAVE_ENDPOINT;
/**
 * Asynchronously calls secure enclave to create a TipLink, store it with an associated email, and return its public key.
 *
 * @param {string} apiKey - The API key to be used for the request.
 * @param {string} email - The email address to be associated with the receiver tiplink.
 * @returns {Promise<PublicKey>} A promise that resolves to the PublicKey of the receiver tiplink.
 * @throws {Error} Throws an error if the HTTPS request fails with a non-ok status.
 */
export async function createReceiverTipLink(
  apiKey: string,
  email: string,
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
 * @param {string} apiKey - The API key to be used for the request.
 * @param {PublicKey} publicKey - The public key of the TipLink for which to retrieve the associated email.
 * @returns {Promise<string>} A promise that resolves to the email address associated with the provided TipLink public key.
 * @throws {Error} Throws an error if the HTTPS request fails with a non-ok status.
 */
export async function getReceiverEmail(
  apiKey: string,
  publicKey: PublicKey,
): Promise<string> {
  const endpoint = `${ENCLAVE_ENDPOINT}/api/v1/generated-tiplinks/${publicKey.toString()}/email`;
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
 * Asynchronously emails a TipLink.
 *
 * @param {string} apiKey - The API key to be used for the request.
 * @param {TipLink} tipLink - The TipLink object to be sent.
 * @param {string} toEmail - The email address of the recipient.
 * @param {string} [toName] - Optional name of the recipient for the email.
 * @param {string} [replyEmail] - Optional email address for the recipient to reply to.
 * @param {string} [replyName] - Optional name of the sender for the email.
 * @returns {Promise<void>} A promise that resolves when the email has been sent.
 * @throws {Error} Throws an error if the HTTP request fails with a non-ok status.
 */
export async function mail(
  apiKey: string,
  tipLink: TipLink,
  toEmail: string,
  toName?: string,
  replyEmail?: string,
  replyName?: string,
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
 * @param {string} apiKey - The API key to be used for the request.
 * @param {string} escrowTipLink - The Escrow TipLink to be sent. Includes the toEmail and receiver TipLink public key.
 * @param {string} [toName] - Optional name of the recipient for the email.
 * @param {string} [replyEmail] - Optional email address for the recipient to reply to.
 * @param {string} [replyName] - Optional name of the sender for the email.
 * @returns {Promise<void>} A promise that resolves when the email has been sent.
 * @throws {Error} Throws an error if the HTTP request fails with a non-ok status.
 */
interface MailEscrowWithObjArgs {
  apiKey: string;
  escrowTipLink: EscrowTipLink;
  toName?: string;
  replyEmail?: string;
  replyName?: string;
}

/**
 * @param {string} apiKey - The API key to be used for the request.
 * @param {string} toEmail - The email address of the recipient.
 * @param {URL} pda - The public key of the escrow vault.
 * @param {PublicKey} receiverTipLink - The public key of the receiver TipLink.
 * @param {string} [toName] - Optional name of the recipient for the email.
 * @param {string} [replyEmail] - Optional email address for the recipient to reply to.
 * @param {string} [replyName] - Optional name of the sender for the email.
 * @returns {Promise<void>} A promise that resolves when the email has been sent.
 * @throws {Error} Throws an error if the HTTP request fails with a non-ok status.
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
  args: MailEscrowWithObjArgs | MailEscrowWithValsArgs,
): Promise<void> {
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
  const body = {
    toEmail,
    toName,
    replyEmail,
    replyName,
    pda: pda.toString(),
    tiplinkPublicKey: receiverTipLink.toString(),
    receiverUrlOverride:
      typeof process === "undefined"
        ? undefined
        : process?.env?.NEXT_PUBLIC_ESCROW_RECEIVER_URL_OVERRIDE ?? undefined,
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
