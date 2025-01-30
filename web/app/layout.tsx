import type { Metadata } from "next";
import "./globals.css";
import Logo from "@/components/logo";
import Navbar from "@/components/navbar";

export const metadata: Metadata = {
  title: "Video Club Hall of Fame",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <header>
          <Logo />
          <Navbar />
        </header>
        {children}
      </body>
    </html>
  );
}
