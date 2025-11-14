import type { Metadata } from "next";
import { Geist, Geist_Mono, Grand_Hotel } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const grandHotel = Grand_Hotel({
  variable: "--font-grand-hotel",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Strings App",
  description: "Effortlessly manage, localize, and export your app strings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${grandHotel.variable} antialiased`}
      >
        <Header />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
