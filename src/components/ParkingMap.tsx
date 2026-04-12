"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Map, useControl, type MapRef } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, ScatterplotLayer, PolygonLayer, GeoJsonLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { PickingInfo } from "@deck.gl/core";
import type { MapboxOverlayProps } from "@deck.gl/mapbox";
import "maplibre-gl/dist/maplibre-gl.css";
import { CITY_LAYERS, FETCHERS, type PointData } from "@/lib/city-layers";
import LayerPanel from "./LayerPanel";
import CelestialClock from "./CelestialClock";
import SearchBar from "./SearchBar";
import AboutModal from "./AboutModal";

function DeckGLOverlay(
  props: MapboxOverlayProps & { onClick?: (info: PickingInfo) => void }
) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

const TORONTO_CENTER = {
  longitude: -79.3832,
  latitude: 43.6532,
  zoom: 11.5,
  pitch: 55,
  bearing: -20,
};

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const HOUR_LABELS = [
  "12 AM","1 AM","2 AM","3 AM","4 AM","5 AM",
  "6 AM","7 AM","8 AM","9 AM","10 AM","11 AM",
  "12 PM","1 PM","2 PM","3 PM","4 PM","5 PM",
  "6 PM","7 PM","8 PM","9 PM","10 PM","11 PM",
];
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface TicketLocation {
  location: string;
  lat: number;
  lng: number;
  total: number;
  avgFine: number;
  hourly: Record<string, number>;
  monthly: Record<string, number>;
  daily: Record<string, number>;
  topInfraction: string;
}

interface OccupancyLocation {
  location: string;
  lat: number;
  lng: number;
  carPark: string;
  totalSpaces: number;
  occupancy: number;
}

interface ParkingData {
  generated: string;
  totalTickets: number;
  locationCount: number;
  year: number;
  tickets: TicketLocation[];
  occupancy: OccupancyLocation[];
}

interface Building {
  p: number[][]; // polygon coordinates
  h: number;     // height in meters
}

type ViewMode = "hourly" | "daily" | "monthly";

function getTicketColor(count: number, max: number): [number, number, number, number] {
  const ratio = Math.min(count / max, 1);
  if (ratio < 0.33) {
    const t = ratio / 0.33;
    return [Math.round(16 + t * 234), Math.round(185 - t * 5), Math.round(129 - t * 129), 220];
  } else if (ratio < 0.66) {
    const t = (ratio - 0.33) / 0.33;
    return [250, Math.round(180 - t * 100), Math.round(t * 20), 220];
  }
  const t = (ratio - 0.66) / 0.34;
  return [250, Math.round(80 - t * 50), Math.round(20 - t * 20), 220];
}

function getOccupancyColor(occ: number): [number, number, number, number] {
  if (occ < 50) return [16, 185, 129, 200];
  if (occ < 75) return [250, 180, 0, 200];
  return [239, 68, 68, 200];
}

function getCountForTime(d: TicketLocation, viewMode: ViewMode, timeKey: string): number {
  const source = viewMode === "hourly" ? d.hourly : viewMode === "daily" ? d.daily : d.monthly;
  return source[timeKey] || 0;
}

// --- Sub-components ---

function MiniBarChart({ data, labels, activeIndex }: {
  data: Record<string, number>;
  labels: string[];
  activeIndex: number;
}) {
  const values = labels.map((_, i) => data[String(i)] || 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-16 mt-2">
      {values.map((val, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-200"
          style={{
            height: `${(val / max) * 100}%`,
            minHeight: val > 0 ? 2 : 0,
            backgroundColor: i === activeIndex ? "#10b981" : val > 0 ? "rgba(255,255,255,0.2)" : "transparent",
          }}
          title={`${labels[i]}: ${val}`}
        />
      ))}
    </div>
  );
}

