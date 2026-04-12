import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Toronto Parking Activity | 3D Visualization",
  description:
    "Interactive 3D timelapse of parking ticket activity across Toronto. Built with deck.gl and Toronto Open Data.",
  openGraph: {
    title: "Toronto Parking Activity | 3D Visualization",
    description:
      "Interactive 3D timelapse of 2.8M+ parking tickets across Toronto.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body className="h-full bg-black text-white font-mono">{children}</body>
    </html>
  );
}
