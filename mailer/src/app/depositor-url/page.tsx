"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TipLink, EscrowTipLink } from "@tiplink/api";

import useTxSender from "@/hooks/useTxSender";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@tiplink/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export default function EscrowWithdraw(): JSX.Element {
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [escrowTiplink, setEscrowTiplink] = useState<EscrowTipLink>();
  const { sendWalletTx, sendKeypairTx } = useTxSender();
  const [tiplink, setTiplink] = useState<TipLink>();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFailure, setIsFailure] = useState(false);

  const pda = useMemo<PublicKey | undefined>(() => {
    const pdaStr = searchParams.get("pda");
    if (pdaStr) {
      return new PublicKey(pdaStr);
    }
    return undefined;
  }, [searchParams]);

  useEffect(() => {
    async function getEscrowTiplink(): Promise<void> {
      if (connection && pda) {
        const s = await EscrowTipLink.get(
          process.env.NEXT_PUBLIC_MAILER_API_KEY as string,
          connection,
          pda,
        );
        setEscrowTiplink(s);
        console.log("escrowTiplink", s);
      }
    }

    getEscrowTiplink();
  }, [connection, pda]);

  useEffect(() => {
    async function confirmTiplink(): Promise<void> {
      if (escrowTiplink) {
        const tiplinkHash = window.location.hash;
        if (tiplinkHash !== "") {
          const tiplinkUrl = `https://tiplink.io/i${tiplinkHash}`;
          const t = await TipLink.fromLink(tiplinkUrl);
          if (t.keypair.publicKey.equals(escrowTiplink.tiplinkPublicKey)) {
            setTiplink(t);
          }
        }
      }
    }

    confirmTiplink();
  }, [escrowTiplink]);

  const canWithdraw =
    connection &&
    pda &&
    escrowTiplink &&
    publicKey &&
    (tiplink || publicKey.equals(escrowTiplink.depositor));

  const handleWithdraw = async (): Promise<void> => {
    if (canWithdraw) {
      setIsLoading(true);
      setIsSuccess(false);
      setIsFailure(false);

      try {
        if (tiplink) {
          const tx = await escrowTiplink.withdrawTx(
            connection,
            tiplink.keypair.publicKey, // authority
            publicKey, // destination
          );
          await sendKeypairTx(tx, tiplink.keypair);
        } else {
          const tx = await escrowTiplink.withdrawTx(
            connection,
            publicKey, // authority
            publicKey, // destination
          );
          await sendWalletTx(tx);
        }

        // TODO: Better method of determining withdrawn / non-existent escrows
        setEscrowTiplink(undefined);
        setIsSuccess(true);
      } catch (e) {
        console.error(e);
        setIsFailure(true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const btnMsg = [];
  if (!publicKey) {
    btnMsg.push(
      <p className="text-gray-800 font-bold" key="connect">
        Connect wallet!
      </p>,
    );
  } else if (!canWithdraw) {
    btnMsg.push(
      <p className="text-red-500 font-bold" key="connect">
        No authority to withdraw
      </p>,
    );
  }

  let txMsg = null;
  if (isLoading) {
    txMsg = <p className="text-gray-800 font-bold">Processing...</p>;
  } else if (isSuccess) {
    txMsg = <p className="text-green-500 font-bold">Success!</p>;
  } else if (isFailure) {
    txMsg = <p className="text-red-500 font-bold">Failure.</p>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-end">
        <WalletMultiButtonDynamic />
      </div>
      <div className="flex flex-col items-center gap-3 mt-8">
        {escrowTiplink ? (
          <>
            <div>
              <p className="text-gray-800 font-bold">
                Amount:{" "}
                {escrowTiplink.mint
                  ? escrowTiplink.amount / 10 ** escrowTiplink.mint.decimals
                  : escrowTiplink.amount / LAMPORTS_PER_SOL}
              </p>
              <p className="text-gray-800 font-bold">
                Token: {escrowTiplink.mint ? "USDC" : "SOL"}
              </p>
            </div>
            <button
              className={`shadow bg-blue-500 hover:bg-blue-400 focus:shadow-outline focus:outline-none text-white font-bold py-2 px-4 rounded
                ${!canWithdraw ? "opacity-50 cursor-not-allowed" : ""}`}
              type="submit"
              disabled={!canWithdraw}
              onClick={handleWithdraw}
            >
              Withdraw
            </button>
            {btnMsg}
          </>
        ) : (
          // TODO: Save in DB when an escrow has been withdrawn or doesn't exist
          <p className="font-bold" key="connect">
            Escrow is empty
          </p>
        )}
        {txMsg}
      </div>
    </div>
  );
}
