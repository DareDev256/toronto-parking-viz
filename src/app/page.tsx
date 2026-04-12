"use client";

import dynamic from "next/dynamic";

const ParkingMap = dynamic(() => import("@/components/ParkingMap"), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="text-2xl font-bold mb-2">Loading Toronto Parking Data...</div>
        <div className="text-zinc-500 text-sm">2.8M+ tickets visualized</div>
      </div>
    </div>
  ),
});

export default function Home() {
  return <ParkingMap />;
}
