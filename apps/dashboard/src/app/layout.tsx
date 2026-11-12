import type { Metadata } from "next";
import { Inter, Bebas_Neue, DM_Mono, Noto_Serif, Source_Sans_3, Rajdhani, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
// AMSW labels/kickers, as on amsw.dk.
const dmMono = DM_Mono({ subsets: ["latin"], weight: "400", variable: "--font-mono" });
// Engvang's own typography, as on engvangskole.dk.
const notoSerif = Noto_Serif({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-engvang-serif" });
// HUD-look (Palma): kantet display-skrift og mono til labels.
const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-hud" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-hud-mono" });
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
  themeColor: "#03060b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body className={`${inter.variable} ${bebasNeue.variable} ${dmMono.variable} ${notoSerif.variable} ${sourceSans.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`}>{children}</body>
    </html>
  );
}
