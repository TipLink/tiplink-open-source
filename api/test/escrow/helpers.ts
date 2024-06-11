import "dotenv/config";

import { mnemonicToSeedSync } from "bip39";

import {
  Keypair,
  Connection,
  PublicKey,
  TransactionInstruction,
  ComputeBudgetProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getMint, Mint } from "@solana/spl-token";
import { getAssociatedTokenAddress } from "@solana/spl-token";

let connection: Connection;
export function getConnection() {
  if (connection) {
    return connection;
  }

  const rpcEndpoint = process.env.SOLANA_MAINNET_RPC as string;
  if (!rpcEndpoint) {
    throw new Error(
      `SOLANA_MAINNET_RPC env var must be set to run unit test. Set in .env file based on .env.example`
    );
  }

  connection = new Connection(rpcEndpoint, "confirmed");

  return connection;
}

let usdcMint: Mint;
export async function getUsdcMint() {
  if (usdcMint) {
    return usdcMint;
  }
  const conn = getConnection();

  const usdcMintPublicKey = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );
  usdcMint = await getMint(conn, usdcMintPublicKey);

  return usdcMint;
}

function createKeypairFromSeedPhrase(seedPhrase: string): Keypair {
  const seedBuffer = mnemonicToSeedSync(seedPhrase);
  const seed = Buffer.alloc(32, seedBuffer);
  const keypair = Keypair.fromSeed(seed);
  return keypair;
}

export async function getDepositorKeypair(
  requiredLamports?: number,
  requiredUsdc?: number
): Promise<Keypair> {
  const conn = getConnection();

  const depositorSeedPhrase = process.env
    .TEST_ESCROW_DEPOSITOR_SEED_PHRASE as string;
  if (!depositorSeedPhrase) {
    throw new Error(
      `DEPOSITOR_SEED env var must be set to run unit test. Set in .env file based on .env.example`
    );
  }

  const depositorKeypair = createKeypairFromSeedPhrase(depositorSeedPhrase);

  if (requiredLamports) {
    const depositorBalance = await conn.getBalance(depositorKeypair.publicKey);
    if (depositorBalance < requiredLamports) {
      throw new Error(
        `Depositor lamport balance must be greater than ${requiredLamports} lamports to run unit test. Please send lamports to ${depositorKeypair.publicKey}`
      );
    }
  }

  if (requiredUsdc) {
    const mint = await getUsdcMint();
    const depositorAta = await getAssociatedTokenAddress(
      mint.address,
      depositorKeypair.publicKey
    );

    try {
      const depositorAtaBalance = await conn.getTokenAccountBalance(
        depositorAta
      );
      if (parseInt(depositorAtaBalance.value.amount) < requiredUsdc) {
        throw new Error();
      }
    } catch {
      throw new Error(
        `Depositor USDC balance must be greater than ${requiredUsdc} (decimals) to run unit test. Please send USDC to ${depositorKeypair.publicKey}`
      );
    }
  }

  return depositorKeypair;
}

export async function logDepositorInfo() {
  const depositorKeypair = await getDepositorKeypair();
  const conn = getConnection();
  const depositorBalance =
    (await conn.getBalance(depositorKeypair.publicKey)) / LAMPORTS_PER_SOL;
  const mint = await getUsdcMint();
  const depositorAta = await getAssociatedTokenAddress(
    mint.address,
    depositorKeypair.publicKey
  );
  const depositorAtaBalance = await conn.getTokenAccountBalance(depositorAta);
  const depositorAtaBalanceDecimals =
    parseInt(depositorAtaBalance.value.amount) / 10 ** mint.decimals;

  console.log(`
    Depositor Info:
    Public Key: ${depositorKeypair.publicKey.toBase58()}
    SOL balance: ${depositorBalance}
    USDC balance: ${depositorAtaBalanceDecimals}
  `);
}

// The following is from the /tiplink folder. Perhaps we should make these publicly
// available in the API and share. We use this for our on-chain unit tests here.

const COMPUTE_UNIT_PRICE = 200000;
const COMPUTE_UNIT_LIMIT = 200000;

export function getPrioFeesIxs(
  computeUnitPrice: number,
  computeUnitLimit: number
): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: computeUnitPrice,
    }),
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnitLimit,
    }),
  ];
}

/**
 * @remarks Edits txn in place
 */
export function insertPrioFeesIxs(
  tx: Transaction,
  cuPrice = COMPUTE_UNIT_PRICE,
  cuLimit = COMPUTE_UNIT_LIMIT
) {
  const ixs = getPrioFeesIxs(cuPrice, cuLimit);
  tx.instructions.unshift(...ixs);
}
