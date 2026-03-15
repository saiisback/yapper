import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yapper — Honest Reviews",
  description:
    "Rate and review places, creators, and products. Trusted, transparent reviews by real people.",
  openGraph: {
    title: "Yapper — Honest Reviews",
    description:
      "Rate and review places, creators, and products. Trusted, transparent reviews.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
      >
        <NavBar />
        <main className="min-h-screen pb-24 md:pt-16 md:pb-0">{children}</main>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
