import type { Metadata } from "next";
import { Inter } from "next/font/google";

import SolProvider from "@/solana/provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TipLink Mailer",
  description: "Create and email TipLinks securely",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SolProvider>{children}</SolProvider>
      </body>
    </html>
  );
}
