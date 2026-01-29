import type { Metadata } from "next";
import { Geist, Geist_Mono, Courgette } from "next/font/google";
import "./globals.css";
import "../styles/embedded-variables.scss";
import { Header } from "@/components/header";
import { HeaderProvider } from "@/lib/HeaderContext";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const courgette = Courgette({
  variable: "--font-courgette",
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
        className={`${geistSans.variable} ${geistMono.variable} ${courgette.variable} antialiased`}
      >
        <HeaderProvider>
          <Header />
          {children}
        </HeaderProvider>
        <Toaster />
      </body>
    </html>
  );
}
