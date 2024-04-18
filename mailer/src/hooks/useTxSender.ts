import { useCallback } from "react";
import {
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export default function useTxSender(): {
  sendWalletTx: (tx: Transaction) => Promise<string>;
  sendKeypairTx: (tx: Transaction, keypair: Keypair) => Promise<string>;
} {
  const { connection } = useConnection();
  const { sendTransaction } = useWallet();

  const sendWalletTx = useCallback(
    async (tx: Transaction) => {
      try {
        const {
          value: { blockhash, lastValidBlockHeight },
        } = await connection.getLatestBlockhashAndContext();

        const sig = await sendTransaction(tx, connection);

        await connection.confirmTransaction(
          {
            signature: sig,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed",
        );

        console.log("sig:", sig);
        return sig;
      } catch (error) {
        console.error("Error sending wallet transaction:", error);
        throw error;
      }
    },
    [connection, sendTransaction],
  );

  const sendKeypairTx = useCallback(
    async (tx: Transaction, keypair: Keypair) => {
      try {
        const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);

        console.log("sig:", sig);
        return sig;
      } catch (error) {
        console.error("Error sending keypair transaction:", error);
        throw error;
      }
    },
    [connection],
  );

  return { sendWalletTx, sendKeypairTx };
}
