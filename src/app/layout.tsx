import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const headline = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["500", "700"]
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"]
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"]
});

export const metadata: Metadata = {
  title: "Releaseboard",
  description: "One release feed across all product services"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): JSX.Element {
  return (
    <html lang="en">
      <body className={`${headline.variable} ${body.variable} ${mono.variable}`}>
        <div className="app-bg-noise" aria-hidden="true" />
        <div className="app-bg-grid" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
