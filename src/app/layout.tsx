import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import AnalyticsTracker from '@/components/AnalyticsTracker';
import { HardReloadMarker } from '@/components/HardReloadMarker';

import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL("https://yvossoeee.com"),
  title: "Y Voss Oeee | Dinámica #1",
  description: "Participa en la Dinámica 1 de Y Voss Oeee. Números desde $1. Premios de $1000, $300 y $100. ¡Tu oportunidad de ganar!",
  keywords: ["rifa", "dinámica", "sorteo", "premio", "Y Voss Oeee"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <HardReloadMarker />
          <AnalyticsTracker />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