function DetailPanel({ location, currentHour, onClose }: {
  location: TicketLocation;
  currentHour: number;
  onClose: () => void;
}) {
  const peakHour = Object.entries(location.hourly).reduce(
    (best, [h, c]) => (c > best[1] ? [h, c] : best), ["0", 0]
  );
  const peakDay = Object.entries(location.daily).reduce(
    (best, [d, c]) => (c > best[1] ? [d, c] : best), ["0", 0]
  );

  return (
    <div className="absolute top-20 right-4 z-20 w-72 bg-black/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-5 max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-emerald-400 font-bold text-lg leading-tight">{location.location}</div>
          <div className="text-zinc-500 text-xs mt-1">Toronto, ON</div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none ml-2">x</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-2xl font-bold">{location.total.toLocaleString()}</div>
          <div className="text-zinc-500 text-xs">Total Tickets</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-2xl font-bold">${location.avgFine || 0}</div>
          <div className="text-zinc-500 text-xs">Avg Fine</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-zinc-400 text-xs mb-1">Top Infraction</div>
        <div className="text-sm text-white leading-tight">{location.topInfraction}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-zinc-400 text-xs mb-1">Peak Time</div>
          <div className="text-sm text-white">{HOUR_LABELS[parseInt(peakHour[0])]}</div>
          <div className="text-zinc-500 text-xs">{peakHour[1].toLocaleString()} tickets</div>
        </div>
        <div>
          <div className="text-zinc-400 text-xs mb-1">Busiest Day</div>
          <div className="text-sm text-white">{DAY_LABELS[parseInt(peakDay[0])]}</div>
          <div className="text-zinc-500 text-xs">{peakDay[1].toLocaleString()} tickets</div>
        </div>
      </div>

      <div>
        <div className="text-zinc-400 text-xs mb-1">Hourly Distribution</div>
        <MiniBarChart data={location.hourly} labels={HOUR_LABELS} activeIndex={currentHour} />
        <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
          <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
        </div>
      </div>

      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.location + ", Toronto, ON")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-zinc-300 transition-colors"
      >
        View on Google Maps
      </a>
    </div>
  );
}

