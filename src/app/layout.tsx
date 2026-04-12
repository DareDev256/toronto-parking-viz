import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Toronto City Pulse | Real-Time 3D City Intelligence",
  description:
    "Interactive 3D city intelligence dashboard for Toronto. Live TTC vehicles, parking enforcement, bike share, road closures, cameras, collisions — 10+ data layers from Toronto Open Data.",
  openGraph: {
    title: "Toronto City Pulse | Real-Time 3D City Intelligence",
    description:
      "10+ live data layers on a 3D map of Toronto. Parking, transit, safety, infrastructure — all from open data.",
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
