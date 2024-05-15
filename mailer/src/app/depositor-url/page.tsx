"use client";

import { useEffect, useState, useMemo, Suspense, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { EscrowTipLink, getEscrowReceiverTipLink } from "@tiplink/api";

import useTxSender from "@/hooks/useTxSender";
import { USDC_PUBLIC_KEY, BONK_PUBLIC_KEY } from "@/util/constants";
import { insertPriorityFeesIxs } from "@/util/helpers";
import { getReceiverEmailAction } from "@/app/actions";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@tiplink/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

function EscrowWithdraw(): JSX.Element {
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [escrowTipLink, setEscrowTipLink] = useState<EscrowTipLink>();
  const { sendWalletTx } = useTxSender();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFailure, setIsFailure] = useState(false);

  const mintSymbol = useMemo(() => {
    if (!escrowTipLink) {
      return undefined;
    }
    if (!escrowTipLink.mint) {
      return "SOL";
    }
    if (escrowTipLink.mint.address.equals(USDC_PUBLIC_KEY)) {
      return "USDC";
    }
    if (escrowTipLink.mint.address.equals(BONK_PUBLIC_KEY)) {
      return "BONK";
    }
    // For this example we'll just support SOL, USDC, and BONK
    throw new Error("Unsupported mint");
  }, [escrowTipLink]);

  const pda = useMemo<PublicKey | undefined>(() => {
    const pdaStr = searchParams.get("pda");
    if (pdaStr) {
      return new PublicKey(pdaStr);
    }
    return undefined;
  }, [searchParams]);

  const canWithdraw = useMemo<boolean>(
    () =>
      !!(
        connection &&
        pda &&
        escrowTipLink &&
        publicKey &&
        publicKey.equals(escrowTipLink.depositor)
      ),
    [connection, pda, escrowTipLink, publicKey],
  );

  const btnMsg = useMemo<JSX.Element | null>(() => {
    if (!publicKey) {
      return (
        <p className="text-gray-800 font-bold" key="connect">
          Connect wallet!
        </p>
      );
    }
    if (escrowTipLink && !canWithdraw) {
      return (
        <p className="text-red-500 font-bold" key="connect">
          No authority to withdraw
        </p>
      );
    }
    return null;
  }, [publicKey, canWithdraw, escrowTipLink]);

  const txMsg = useMemo<JSX.Element | null>(() => {
    if (isLoading) {
      return <p className="text-gray-800 font-bold">Processing...</p>;
    }
    if (isSuccess) {
      return <p className="text-green-500 font-bold">Success!</p>;
    }
    if (isFailure) {
      return <p className="text-red-500 font-bold">Failure.</p>;
    }
    return null;
  }, [isLoading, isSuccess, isFailure]);

  const handleWithdraw = useCallback(async (): Promise<void> => {
    if (!canWithdraw || !escrowTipLink || !publicKey || !connection) {
      throw new Error("Handle withdraw called when can't withdraw");
    }

    if (canWithdraw) {
      setIsLoading(true);
      setIsSuccess(false);
      setIsFailure(false);

      try {
        const tx = await escrowTipLink.withdrawTx(
          connection,
          publicKey, // authority
          publicKey, // destination
        );
        insertPriorityFeesIxs(tx);
        await sendWalletTx(tx);

        // We'll just set to undefined on the frontend right away anticipating next state
        setEscrowTipLink(undefined);
        setIsSuccess(true);
      } catch (err) {
        console.error(err);
        setIsFailure(true);
      } finally {
        setIsLoading(false);
      }
    }
  }, [canWithdraw, connection, escrowTipLink, publicKey, sendWalletTx]);

  useEffect(() => {
    async function getEscrowTipLink(): Promise<void> {
      if (connection && pda) {
        const receiverTipLink = await getEscrowReceiverTipLink(connection, pda);
        if (receiverTipLink) {
          const receiverEmail = await getReceiverEmailAction(
            receiverTipLink.toString(),
          );
          const e = await EscrowTipLink.get({ connection, pda, receiverEmail });
          setEscrowTipLink(e);
          console.log("Escrow TipLink:", e);
        } else {
          throw new Error("No receiver TipLink found for PDA");
        }
      }
    }

    getEscrowTipLink();
  }, [connection, pda]);

  return (
    <div className="p-4">
      <div className="flex justify-end">
        <WalletMultiButtonDynamic />
      </div>
      <div className="flex flex-col items-center gap-3 mt-8">
        {escrowTipLink ? (
          <>
            <div>
              <p className="text-gray-800 font-bold">
                Amount:{" "}
                {escrowTipLink.mint
                  ? escrowTipLink.amount / 10 ** escrowTipLink.mint.decimals
                  : escrowTipLink.amount / LAMPORTS_PER_SOL}
              </p>
              {mintSymbol && (
                <p className="text-gray-800 font-bold">{`Token: ${mintSymbol}`}</p>
              )}
            </div>
            <button
              className="shadow bg-blue-500 hover:bg-blue-400 focus:shadow-outline focus:outline-none text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={isLoading || !canWithdraw}
              onClick={handleWithdraw}
            >
              Withdraw
            </button>
            {btnMsg}
          </>
        ) : (
          <p className="font-bold" key="connect">
            Escrow is empty
          </p>
        )}
        {txMsg}
      </div>
    </div>
  );
}

export default function EscrowWithdrawPage(): JSX.Element {
  return (
    <Suspense>
      <EscrowWithdraw />
    </Suspense>
  );
}
