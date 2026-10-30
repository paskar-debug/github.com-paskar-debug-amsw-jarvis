import type { Metadata } from "next";
import { Inter, Bebas_Neue, DM_Mono, Noto_Serif, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-display" });
// AMSW labels/kickers, as on amsw.dk.
const dmMono = DM_Mono({ subsets: ["latin"], weight: "400", variable: "--font-mono" });
// Engvang's own typography, as on engvangskole.dk.
const notoSerif = Noto_Serif({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-engvang-serif" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-engvang-sans" });

export const metadata: Metadata = {
  title: "Paskar's Kontor",
  description: "Live dashboard for opgaver, kalender, AMSW-status og Whoop",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Kontor",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#050505",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body className={`${inter.variable} ${bebasNeue.variable} ${dmMono.variable} ${notoSerif.variable} ${sourceSans.variable}`}>{children}</body>
    </html>
  );
}
