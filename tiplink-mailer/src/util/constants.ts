import { PublicKey } from "@solana/web3.js";

// NOTE: These can change with network and program updates
export const MINIMUM_RENT_LAMPORTS = 890880;
export const MINIMUM_TA_RENT_LAMPORTS = 2039280;

export const LAMPORT_ESCROW_SPACE = 1 + 32 + 32 + 32 + 8 + 8;
export const SPL_ESCROW_SPACE = 1 + 32 + 32 + 32 + 32 + 8 + 8;
export const TIPLINK_WITHDRAW_FEE_LAMPORTS = 10000; // Not needed for SPL
export const TIPLINK_RENT_LAMPORTS = 890880; // Also covers withdraw fee
export const DESTINATION_ATA_RENT_LAMPORTS = 2039280;
export const ENCLAVE_TRANSACTION_FEE_REFUND_LAMPORTS = 10000;
export const ENCLAVE_DUST = 3400;
export const DESTINATION_DUST_LAMPORTS = 10000;
export const TREASURY_FEE_LAMPORTS = 3000000; // TODO: Change this for production
export const TIPLINK_DUST_LAMPORTS = 15000;
export const PDA_ATA_RENT_LAMPORTS = MINIMUM_TA_RENT_LAMPORTS; // via Anchor init

export const ESCROW_PROGRAM_ID = new PublicKey(
  "8TqqugH88U3fDEWeKHqBSxZKeqoRrXkdpy3ciX5GAruK",
);

export const TREASURY_PUBLIC_KEY_DEVNET = new PublicKey(
  "GUua2QL7guU2RjQJXyZt6ePHVWrhEW5PcRcuU1t2mmQF",
);

export const PDA_SEED = "escrow";

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

export const DEST_DUST = 10020 * 2; // TEMP: Incorporate into SDK with more exact amounts
