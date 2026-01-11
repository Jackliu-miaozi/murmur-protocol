import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { WalletProviderWrapper } from "@/components/wallet";
import { Navigation } from "@/components/layout";

export const metadata: Metadata = {
  title: "Murmur Protocol",
  description: "Decentralized discussion platform with NFT memories",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white">
        <TRPCReactProvider>
          <WalletProviderWrapper>
            <Navigation />
            <main className="pt-16 md:pt-16">{children}</main>
          </WalletProviderWrapper>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
