import type { Metadata } from "next";
import { JetBrains_Mono, Inter, Outfit } from "next/font/google";
import "./globals.css";

const headline = Outfit({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["400", "500", "600", "700"]
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600"]
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
