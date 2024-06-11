import { PublicKey } from "@solana/web3.js";

export const DEFAULT_COMPUTE_UNIT_PRICE = 100_000;
export const DEFAULT_COMPUTE_UNIT_LIMIT = 100_000;

// NOTE: These can change with network and program updates
export const BASE_FEE_LAMPORTS = 5_000;

export const TIPLINK_WITHDRAW_FEE_LAMPORTS = 10_000; // Not needed for SPL
export const DESTINATION_ATA_RENT_LAMPORTS = 2_039_280;

export const USDC_PUBLIC_KEY = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

export const BONK_PUBLIC_KEY = new PublicKey(
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
);

export const DEST_DUST = 10020 * 2; // TODO: Incorporate into SDK with more exact amounts
