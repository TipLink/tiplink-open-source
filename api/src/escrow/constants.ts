import { PublicKey } from "@solana/web3.js";

export const ESCROW_PROGRAM_ID = new PublicKey(
  "8TqqugH88U3fDEWeKHqBSxZKeqoRrXkdpy3ciX5GAruK"
);

export const TREASURY_PUBLIC_KEY = new PublicKey(
  "BGZMcTjyTCbkRszC1CBpFpP9CbVh3Ah2ZhjzCsc9PsAr"
);

export const PDA_SEED = "escrow";

const DEFAULT_DEPOSIT_URL_BASE =
  "https://tiplink-mailer.vercel.app/depositor-url";
export const DEPOSIT_URL_BASE =
  process !== undefined && process.env !== undefined
    ? process.env.NEXT_PUBLIC_ESCROW_DEPOSITOR_URL_OVERRIDE ||
      DEFAULT_DEPOSIT_URL_BASE
    : DEFAULT_DEPOSIT_URL_BASE;

export const PRIO_FEES_LAMPORTS = 10_000;

const DEFAULT_INDEXER_URL_BASE = "https://backend.tiplink.io";
export const INDEXER_URL_BASE =
  process !== undefined && process.env !== undefined
    ? process.env.NEXT_PUBLIC_INDEXER_URL_OVERRIDE || DEFAULT_INDEXER_URL_BASE
    : DEFAULT_INDEXER_URL_BASE;
