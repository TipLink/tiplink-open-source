// TEMP: Code based on Tailwind example which doesn't conform to a11y standards
/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { WalletNotConnectedError } from "@solana/wallet-adapter-base";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { TipLink, EscrowTipLink } from "@tiplink/api";

import {
  mailAction,
  mailEscrowAction,
  createReceiverTipLinkAction,
} from "@/app/actions";
import useTxSender from "@/hooks/useTxSender";
import {
  USDC_PUBLIC_KEY,
  BONK_PUBLIC_KEY,
  TIPLINK_WITHDRAW_FEE_LAMPORTS,
  DESTINATION_ATA_RENT_LAMPORTS,
  DEST_DUST,
} from "@/util/constants";
import { insertPriorityFeesIxs } from "@/util/helpers";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@tiplink/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export default function Home(): JSX.Element {
  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [replyName, setReplyName] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [isEscrow, setIsEscrow] = useState(false);
  const [token, setToken] = useState("SOL");
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { sendWalletTx } = useTxSender();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFailure, setIsFailure] = useState(false);
  const [statusUrl, setStatusUrl] = useState("");
  const [statusLabel, setStatusLabel] = useState("");

  const sendTipLink = useCallback(async (): Promise<string> => {
    if (!publicKey) {
      throw new WalletNotConnectedError();
    }

    // Create
    const tipLink = await TipLink.create();

    // Fund
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: tipLink.keypair.publicKey,
        lamports:
          parseFloat(amount) * LAMPORTS_PER_SOL +
          TIPLINK_WITHDRAW_FEE_LAMPORTS +
          DEST_DUST,
      }),
    );

    // Insert priority fees
    insertPriorityFeesIxs(tx);

    // Send
    const sig = await sendWalletTx(tx);

    console.log(sig);

    setStatusUrl(tipLink.url.toString());
    setStatusLabel("TipLink");

    // Mail
    await mailAction(
      tipLink.url.toString(),
      toEmail,
      toName !== "" ? toName : undefined,
      replyEmail !== "" ? replyEmail : undefined,
      replyName !== "" ? replyName : undefined,
    );

    return sig;
  }, [amount, replyEmail, replyName, publicKey, toEmail, toName, sendWalletTx]);

  const sendSplTipLink = useCallback(
    async (mintAddr: PublicKey): Promise<string> => {
      if (!publicKey) {
        throw new WalletNotConnectedError();
      }

      // Setup mint
      const mint = await getMint(connection, mintAddr);

      // Create
      const tipLink = await TipLink.create();

      // Fund

      // Transfer Lamports
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: tipLink.keypair.publicKey,
          lamports:
            TIPLINK_WITHDRAW_FEE_LAMPORTS +
            DESTINATION_ATA_RENT_LAMPORTS +
            DEST_DUST,
        }),
      );

      // Create TipLink ATA
      const tipLinkAta = await getAssociatedTokenAddress(
        mint.address,
        tipLink.keypair.publicKey,
      );
      const accountInfo = await connection.getAccountInfo(tipLinkAta);
      if (accountInfo === null) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            tipLinkAta,
            tipLink.keypair.publicKey,
            mint.address,
          ),
        );
      }

      // Transfer SPL
      const fromAta = await getAssociatedTokenAddress(mint.address, publicKey);
      tx.add(
        createTransferInstruction(
          fromAta,
          tipLinkAta,
          publicKey,
          parseFloat(amount) * 10 ** mint.decimals,
        ),
      );

      // Insert priority fees
      insertPriorityFeesIxs(tx);

      // Send
      const sig = await sendWalletTx(tx);

      setStatusUrl(tipLink.url.toString());
      setStatusLabel("TipLink");

      // Mail
      await mailAction(
        tipLink.url.toString(),
        toEmail,
        toName !== "" ? toName : undefined,
        replyEmail !== "" ? replyEmail : undefined,
        replyName !== "" ? replyName : undefined,
      );

      return sig;
    },
    [
      connection,
      amount,
      replyEmail,
      replyName,
      publicKey,
      toEmail,
      toName,
      sendWalletTx,
    ],
  );

  const sendEscrowTipLink = useCallback(async (): Promise<string> => {
    if (!publicKey) {
      throw new WalletNotConnectedError();
    }

    // Create Escrow TipLink
    const receiverTipLinkStr = await createReceiverTipLinkAction(toEmail);
    const receiverTipLink = new PublicKey(receiverTipLinkStr);
    const escrowTipLink = await EscrowTipLink.create({
      connection,
      amount: parseFloat(amount) * LAMPORTS_PER_SOL,
      toEmail,
      depositor: publicKey,
      receiverTipLink,
    });

    // Deposit
    const tx = await escrowTipLink.depositTx(connection);
    const sig = await sendWalletTx(tx);

    // DEBUG
    console.log("Depositor URL: ", escrowTipLink.depositorUrl.toString());
    setStatusUrl(escrowTipLink.depositorUrl.toString());
    setStatusLabel("Depositor URL");

    // Mail
    await mailEscrowAction(
      escrowTipLink.toEmail,
      escrowTipLink.depositorUrl.toString(),
      escrowTipLink.receiverTipLink.toString(),
      toName !== "" ? toName : undefined,
      replyEmail !== "" ? replyEmail : undefined,
      replyName !== "" ? replyName : undefined,
    );

    return sig;
  }, [
    amount,
    publicKey,
    toEmail,
    toName,
    replyEmail,
    replyName,
    sendWalletTx,
    connection,
  ]);

  const sendEscrowSplTipLink = useCallback(
    async (mintAddr: PublicKey): Promise<string> => {
      if (!publicKey) {
        throw new WalletNotConnectedError();
      }

      // Setup mint
      const mint = await getMint(connection, mintAddr);

      // Create Escrow TipLink
      const receiverTipLinkStr = await createReceiverTipLinkAction(toEmail);
      const receiverTipLink = new PublicKey(receiverTipLinkStr);
      const escrowTipLink = await EscrowTipLink.create({
        connection,
        amount: parseFloat(amount) * 10 ** mint.decimals,
        toEmail,
        depositor: publicKey,
        receiverTipLink,
        mint,
      });

      // Deposit
      const tx = await escrowTipLink.depositTx(connection);
      const sig = await sendWalletTx(tx);

      // DEBUG
      console.log("Depositor URL: ", escrowTipLink.depositorUrl.toString());
      setStatusUrl(escrowTipLink.depositorUrl.toString());
      setStatusLabel("Depositor URL");

      // Mail
      await mailEscrowAction(
        escrowTipLink.toEmail,
        escrowTipLink.depositorUrl.toString(),
        escrowTipLink.receiverTipLink.toString(),
        toName !== "" ? toName : undefined,
        replyEmail !== "" ? replyEmail : undefined,
        replyName !== "" ? replyName : undefined,
      );

      return sig;
    },
    [
      amount,
      publicKey,
      toEmail,
      toName,
      connection,
      replyEmail,
      replyName,
      sendWalletTx,
    ],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setIsLoading(true);
      setIsSuccess(false);
      setIsFailure(false);
      setStatusUrl("");
      setStatusLabel("");

      let sig = "";

      try {
        if (token === "SOL") {
          if (!isEscrow) {
            sig = await sendTipLink();
          } else {
            sig = await sendEscrowTipLink();
          }
        } else {
          const mintAddress =
            token === "USDC" ? USDC_PUBLIC_KEY : BONK_PUBLIC_KEY;
          if (!isEscrow) {
            sig = await sendSplTipLink(mintAddress);
          } else {
            sig = await sendEscrowSplTipLink(mintAddress);
          }
        }

        setIsSuccess(true);

        // DEBUG
        connection.getParsedTransaction(sig).then((parsed) => {
          console.log("Parsed Tx:", parsed);
        });
      } catch (err) {
        console.error("Error mailing TipLink", err);
        setIsFailure(true);
      } finally {
        setIsLoading(false);
      }
    },
    [
      isEscrow,
      token,
      sendTipLink,
      sendSplTipLink,
      sendEscrowTipLink,
      sendEscrowSplTipLink,
      connection,
    ],
  );

  const msgUrl =
    statusUrl === "" ? null : (
      <a className="ml-2 underline" href={statusUrl} target="_blank">
        {statusLabel}
      </a>
    );

  let msg = null;
  if (isLoading) {
    msg = <p className="text-gray-800 font-bold">Processing...</p>;
  } else if (isSuccess) {
    msg = <p className="text-green-500 font-bold">Success! {msgUrl}</p>;
  } else if (isFailure) {
    msg = <p className="text-red-500 font-bold">Failure. {msgUrl}</p>;
  } else if (!publicKey) {
    msg = <p className="text-gray-800 font-bold">Connect wallet!</p>;
  }

  let max;
  let min;
  if (token === "SOL") {
    max = "0.2";
    min = "0.0001";
  } else if (token === "USDC") {
    max = "20";
    min = "0.01";
  } else if (token === "Bonk") {
    max = "100000";
    min = "50";
  }

  return (
    <div className="p-4">
      <div className="flex justify-end">
        <WalletMultiButtonDynamic />
      </div>
      <div className="flex min-h-screen flex-col items-center mt-8 gap-4 sm:gap-10">
        <h2 className="text-4xl font-bold dark:text-white text-blue-500">
          TipLink Mailer
        </h2>
        <form className="w-full max-w-md md:max-w-lg" onSubmit={handleSubmit}>
          <div className="md:flex md:items-center mb-6">
            <div className="md:w-1/3">
              <label
                className="block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4"
                htmlFor="to-email"
              >
                To Email *
              </label>
            </div>
            <div className="md:w-2/3">
              <input
                className="bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-blue-500"
                id="to-email"
                type="email"
                placeholder="john@example.com"
                onChange={(e) => setToEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="md:flex md:items-center mb-6">
            <div className="md:w-1/3">
              <label
                className="block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4"
                htmlFor="to-name"
              >
                To Name
              </label>
            </div>
            <div className="md:w-2/3">
              <input
                className="bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-blue-500"
                id="to-name"
                type="text"
                placeholder="John Doe"
                onChange={(e) => setToName(e.target.value)}
              />
            </div>
          </div>
          <div className="md:flex md:items-center mb-6">
            <div className="md:w-1/3">
              <label
                className="block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4"
                htmlFor="reply-email"
              >
                Reply Email
              </label>
            </div>
            <div className="md:w-2/3">
              <input
                className="bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-blue-500"
                id="reply-email"
                type="email"
                placeholder="jane@example.com"
                onChange={(e) => setReplyEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="md:flex md:items-center mb-6">
            <div className="md:w-1/3">
              <label
                className="block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4"
                htmlFor="reply-name"
              >
                Reply Name
              </label>
            </div>
            <div className="md:w-2/3">
              <input
                className="bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-blue-500"
                id="reply-name"
                type="text"
                placeholder="Jane Doe"
                onChange={(e) => setReplyName(e.target.value)}
              />
            </div>
          </div>
          <div className="md:flex md:items-center mb-6">
            <div className="md:w-1/3">
              <label
                className="block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4"
                htmlFor="token"
              >
                Token *
              </label>
            </div>
            <div className="md:w-2/3 relative">
              <select
                className="block appearance-none w-full bg-gray-200 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-blue-500"
                id="token"
                onChange={(e) => setToken(e.target.value)}
              >
                <option>SOL</option>
                <option>USDC</option>
                <option>Bonk</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg
                  className="fill-current h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="md:flex md:items-center mb-6">
            <div className="md:w-1/3">
              <label
                className="block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4"
                htmlFor="amount"
              >
                Amount *
              </label>
            </div>
            <div className="md:w-2/3">
              <input
                className="bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-blue-500"
                id="amount"
                type="number"
                placeholder="0.01"
                max={max}
                min={min}
                step={min}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="md:flex md:items-center mb-6">
            <div className="md:w-1/3">
              <label
                className="block text-gray-500 font-bold md:text-right mb-1 md:mb-0 pr-4"
                htmlFor="escrow"
              >
                Escrow
              </label>
            </div>
            <div>
              <input
                id="escrow"
                type="checkbox"
                onChange={(e) => setIsEscrow(e.target.checked)}
                className="cursor-pointer"
              />
            </div>
          </div>
          <div className="md:flex md:items-center">
            <div className="md:w-1/3" />
            <div className="md:w-2/3 flex items-center gap-4">
              <button
                className={`shadow bg-blue-500 hover:bg-blue-400 focus:shadow-outline focus:outline-none text-white font-bold py-2 px-4 rounded
                ${
                  !publicKey || isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                type="submit"
                disabled={!publicKey || isLoading}
              >
                Send
              </button>
              {msg}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
