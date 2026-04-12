"use client";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700/50 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold mb-1">Toronto City Pulse</h2>
        <p className="text-emerald-400 text-sm mb-4">Real-Time 3D City Intelligence</p>

        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
          An interactive 3D visualization platform that transforms Toronto&apos;s public data into a
          live city dashboard. 11 data layers from 6 different sources — parking enforcement,
          live TTC vehicles, bike share availability, road closures, cameras, collisions, and more.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">11</div>
            <div className="text-[10px] text-zinc-500">Data Layers</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">456K+</div>
            <div className="text-[10px] text-zinc-500">Data Points</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">Live</div>
            <div className="text-[10px] text-zinc-500">Real-Time Feeds</div>
          </div>
        </div>

        <div className="mb-5">
          <div className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Controls</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">Space</kbd>
              Play / Pause
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">L</kbd>
              Toggle Layers
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">&larr; &rarr;</kbd>
              Scrub Time
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">?</kbd>
              This Panel
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">Right-drag</kbd>
              Rotate Map
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">Ctrl+Scroll</kbd>
              Tilt / Pitch
            </div>
          </div>
        </div>

        <div className="mb-5">
          <div className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Data Sources</div>
          <p className="text-zinc-500 text-xs leading-relaxed">
            Toronto Open Data Portal, TTC NextBus API, Bike Share Toronto GBFS,
            City of Toronto Road Restrictions API. All public, freely accessible data.
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div>
            <div className="text-sm font-medium">Built by DareDev256</div>
            <div className="text-zinc-500 text-xs">Creative Technologist, Toronto</div>
          </div>
          <a
            href="https://github.com/DareDev256/toronto-parking-viz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            View Source
          </a>
        </div>
      </div>
    </div>
  );
}
