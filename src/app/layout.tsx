import type { Metadata } from "next";
import { Newsreader, Geist, Tiro_Devanagari_Marathi } from "next/font/google";
import "./globals.css";

// Display: Newsreader. UI/body: Geist. Devanagari: Tiro Devanagari Marathi.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const tiroDevanagari = Tiro_Devanagari_Marathi({
  variable: "--font-tiro",
  subsets: ["devanagari", "latin"],
  weight: "400",
  display: "swap",
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "BoardBodh";

export const metadata: Metadata = {
  title: appName,
  description:
    "Board-exam intelligence platform for Std 12 Physics. A guided progression, never the same question twice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${geist.variable} ${tiroDevanagari.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
