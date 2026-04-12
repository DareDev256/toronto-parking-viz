"use client";

import { CITY_LAYERS, type CityLayerDef, type PointData } from "@/lib/city-layers";

const CATEGORIES = [
  { id: "transit", label: "Transit" },
  { id: "enforcement", label: "Enforcement" },
  { id: "safety", label: "Safety" },
  { id: "infrastructure", label: "Infrastructure" },
] as const;

interface LayerPanelProps {
  activeLayers: Set<string>;
  layerData: Map<string, PointData[]>;
  loadingLayers: Set<string>;
  onToggle: (layerId: string) => void;
  showBuildings: boolean;
  onToggleBuildings: (v: boolean) => void;
  showOccupancy: boolean;
  onToggleOccupancy: (v: boolean) => void;
  showNeighbourhoods: boolean;
  onToggleNeighbourhoods: (v: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

function LayerRow({
  layer,
  active,
  loading,
  count,
  onToggle,
}: {
  layer: CityLayerDef;
  active: boolean;
  loading: boolean;
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
        active ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <div
        className="w-3 h-3 rounded-full flex-shrink-0 transition-opacity"
        style={{
          backgroundColor: `rgb(${layer.color.join(",")})`,
          opacity: active ? 1 : 0.3,
        }}
      />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium ${active ? "text-white" : "text-zinc-500"}`}>
          {layer.name}
        </div>
        {active && count > 0 && (
          <div className="text-[10px] text-zinc-600">{count.toLocaleString()} points</div>
        )}
      </div>
      {loading && (
        <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
      )}
      {layer.refreshInterval && active && !loading && (
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live" />
      )}
    </button>
  );
}

export default function LayerPanel({
  activeLayers,
  layerData,
  loadingLayers,
  onToggle,
  showBuildings,
  onToggleBuildings,
  showOccupancy,
  onToggleOccupancy,
  showNeighbourhoods,
  onToggleNeighbourhoods,
  isOpen,
  onClose,
}: LayerPanelProps) {
  if (!isOpen) return null;

  const totalActive = activeLayers.size + (showBuildings ? 1 : 0) + (showOccupancy ? 1 : 0) + 1; // +1 for parking tickets always on

  return (
    <div className="absolute top-28 left-4 z-20 w-64 bg-black/90 backdrop-blur-sm border border-zinc-700 rounded-xl overflow-hidden max-h-[calc(100vh-200px)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <div className="text-sm font-bold">City Layers</div>
          <div className="text-[10px] text-zinc-500">{totalActive} active</div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm">x</button>
      </div>

      <div className="overflow-y-auto flex-1 p-2">
        {/* Built-in layers */}
        <div className="mb-2">
          <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider px-3 py-1">Core</div>
          <button
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/10 text-left cursor-default"
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0 bg-emerald-500" />
            <div className="text-xs font-medium text-white">Parking Tickets</div>
            <div className="text-[10px] text-zinc-500 ml-auto">always on</div>
          </button>

          <button
            onClick={() => onToggleOccupancy(!showOccupancy)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${showOccupancy ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: "rgb(16,185,129)", opacity: showOccupancy ? 1 : 0.3 }} />
            <div className={`text-xs font-medium ${showOccupancy ? "text-white" : "text-zinc-500"}`}>Green P Occupancy</div>
          </button>

          <button
            onClick={() => onToggleBuildings(!showBuildings)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${showBuildings ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: "rgb(100,100,110)", opacity: showBuildings ? 1 : 0.3 }} />
            <div className={`text-xs font-medium ${showBuildings ? "text-white" : "text-zinc-500"}`}>3D Buildings</div>
          </button>

          <button
            onClick={() => onToggleNeighbourhoods(!showNeighbourhoods)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${showNeighbourhoods ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: "rgb(255,255,255)", opacity: showNeighbourhoods ? 0.5 : 0.15 }} />
            <div className={`text-xs font-medium ${showNeighbourhoods ? "text-white" : "text-zinc-500"}`}>Neighbourhoods</div>
          </button>
        </div>

        {/* Dynamic layers by category */}
        {CATEGORIES.map((cat) => {
          const layers = CITY_LAYERS.filter((l) => l.category === cat.id);
          if (layers.length === 0) return null;
          return (
            <div key={cat.id} className="mb-2">
              <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider px-3 py-1">
                {cat.label}
              </div>
              {layers.map((layer) => (
                <LayerRow
                  key={layer.id}
                  layer={layer}
                  active={activeLayers.has(layer.id)}
                  loading={loadingLayers.has(layer.id)}
                  count={layerData.get(layer.id)?.length || 0}
                  onToggle={() => onToggle(layer.id)}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-zinc-800">
        <div className="text-[10px] text-zinc-600 text-center">
          Powered by Toronto Open Data
        </div>
      </div>
    </div>
  );
}