function TopLocations({ tickets, viewMode, timeKey, onSelect }: {
  tickets: TicketLocation[];
  viewMode: ViewMode;
  timeKey: string;
  onSelect: (loc: TicketLocation) => void;
}) {
  const [showRanking, setShowRanking] = useState(false);
  const ranked = useMemo(() => {
    return [...tickets]
      .map((t) => ({ ...t, currentCount: getCountForTime(t, viewMode, timeKey) }))
      .filter((t) => t.currentCount > 0)
      .sort((a, b) => b.currentCount - a.currentCount)
      .slice(0, 10);
  }, [tickets, viewMode, timeKey]);

  if (!showRanking) {
    return (
      <button
        onClick={() => setShowRanking(true)}
        className="absolute top-20 right-4 z-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-400 transition-colors"
      >
        Top 10
      </button>
    );
  }

  return (
    <div className="absolute top-20 right-4 z-10 w-64 bg-black/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-zinc-400">TOP 10 RIGHT NOW</div>
        <button onClick={() => setShowRanking(false)} className="text-zinc-500 hover:text-white text-sm">x</button>
      </div>
      {ranked.map((loc, i) => (
        <button
          key={loc.location}
          onClick={() => onSelect(loc)}
          className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-white/10 transition-colors text-left group"
        >
          <span className="text-xs text-zinc-600 w-4 tabular-nums">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white truncate group-hover:text-emerald-400 transition-colors">
              {loc.location}
            </div>
          </div>
          <span className="text-xs text-zinc-400 tabular-nums">{loc.currentCount.toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}

function StatsBar({ data, viewMode, timeKey }: {
  data: ParkingData;
  viewMode: ViewMode;
  timeKey: string;
}) {
  const { currentTotal, avgFine } = useMemo(() => {
    let total = 0;
    let fineSum = 0;
    let fineCount = 0;
    for (const t of data.tickets) {
      const count = getCountForTime(t, viewMode, timeKey);
      total += count;
      if (t.avgFine && count > 0) {
        fineSum += t.avgFine * count;
        fineCount += count;
      }
    }
    return {
      currentTotal: total,
      avgFine: fineCount > 0 ? Math.round(fineSum / fineCount) : 0,
    };
  }, [data, viewMode, timeKey]);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 bg-black/60 backdrop-blur-sm border border-zinc-800 rounded-full px-6 py-2">
      <div className="text-center">
        <div className="text-lg font-bold tabular-nums">{currentTotal.toLocaleString()}</div>
        <div className="text-[10px] text-zinc-500">tickets this {viewMode === "hourly" ? "hour" : viewMode === "daily" ? "day" : "month"}</div>
      </div>
      <div className="w-px h-8 bg-zinc-700" />
      <div className="text-center">
        <div className="text-lg font-bold tabular-nums">{data.locationCount}</div>
        <div className="text-[10px] text-zinc-500">locations</div>
      </div>
      <div className="w-px h-8 bg-zinc-700" />
      <div className="text-center">
        <div className="text-lg font-bold tabular-nums">${avgFine}</div>
        <div className="text-[10px] text-zinc-500">avg fine</div>
      </div>
    </div>
  );
}

// --- Main component ---

export default function ParkingMap() {
  const [data, setData] = useState<ParkingData | null>(null);
  const [buildings, setBuildings] = useState<Building[] | null>(null);
  const [currentHour, setCurrentHour] = useState(9);
  const [currentDay, setCurrentDay] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("hourly");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOccupancy, setShowOccupancy] = useState(false);
  const [showBuildings, setShowBuildings] = useState(true);
  const [hoveredInfo, setHoveredInfo] = useState<PickingInfo | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<TicketLocation | null>(null);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [layerData, setLayerData] = useState<globalThis.Map<string, PointData[]>>(() => new globalThis.Map());
  const [loadingLayers, setLoadingLayers] = useState<Set<string>>(new Set());
  const [hoveredCityPoint, setHoveredCityPoint] = useState<PointData | null>(null);
  const [currentZoom, setCurrentZoom] = useState(8);
  const [viewState, setViewState] = useState({
    ...TORONTO_CENTER,
    zoom: 8,
    pitch: 0,
    bearing: 0,
  });
  const [introComplete, setIntroComplete] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [neighbourhoods, setNeighbourhoods] = useState<GeoJSON.FeatureCollection | null>(null);
  const [showNeighbourhoods, setShowNeighbourhoods] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimers = useRef<globalThis.Map<string, ReturnType<typeof setInterval>>>(new globalThis.Map());

  useEffect(() => {
    fetch("/data/toronto-parking-2024.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
    fetch("/data/buildings-downtown.json")
      .then((r) => r.json())
      .then(setBuildings)
      .catch(console.error);
    fetch("/data/neighbourhoods.geojson")
      .then((r) => r.json())
      .then(setNeighbourhoods)
      .catch(console.error);

    // Intro fly-in: start zoomed out, swoop into Toronto after 500ms
    const timer = setTimeout(() => {
      mapRef.current?.flyTo({
        center: [TORONTO_CENTER.longitude, TORONTO_CENTER.latitude],
        zoom: TORONTO_CENTER.zoom,
        pitch: TORONTO_CENTER.pitch,
        bearing: TORONTO_CENTER.bearing,
        duration: 3000,
        essential: true,
      });
      setTimeout(() => setIntroComplete(true), 3200);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (viewMode === "hourly") setCurrentHour((h) => (h + 1) % 24);
          else if (viewMode === "daily") setCurrentDay((d) => (d + 1) % 7);
          else setCurrentMonth((m) => (m % 12) + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (viewMode === "hourly") setCurrentHour((h) => (h - 1 + 24) % 24);
          else if (viewMode === "daily") setCurrentDay((d) => (d - 1 + 7) % 7);
          else setCurrentMonth((m) => ((m - 2 + 12) % 12) + 1);
          break;
        case "l":
        case "L":
          setLayerPanelOpen((p) => !p);
          break;
        case "?":
          setShowAbout((p) => !p);
          break;
        case "Escape":
          setSelectedLocation(null);
          setShowAbout(false);
          setLayerPanelOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode]);

  // City layer data fetching
  const toggleLayer = useCallback((layerId: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
        // Clear refresh timer
        const timer = refreshTimers.current.get(layerId);
        if (timer) { clearInterval(timer); refreshTimers.current.delete(layerId); }
      } else {
        next.add(layerId);
        // Fetch data
        const fetcher = FETCHERS[layerId];
        if (fetcher) {
          setLoadingLayers((p) => new Set(p).add(layerId));
          fetcher().then((pts) => {
            setLayerData((m) => new globalThis.Map(m).set(layerId, pts));
          }).catch((err) => {
            console.warn(`Layer ${layerId} fetch failed:`, err);
          }).finally(() => {
            setLoadingLayers((p) => { const n = new Set(p); n.delete(layerId); return n; });
          });

          // Set up refresh for real-time layers
          const def = CITY_LAYERS.find((l) => l.id === layerId);
          if (def?.refreshInterval) {
            const timer = setInterval(() => {
              fetcher().then((pts) => {
                setLayerData((m) => new globalThis.Map(m).set(layerId, pts));
              }).catch(() => {}); // Silent fail on refresh
            }, def.refreshInterval);
            refreshTimers.current.set(layerId, timer);
          }
        }
      }
      return next;
    });
  }, []);

  // Cleanup refresh timers
  useEffect(() => {
    return () => {
      refreshTimers.current.forEach((timer) => clearInterval(timer));
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      if (viewMode === "hourly") setCurrentHour((h) => (h + 1) % 24);
      else if (viewMode === "daily") setCurrentDay((d) => (d + 1) % 7);
      else setCurrentMonth((m) => (m % 12) + 1);
    }, 800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, viewMode]);

  const timeKey = useMemo(() => {
    if (viewMode === "hourly") return String(currentHour);
    if (viewMode === "daily") return String(currentDay);
    return String(currentMonth);
  }, [viewMode, currentHour, currentDay, currentMonth]);

  const getTimeLabel = useCallback(() => {
    if (viewMode === "hourly") return HOUR_LABELS[currentHour];
    if (viewMode === "daily") return DAY_LABELS[currentDay];
    return MONTH_NAMES[currentMonth];
  }, [viewMode, currentHour, currentDay, currentMonth]);

  const maxCount = useMemo(() => {
    if (!data) return 1;
    let max = 0;
    for (const t of data.tickets) {
      const val = getCountForTime(t, viewMode, timeKey);
      if (val > max) max = val;
    }
    return max || 1;
  }, [data, viewMode, timeKey]);

  const layers = useMemo(() => {
    if (!data) return [];
    const result = [];

    // 3D building massing backdrop
    if (showBuildings && buildings) {
      result.push(
        new PolygonLayer({
          id: "buildings",
          data: buildings,
          extruded: true,
          wireframe: false,
          getPolygon: (d: Building) => d.p,
          getElevation: (d: Building) => d.h,
          getFillColor: [30, 30, 35, 160],
          getLineColor: [40, 40, 50, 80],
          elevationScale: 1,
          material: {
            ambient: 0.3,
            diffuse: 0.6,
            shininess: 20,
          },
        })
      );
    }

    // Neighbourhood boundaries
    if (showNeighbourhoods && neighbourhoods) {
      result.push(
        new GeoJsonLayer({
          id: "neighbourhoods",
          data: neighbourhoods,
          stroked: true,
          filled: false,
          getLineColor: [255, 255, 255, 40],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          pickable: true,
        })
      );
    }

    // Zoom-adaptive: heatmap at city zoom, columns when close
    const useHeatmap = currentZoom < 12;

    if (useHeatmap) {
      result.push(
        new HeatmapLayer({
          id: "ticket-heatmap",
          data: data.tickets,
          getPosition: (d: TicketLocation) => [d.lng, d.lat],
          getWeight: (d: TicketLocation) => getCountForTime(d, viewMode, timeKey),
          radiusPixels: 40,
          intensity: 2,
          threshold: 0.05,
          colorRange: [
            [16, 185, 129, 50],
            [34, 197, 94, 100],
            [250, 180, 0, 150],
            [249, 115, 22, 200],
            [239, 68, 68, 230],
          ],
          updateTriggers: {
            getWeight: [timeKey, viewMode],
          },
        })
      );
    } else {
      result.push(
        new ColumnLayer({
          id: "ticket-columns",
          data: data.tickets,
          diskResolution: 12,
          radius: currentZoom > 14 ? 40 : currentZoom > 13 ? 60 : 90,
          extruded: true,
          elevationScale: currentZoom > 14 ? 8 : 15,
          getPosition: (d: TicketLocation) => [d.lng, d.lat],
          getFillColor: (d: TicketLocation) => {
            if (selectedLocation && d.location === selectedLocation.location) return [255, 255, 255, 255];
            return getTicketColor(getCountForTime(d, viewMode, timeKey), maxCount);
          },
          getElevation: (d: TicketLocation) => getCountForTime(d, viewMode, timeKey),
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 60],
          updateTriggers: {
            getFillColor: [timeKey, maxCount, viewMode, selectedLocation?.location],
            getElevation: [timeKey, viewMode],
          },
          transitions: {
            getElevation: { duration: 600, easing: (t: number) => t * (2 - t) },
            getFillColor: { duration: 500, easing: (t: number) => t * (2 - t) },
          },
        })
      );
    }

    if (showOccupancy && data.occupancy.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: "occupancy-dots",
          data: data.occupancy,
          getPosition: (d: OccupancyLocation) => [d.lng, d.lat],
          getFillColor: (d: OccupancyLocation) => getOccupancyColor(d.occupancy),
          getRadius: (d: OccupancyLocation) => Math.max(30, d.totalSpaces / 3),
          pickable: true,
          radiusMinPixels: 4,
          radiusMaxPixels: 20,
        })
      );
    }

    // --- City data layers with unique visual treatments ---

    // TTC Vehicles — directional arrows showing heading
    if (activeLayers.has("ttc") && layerData.get("ttc")?.length) {
      const ttcData = layerData.get("ttc")!;
      // Glow trail behind each vehicle
      result.push(
        new ScatterplotLayer({
          id: "city-ttc-glow",
          data: ttcData,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: [220, 38, 38, 50],
          getRadius: 150,
          radiusMinPixels: 6,
          radiusMaxPixels: 20,
        })
      );
      // Arrow body — small triangles computed from heading
      result.push(
        new PolygonLayer({
          id: "city-ttc",
          data: ttcData,
          getPolygon: (d: PointData) => {
            const heading = ((d.extra?.heading as number) || 0) * (Math.PI / 180);
            const lat = d.lat;
            const lng = d.lng;
            const size = 0.0008; // arrow size in degrees
            const tipX = lng + Math.sin(heading) * size;
            const tipY = lat + Math.cos(heading) * size;
            const leftX = lng + Math.sin(heading - 2.5) * size * 0.5;
            const leftY = lat + Math.cos(heading - 2.5) * size * 0.5;
            const rightX = lng + Math.sin(heading + 2.5) * size * 0.5;
            const rightY = lat + Math.cos(heading + 2.5) * size * 0.5;
            return [[tipX, tipY], [leftX, leftY], [rightX, rightY]];
          },
          getFillColor: (d: PointData) => {
            const speed = (d.extra?.speed as number) || 0;
            if (speed > 30) return [220, 38, 38, 230]; // fast — bright red
            if (speed > 10) return [249, 115, 22, 220]; // moving — orange
            return [250, 180, 0, 200]; // slow/stopped — yellow
          },
          getLineColor: [255, 255, 255, 80],
          lineWidthMinPixels: 1,
          stroked: true,
          extruded: false,
          pickable: true,
        })
      );
    }

    // Bike Share — sized by availability, colored by fill ratio
    if (activeLayers.has("bikeshare") && layerData.get("bikeshare")?.length) {
      result.push(
        new ScatterplotLayer({
          id: "city-bikeshare",
          data: layerData.get("bikeshare")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: (d: PointData) => {
            const bikes = (d.extra?.bikes as number) || 0;
            const capacity = (d.extra?.capacity as number) || 1;
            const ratio = bikes / capacity;
            if (ratio > 0.5) return [34, 197, 94, 200]; // green — plenty
            if (ratio > 0.2) return [250, 180, 0, 200]; // yellow — getting low
            return [239, 68, 68, 200]; // red — almost empty
          },
          getRadius: (d: PointData) => {
            const capacity = (d.extra?.capacity as number) || 10;
            return Math.max(30, capacity * 2);
          },
          pickable: true,
          radiusMinPixels: 3,
          radiusMaxPixels: 14,
          stroked: true,
          getLineColor: [255, 255, 255, 60],
          lineWidthMinPixels: 1,
        })
      );
    }

    // Collisions — HEATMAP, not dots
    if (activeLayers.has("collisions") && layerData.get("collisions")?.length) {
      result.push(
        new HeatmapLayer({
          id: "city-collisions",
          data: layerData.get("collisions")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getWeight: 1,
          radiusPixels: 30,
          intensity: 1.5,
          threshold: 0.1,
          colorRange: [
            [255, 255, 178, 25],
            [254, 204, 92, 85],
            [253, 141, 60, 150],
            [240, 59, 32, 200],
            [189, 0, 38, 230],
          ],
        })
      );
    }

    // Fire Stations — large orange beacons with outer ring
    if (activeLayers.has("fire_stations") && layerData.get("fire_stations")?.length) {
      // Outer pulse ring
      result.push(
        new ScatterplotLayer({
          id: "city-fire_stations-ring",
          data: layerData.get("fire_stations")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: [234, 88, 12, 0],
          getRadius: 200,
          stroked: true,
          getLineColor: [234, 88, 12, 80],
          lineWidthMinPixels: 2,
          radiusMinPixels: 10,
          radiusMaxPixels: 30,
        })
      );
      // Core dot
      result.push(
        new ScatterplotLayer({
          id: "city-fire_stations",
          data: layerData.get("fire_stations")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: [234, 88, 12, 240],
          getRadius: 80,
          pickable: true,
          radiusMinPixels: 5,
          radiusMaxPixels: 12,
        })
      );
    }

    // Red Light Cameras — red diamonds (small, sharp)
    if (activeLayers.has("red_light_cameras") && layerData.get("red_light_cameras")?.length) {
      result.push(
        new ScatterplotLayer({
          id: "city-red_light_cameras",
          data: layerData.get("red_light_cameras")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: [239, 68, 68, 200],
          getRadius: 50,
          pickable: true,
          radiusMinPixels: 3,
          radiusMaxPixels: 8,
          stroked: true,
          getLineColor: [255, 100, 100, 150],
          lineWidthMinPixels: 1,
        })
      );
    }

    // Speed Cameras — purple with glow ring
    if (activeLayers.has("speed_cameras") && layerData.get("speed_cameras")?.length) {
      result.push(
        new ScatterplotLayer({
          id: "city-speed_cameras-glow",
          data: layerData.get("speed_cameras")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: [168, 85, 247, 40],
          getRadius: 150,
          radiusMinPixels: 6,
          radiusMaxPixels: 18,
        })
      );
      result.push(
        new ScatterplotLayer({
          id: "city-speed_cameras",
          data: layerData.get("speed_cameras")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: [168, 85, 247, 220],
          getRadius: 50,
          pickable: true,
          radiusMinPixels: 3,
          radiusMaxPixels: 8,
        })
      );
    }

    // Road Closures — large orange warning markers
    if (activeLayers.has("road_closures") && layerData.get("road_closures")?.length) {
      result.push(
        new ScatterplotLayer({
          id: "city-road_closures",
          data: layerData.get("road_closures")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: [249, 115, 22, 200],
          getRadius: 100,
          pickable: true,
          radiusMinPixels: 5,
          radiusMaxPixels: 14,
          stroked: true,
          getLineColor: [255, 200, 50, 150],
          lineWidthMinPixels: 2,
        })
      );
    }

    // Traffic Cameras — cyan dots
    if (activeLayers.has("traffic_cameras") && layerData.get("traffic_cameras")?.length) {
      result.push(
        new ScatterplotLayer({
          id: "city-traffic_cameras",
          data: layerData.get("traffic_cameras")!,
          getPosition: (d: PointData) => [d.lng, d.lat],
          getFillColor: [59, 130, 246, 180],
          getRadius: 50,
          pickable: true,
          radiusMinPixels: 3,
          radiusMaxPixels: 8,
          stroked: true,
          getLineColor: [100, 180, 255, 100],
          lineWidthMinPixels: 1,
        })
      );
    }

    return result;
  }, [data, buildings, neighbourhoods, viewMode, timeKey, maxCount, showOccupancy, showBuildings, showNeighbourhoods, selectedLocation, activeLayers, layerData, currentZoom]);

  const onHover = useCallback((info: PickingInfo) => {
    setHoveredInfo(info.object ? info : null);
    // Check if hovering a city layer point
    if (info.layer?.id?.startsWith("city-") && info.object) {
      setHoveredCityPoint(info.object as PointData);
    } else {
      setHoveredCityPoint(null);
    }
  }, []);

  const onClick = useCallback((info: PickingInfo) => {
    if (info.layer?.id === "ticket-columns" && info.object) {
      setSelectedLocation(info.object as TicketLocation);
    } else {
      setSelectedLocation(null);
    }
  }, []);

  if (!data) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">Loading Toronto Parking Data...</div>
          <div className="text-zinc-500 text-sm">2.8M+ tickets visualized</div>
        </div>
      </div>
    );
  }

  const hoveredTicket = hoveredInfo?.object as TicketLocation | undefined;
  const hoveredOccupancy = hoveredInfo?.layer?.id === "occupancy-dots"
    ? (hoveredInfo?.object as OccupancyLocation | undefined)
    : undefined;

  return (
    <div className="relative h-screen w-screen">
      {/* Celestial sun/moon orbit */}
      <CelestialClock hour={currentHour} isAnimating={isPlaying} />

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => {
          setViewState(evt.viewState);
          setCurrentZoom(evt.viewState.zoom);
        }}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckGLOverlay layers={layers} onHover={onHover} onClick={onClick} interleaved />
      </Map>

      {/* Title + Controls — fade in after intro */}
      <div className={`absolute top-4 left-4 z-10 transition-opacity duration-1000 ${introComplete ? "opacity-100" : "opacity-0"}`}>
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white/90">Toronto City Pulse</h1>
        <p className="text-zinc-500 text-[11px] sm:text-xs mt-0.5 tracking-wide">
          {data.totalTickets.toLocaleString()} tickets | {data.locationCount} locations | {activeLayers.size} live layers
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setLayerPanelOpen(!layerPanelOpen)}
            className="flex items-center gap-1.5 bg-white/8 hover:bg-white/15 backdrop-blur-sm border border-zinc-700/40 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all duration-200"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Layers
          </button>
          <SearchBar
            onSelect={(r) => {
              mapRef.current?.flyTo({
                center: [r.lng, r.lat],
                zoom: 15,
                pitch: 50,
                duration: 2000,
                essential: true,
              });
            }}
          />
        </div>
      </div>

      {/* Layer Panel */}
      <LayerPanel
        activeLayers={activeLayers}
        layerData={layerData}
        loadingLayers={loadingLayers}
        onToggle={toggleLayer}
        showBuildings={showBuildings}
        onToggleBuildings={setShowBuildings}
        showOccupancy={showOccupancy}
        onToggleOccupancy={setShowOccupancy}
        showNeighbourhoods={showNeighbourhoods}
        onToggleNeighbourhoods={setShowNeighbourhoods}
        isOpen={layerPanelOpen}
        onClose={() => setLayerPanelOpen(false)}
      />

      {/* Stats bar */}
      <StatsBar data={data} viewMode={viewMode} timeKey={timeKey} />

      {/* Time display + about */}
      <div className="absolute top-4 right-4 z-10 text-right">
        <div className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tighter text-white/90">{getTimeLabel()}</div>
        <div className="text-zinc-600 text-[10px] sm:text-xs mt-0.5 tracking-wide uppercase">
          {viewMode === "hourly" ? "Time of Day" : viewMode === "daily" ? "Day of Week" : "Month"} | 2024
        </div>
        <button
          onClick={() => setShowAbout(true)}
          className="mt-2 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          About (?)
        </button>
      </div>

      {/* About modal */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />

      {/* Top 10 ranking */}
      <TopLocations
        tickets={data.tickets}
        viewMode={viewMode}
        timeKey={timeKey}
        onSelect={setSelectedLocation}
      />

      {/* Detail panel */}
      {selectedLocation && (
        <DetailPanel
          location={selectedLocation}
          currentHour={currentHour}
          onClose={() => setSelectedLocation(null)}
        />
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-4 sm:pb-5 px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-0.5 bg-white/8 rounded-lg p-0.5">
            {(["hourly", "daily", "monthly"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                  viewMode === mode ? "bg-emerald-500/90 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 border border-zinc-700/30 transition-all duration-200 flex-shrink-0"
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="white">
                <rect x="1" y="0" width="4" height="14" />
                <rect x="9" y="0" width="4" height="14" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="white">
                <polygon points="2,0 14,7 2,14" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min={viewMode === "monthly" ? 1 : 0}
            max={viewMode === "hourly" ? 23 : viewMode === "daily" ? 6 : 12}
            value={viewMode === "hourly" ? currentHour : viewMode === "daily" ? currentDay : currentMonth}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (viewMode === "hourly") setCurrentHour(val);
              else if (viewMode === "daily") setCurrentDay(val);
              else setCurrentMonth(val);
            }}
            className="flex-1"
          />
        </div>

        <div className="flex items-center justify-between mt-2 sm:mt-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Low</span>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div className="w-6 sm:w-8 bg-emerald-500" />
              <div className="w-6 sm:w-8 bg-yellow-400" />
              <div className="w-6 sm:w-8 bg-orange-500" />
              <div className="w-6 sm:w-8 bg-red-500" />
            </div>
            <span>High</span>
            <span className="hidden sm:inline ml-4 text-zinc-600">Click a bar for details</span>
          </div>
          <div className="text-[10px] sm:text-xs text-zinc-600">
            Data: Toronto Open Data | Built by DareDev256
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredInfo && hoveredInfo.x != null && hoveredTicket && !hoveredOccupancy && !selectedLocation && (
        <div
          className="absolute z-20 pointer-events-none bg-black/90 border border-zinc-700 rounded-lg px-4 py-3 text-sm max-w-xs"
          style={{ left: hoveredInfo.x + 12, top: Math.min(hoveredInfo.y - 12, window.innerHeight - 120) }}
        >
          <div className="font-bold text-emerald-400 mb-1">{hoveredTicket.location}</div>
          <div className="text-zinc-300">{hoveredTicket.total.toLocaleString()} tickets (2024)</div>
          <div className="text-zinc-500 text-xs mt-1">Top: {hoveredTicket.topInfraction}</div>
          <div className="text-zinc-600 text-xs mt-1">Click for details</div>
        </div>
      )}

      {hoveredInfo && hoveredInfo.x != null && hoveredOccupancy && (
        <div
          className="absolute z-20 pointer-events-none bg-black/90 border border-zinc-700 rounded-lg px-4 py-3 text-sm max-w-xs"
          style={{ left: hoveredInfo.x + 12, top: hoveredInfo.y - 12 }}
        >
          <div className="font-bold text-emerald-400 mb-1">{hoveredOccupancy.carPark} — {hoveredOccupancy.location}</div>
          <div className="text-zinc-300">{hoveredOccupancy.occupancy}% peak occupancy</div>
          <div className="text-zinc-500 text-xs mt-1">{hoveredOccupancy.totalSpaces} total spaces</div>
        </div>
      )}

      {/* City layer hover tooltip */}
      {hoveredInfo && hoveredInfo.x != null && hoveredCityPoint && (
        <div
          className="absolute z-20 pointer-events-none bg-black/90 border border-zinc-700 rounded-lg px-4 py-3 text-sm max-w-xs"
          style={{ left: hoveredInfo.x + 12, top: Math.min(hoveredInfo.y - 12, (typeof window !== "undefined" ? window.innerHeight : 800) - 100) }}
        >
          <div className="font-bold text-white mb-1">{hoveredCityPoint.label}</div>
          {hoveredCityPoint.detail && (
            <div className="text-zinc-400 text-xs">{hoveredCityPoint.detail}</div>
          )}
        </div>
      )}
    </div>
  );
}
