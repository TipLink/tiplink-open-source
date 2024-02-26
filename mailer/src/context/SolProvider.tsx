"use client";

import {
  createContext,
  useMemo,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { TipLinkWalletAdapter } from "@tiplink/wallet-adapter";
import { TipLinkWalletAutoConnect } from "@tiplink/wallet-adapter-react-ui";

// Default styles that can be overridden by your app
require("@tiplink/wallet-adapter-react-ui/styles.css");

const ReactUIWalletModalProviderDynamic = dynamic(
  async () =>
    (await import("@tiplink/wallet-adapter-react-ui")).WalletModalProvider,
  { ssr: false },
);

interface SolContextType {
  network?: WalletAdapterNetwork;
  setNetwork?: Dispatch<SetStateAction<WalletAdapterNetwork>>;
}
export const SolContext = createContext<SolContextType>({});

export default function SolProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [network, setNetwork] = useState(WalletAdapterNetwork.Mainnet);
  const searchParams = useSearchParams();

  const endpoint = (
    network === WalletAdapterNetwork.Devnet
      ? process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC
      : process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC
  ) as WalletAdapterNetwork;

  const wallets = useMemo(
    () => [
      /**
       * Wallets that implement either of these standards will be available automatically.
       *
       *   - Solana Mobile Stack Mobile Wallet Adapter Protocol
       *     (https://github.com/solana-mobile/mobile-wallet-adapter)
       *   - Solana Wallet Standard
       *     (https://github.com/solana-labs/wallet-standard)
       *
       * If you wish to support a wallet that supports neither of those standards,
       * instantiate its legacy wallet adapter here. Common legacy adapters can be found
       * in the npm package `@solana/wallet-adapter-wallets`.
       */
      new TipLinkWalletAdapter("TipLink Mailer", {
        buildEnv: "development",
        theme: "light",
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network],
  );

  const val = useMemo(() => ({ network, setNetwork }), [network, setNetwork]);

  return (
    <SolContext.Provider value={val}>
      <TipLinkWalletAutoConnect isReady query={searchParams}>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <ReactUIWalletModalProviderDynamic>
              {children}
            </ReactUIWalletModalProviderDynamic>
          </WalletProvider>
        </ConnectionProvider>
      </TipLinkWalletAutoConnect>
    </SolContext.Provider>
  );
}
