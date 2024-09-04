// NOTE: Withdraw with receiver TipLink requires manual testing.

import "dotenv/config";
import {
  PublicKey,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

import { EscrowTipLink } from "../../src";
import {
  getDepositorKeypair,
  getConnection,
  getUsdcMint,
  logDepositorInfo,
  insertPrioFeesIxs,
  retryWithDelay,
} from "./helpers";

export const onchainTest =
  process.env.ONCHAIN_TESTS === "true" ? test : test.skip;

let lamportEscrowTipLink: EscrowTipLink;
let lamportPda: PublicKey;

let splEscrowTipLink: EscrowTipLink;
let splPda: PublicKey;

beforeAll(async () => {
  if (process.env.ONCHAIN_TESTS === "true") {
    await logDepositorInfo();
  }
});

onchainTest("Creates lamport EscrowTipLink", async () => {
  const amount = 20000;
  const toEmail = "jackson@tiplink.io";
  const depositor = (await getDepositorKeypair()).publicKey;
  const connection = getConnection();

  lamportEscrowTipLink = await EscrowTipLink.create({
    connection,
    amount,
    toEmail,
    depositor,
    apiKey: process.env.MAILER_API_KEY as string,
  });

  // Check object
  expect(lamportEscrowTipLink.amount).toBe(amount);
  expect(lamportEscrowTipLink.toEmail).toBe(toEmail);
  expect(lamportEscrowTipLink.depositor).toBe(depositor);
  expect(lamportEscrowTipLink.receiverTipLink).toBeInstanceOf(PublicKey);
});

onchainTest(
  "Deposits lamport EscrowTipLink",
  async () => {
    const depositorKeypair = await getDepositorKeypair(0.1 * LAMPORTS_PER_SOL);
    const connection = getConnection();

    const tx = await lamportEscrowTipLink.depositTx(connection);
    insertPrioFeesIxs(tx);
    await sendAndConfirmTransaction(connection, tx, [depositorKeypair], {
      commitment: "confirmed",
    });

    // Check object
    expect(lamportEscrowTipLink.pda).toBeDefined();
    lamportPda = lamportEscrowTipLink.pda as PublicKey;
    expect(lamportPda).toBeInstanceOf(PublicKey);
    expect(lamportEscrowTipLink.depositorUrl).toBeInstanceOf(URL);
  },
  50000
); // Increase timeout for tx confirmation

onchainTest(
  "Get lamport EscrowTipLink returns instantiated class",
  async () => {
    const connection = getConnection();

    if (!lamportPda) {
      throw new Error(
        `lamportPda must be defined to run unit test. Check 'Deposits lamport EscrowTipLink' test`
      );
    }

    // Retries due to RPC inconsistency / not up to date
    retryWithDelay(async () => {
      const retrievedEscrowTipLink = await EscrowTipLink.get({
        connection,
        pda: lamportPda,
        apiKey: process.env.MAILER_API_KEY as string,
      });

      // Check object / on-chain data
      expect(retrievedEscrowTipLink).toStrictEqual(lamportEscrowTipLink);
    });
  }
);

onchainTest(
  "Withdraws lamport EscrowTipLink with depositor",
  async () => {
    const connection = getConnection();
    const depositorKeypair = await getDepositorKeypair(0.1 * LAMPORTS_PER_SOL);

    const depositorStartBalance = await connection.getBalance(
      depositorKeypair.publicKey
    );

    const tx = await lamportEscrowTipLink.withdrawTx(
      connection,
      depositorKeypair.publicKey,
      depositorKeypair.publicKey
    );
    insertPrioFeesIxs(tx);
    const sig = await sendAndConfirmTransaction(
      connection,
      tx,
      [depositorKeypair],
      {
        commitment: "confirmed",
      }
    );

    // Retries due to RPC inconsistency / not up to date
    await retryWithDelay(async () => {
      const confTx = await connection.getTransaction(sig, {
        maxSupportedTransactionVersion: 1,
      });
      if (!confTx) {
        throw new Error("Could not find confirmed transaction");
      }

      // Check on-chain data
      const depositorEndBalance = await connection.getBalance(
        depositorKeypair.publicKey,
        {
          minContextSlot: confTx.slot,
        }
      );
      expect(depositorEndBalance).toBeGreaterThan(depositorStartBalance); // Exact amounts are unit tested in the program repo
    });
  },
  50000
); // Increase timeout for tx confirmation

onchainTest(
  "Get lamport EscrowTipLink returns undefined after withdraw",
  async () => {
    const connection = getConnection();

    // Retries due to RPC inconsistency / not up to date
    await retryWithDelay(async () => {
      const retrievedEscrowTipLink = await EscrowTipLink.get({
        connection,
        pda: lamportPda,
        apiKey: process.env.MAILER_API_KEY as string,
      });
      expect(retrievedEscrowTipLink).toBeUndefined();
    });
  }
);

onchainTest("Creates SPL EscrowTipLink", async () => {
  const connection = getConnection();
  const usdcMint = await getUsdcMint();

  const amount = 1;
  const toEmail = "jackson@tiplink.io";
  const depositor = (await getDepositorKeypair()).publicKey;

  splEscrowTipLink = await EscrowTipLink.create({
    connection,
    amount,
    toEmail,
    depositor,
    apiKey: process.env.MAILER_API_KEY as string,
    mint: usdcMint,
  });

  // Check object
  expect(splEscrowTipLink.mint).toBe(usdcMint);
  expect(splEscrowTipLink.amount).toBe(amount);
  expect(splEscrowTipLink.toEmail).toBe(toEmail);
  expect(splEscrowTipLink.depositor).toBe(depositor);
  expect(splEscrowTipLink.receiverTipLink).toBeInstanceOf(PublicKey);
  expect(splEscrowTipLink.pda).toBeDefined();
  splPda = splEscrowTipLink.pda as PublicKey;
  expect(splPda).toBeInstanceOf(PublicKey);
  expect(splEscrowTipLink.depositorUrl).toBeInstanceOf(URL);
});

onchainTest(
  "Deposits SPL EscrowTipLink",
  async () => {
    const connection = getConnection();
    const depositorKeypair = await getDepositorKeypair(
      0.1 * LAMPORTS_PER_SOL,
      splEscrowTipLink.amount
    );
    const usdcMint = await getUsdcMint();

    const pdaAta = await getAssociatedTokenAddress(
      usdcMint.address,
      splPda,
      true
    );
    const pdaStartAmount = 0;

    const tx = await splEscrowTipLink.depositTx(connection);
    insertPrioFeesIxs(tx);
    await sendAndConfirmTransaction(connection, tx, [depositorKeypair], {
      commitment: "confirmed",
    });

    // Retries due to RPC inconsistency / not up to date
    await retryWithDelay(async () => {
      // Check on-chain data
      const pdaEndBalance = await connection.getTokenAccountBalance(pdaAta);
      const pdaEndAmount = parseInt(pdaEndBalance.value.amount);
      expect(pdaEndAmount - pdaStartAmount).toEqual(splEscrowTipLink.amount);
    });
  },
  50000
); // Increase timeout for tx confirmation

onchainTest("Get SPL EscrowTipLink returns instantiated class", async () => {
  const connection = getConnection();

  if (!splPda) {
    throw new Error(
      `splPda must be defined to run unit test. Check 'Deposits SPL EscrowTipLink' test`
    );
  }

  // Retries due to RPC inconsistency / not up to date
  await retryWithDelay(async () => {
    const retrievedEscrowTipLink = await EscrowTipLink.get({
      connection,
      pda: splPda,
      apiKey: process.env.MAILER_API_KEY as string,
    });

    // Check object / on-chain data
    expect(retrievedEscrowTipLink).toBeDefined();
    expect(retrievedEscrowTipLink?.toEmail).toBe(splEscrowTipLink.toEmail);
    expect(retrievedEscrowTipLink?.depositor).toStrictEqual(
      splEscrowTipLink.depositor
    );
    expect(retrievedEscrowTipLink?.receiverTipLink).toStrictEqual(
      splEscrowTipLink.receiverTipLink
    );
    expect(retrievedEscrowTipLink?.amount).toBe(splEscrowTipLink.amount);
    expect(retrievedEscrowTipLink?.mint?.address).toStrictEqual(
      splEscrowTipLink.mint?.address
    );
    expect(retrievedEscrowTipLink?.pda).toStrictEqual(splPda);
  });
  // NOTE: We don't check depositorTa
});

onchainTest(
  "Withdraws SPL EscrowTipLink with depositor",
  async () => {
    const connection = getConnection();
    const depositorKeypair = await getDepositorKeypair(0.1 * LAMPORTS_PER_SOL);
    const usdcMint = await getUsdcMint();

    const depositorAta = await getAssociatedTokenAddress(
      usdcMint.address,
      depositorKeypair.publicKey
    );
    const depositorAtaStartBalance = await connection.getTokenAccountBalance(
      depositorAta
    );

    const tx = await splEscrowTipLink.withdrawTx(
      connection,
      depositorKeypair.publicKey,
      depositorKeypair.publicKey
    );
    insertPrioFeesIxs(tx);
    await sendAndConfirmTransaction(connection, tx, [depositorKeypair], {
      commitment: "confirmed",
    });

    // Retries due to RPC inconsistency / not up to date
    await retryWithDelay(async () => {
      const depositorAtaEndBalance = await connection.getTokenAccountBalance(
        depositorAta
      );
      const depositorStartAmount = parseInt(
        depositorAtaStartBalance.value.amount
      );
      const depositorEndAmount = parseInt(depositorAtaEndBalance.value.amount);
      // Check on-chain data
      expect(depositorEndAmount - splEscrowTipLink.amount).toEqual(
        depositorStartAmount
      );
    });
  },
  50000
); // Increase timeout for tx confirmation

onchainTest("Get SPL EscrowTipLink returns undefined", async () => {
  const connection = getConnection();

  // Retries due to RPC inconsistency / not up to date
  await retryWithDelay(async () => {
    const retrievedEscrowTipLink = await EscrowTipLink.get({
      connection,
      pda: splPda,
      apiKey: process.env.MAILER_API_KEY as string,
    });
    expect(retrievedEscrowTipLink).toBeUndefined();
  });
});
