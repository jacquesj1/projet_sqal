import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control Panel V2 - Gaveurs System",
  description: "Unified simulator control panel for Euralis Gaveurs platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
