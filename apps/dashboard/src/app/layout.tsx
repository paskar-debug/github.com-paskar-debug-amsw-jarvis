import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMSW Jarvis",
  description: "Live dashboard for opgaver, kalender, AMSW-status, mål og velvære",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
