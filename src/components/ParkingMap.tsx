"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Map, useControl } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { MapboxOverlayProps } from "@deck.gl/mapbox";
import "maplibre-gl/dist/maplibre-gl.css";

function DeckGLOverlay(props: MapboxOverlayProps) {
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
  "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";

const HOUR_LABELS = [
  "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM",
  "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM",
  "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM",
  "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface TicketLocation {
  location: string;
  lat: number;
  lng: number;
  total: number;
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

type ViewMode = "hourly" | "daily" | "monthly";

function getTicketColor(count: number, max: number): [number, number, number, number] {
  const ratio = Math.min(count / max, 1);
  if (ratio < 0.33) {
    // Green to yellow
    const t = ratio / 0.33;
    return [Math.round(16 + t * 234), Math.round(185 - t * 5), Math.round(129 - t * 129), 220];
  } else if (ratio < 0.66) {
    // Yellow to orange
    const t = (ratio - 0.33) / 0.33;
    return [250, Math.round(180 - t * 100), Math.round(t * 20), 220];
  } else {
    // Orange to red
    const t = (ratio - 0.66) / 0.34;
    return [250, Math.round(80 - t * 50), Math.round(20 - t * 20), 220];
  }
}

function getOccupancyColor(occupancy: number): [number, number, number, number] {
  if (occupancy < 50) return [16, 185, 129, 200]; // green
  if (occupancy < 75) return [250, 180, 0, 200]; // yellow
  return [239, 68, 68, 200]; // red
}

export default function ParkingMap() {
  const [data, setData] = useState<ParkingData | null>(null);
  const [currentHour, setCurrentHour] = useState(9);
  const [currentDay, setCurrentDay] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("hourly");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOccupancy, setShowOccupancy] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState<PickingInfo | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/data/toronto-parking-2024.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      if (viewMode === "hourly") {
        setCurrentHour((h) => (h + 1) % 24);
      } else if (viewMode === "daily") {
        setCurrentDay((d) => (d + 1) % 7);
      } else {
        setCurrentMonth((m) => (m % 12) + 1);
      }
    }, 800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, viewMode]);

  const getSliderValue = useCallback(() => {
    if (viewMode === "hourly") return currentHour;
    if (viewMode === "daily") return currentDay;
    return currentMonth;
  }, [viewMode, currentHour, currentDay, currentMonth]);

  const getSliderMax = useCallback(() => {
    if (viewMode === "hourly") return 23;
    if (viewMode === "daily") return 6;
    return 12;
  }, [viewMode]);

  const getSliderMin = useCallback(() => {
    if (viewMode === "monthly") return 1;
    return 0;
  }, [viewMode]);

  const getTimeLabel = useCallback(() => {
    if (viewMode === "hourly") return HOUR_LABELS[currentHour];
    if (viewMode === "daily") return DAY_LABELS[currentDay];
    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthNames[currentMonth];
  }, [viewMode, currentHour, currentDay, currentMonth]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      if (viewMode === "hourly") setCurrentHour(val);
      else if (viewMode === "daily") setCurrentDay(val);
      else setCurrentMonth(val);
    },
    [viewMode]
  );

  // Compute max for current view to normalize heights
  const maxCount = useMemo(() => {
    if (!data) return 1;
    const key = viewMode === "hourly" ? String(currentHour) : viewMode === "daily" ? String(currentDay) : String(currentMonth);
    let max = 0;
    for (const t of data.tickets) {
      const source = viewMode === "hourly" ? t.hourly : viewMode === "daily" ? t.daily : t.monthly;
      const val = source[key] || 0;
      if (val > max) max = val;
    }
    return max || 1;
  }, [data, viewMode, currentHour, currentDay, currentMonth]);

  const layers = useMemo(() => {
    if (!data) return [];
    const result = [];

    const timeKey =
      viewMode === "hourly"
        ? String(currentHour)
        : viewMode === "daily"
        ? String(currentDay)
        : String(currentMonth);

    // Ticket columns
    result.push(
      new ColumnLayer({
        id: "ticket-columns",
        data: data.tickets,
        diskResolution: 8,
        radius: 120,
        extruded: true,
        elevationScale: 15,
        getPosition: (d: TicketLocation) => [d.lng, d.lat],
        getFillColor: (d: TicketLocation) => {
          const source = viewMode === "hourly" ? d.hourly : viewMode === "daily" ? d.daily : d.monthly;
          const count = source[timeKey] || 0;
          return getTicketColor(count, maxCount);
        },
        getElevation: (d: TicketLocation) => {
          const source = viewMode === "hourly" ? d.hourly : viewMode === "daily" ? d.daily : d.monthly;
          const count = source[timeKey] || 0;
          return count;
        },
        pickable: true,
        updateTriggers: {
          getFillColor: [timeKey, maxCount, viewMode],
          getElevation: [timeKey, viewMode],
        },
        transitions: {
          getElevation: { duration: 400, type: "interpolation" },
          getFillColor: { duration: 400, type: "interpolation" },
        },
      })
    );

    // Occupancy dots
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

    return result;
  }, [data, viewMode, currentHour, currentDay, currentMonth, maxCount, showOccupancy]);

  const onHover = useCallback((info: PickingInfo) => {
    setHoveredInfo(info.object ? info : null);
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
      <Map
        initialViewState={TORONTO_CENTER}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckGLOverlay layers={layers} onHover={onHover} interleaved />
      </Map>

      {/* Title overlay */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-2xl font-bold tracking-tight">
          Toronto Parking Activity
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          {data.totalTickets.toLocaleString()} tickets across{" "}
          {data.locationCount} locations | 2024
        </p>
      </div>

      {/* Time display */}
      <div className="absolute top-4 right-4 z-10 text-right">
        <div className="text-5xl font-bold tabular-nums tracking-tight">
          {getTimeLabel()}
        </div>
        <div className="text-zinc-500 text-sm mt-1">
          {viewMode === "hourly" ? "Time of Day" : viewMode === "daily" ? "Day of Week" : "Month"} | 2024
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-6 px-6">
        {/* View mode tabs */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex gap-1 bg-white/10 rounded-lg p-1">
            {(["hourly", "daily", "monthly"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-emerald-500 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showOccupancy}
              onChange={(e) => setShowOccupancy(e.target.checked)}
              className="accent-emerald-500"
            />
            Green P Occupancy
          </label>
        </div>

        {/* Slider + play */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                <rect x="1" y="0" width="4" height="14" />
                <rect x="9" y="0" width="4" height="14" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                <polygon points="2,0 14,7 2,14" />
              </svg>
            )}
          </button>

          <input
            type="range"
            min={getSliderMin()}
            max={getSliderMax()}
            value={getSliderValue()}
            onChange={handleSliderChange}
            className="flex-1"
          />

          {/* Hour markers for hourly view */}
          {viewMode === "hourly" && (
            <div className="hidden sm:flex gap-0 text-[10px] text-zinc-600 absolute bottom-20 left-20 right-6">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="flex-1 text-center">
                  {i % 3 === 0 ? `${i}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Low</span>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div className="w-8 bg-emerald-500" />
              <div className="w-8 bg-yellow-400" />
              <div className="w-8 bg-orange-500" />
              <div className="w-8 bg-red-500" />
            </div>
            <span>High</span>
          </div>
          <div className="text-xs text-zinc-600">
            Data: Toronto Open Data | Built by DareDev256
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredInfo && hoveredInfo.x != null && hoveredTicket && !hoveredOccupancy && (
        <div
          className="absolute z-20 pointer-events-none bg-black/90 border border-zinc-700 rounded-lg px-4 py-3 text-sm max-w-xs"
          style={{ left: hoveredInfo.x + 12, top: hoveredInfo.y - 12 }}
        >
          <div className="font-bold text-emerald-400 mb-1">
            {hoveredTicket.location}
          </div>
          <div className="text-zinc-300">
            {hoveredTicket.total.toLocaleString()} tickets (2024)
          </div>
          <div className="text-zinc-500 text-xs mt-1">
            Top: {hoveredTicket.topInfraction}
          </div>
        </div>
      )}

      {hoveredInfo && hoveredInfo.x != null && hoveredOccupancy && (
        <div
          className="absolute z-20 pointer-events-none bg-black/90 border border-zinc-700 rounded-lg px-4 py-3 text-sm max-w-xs"
          style={{ left: hoveredInfo.x + 12, top: hoveredInfo.y - 12 }}
        >
          <div className="font-bold text-emerald-400 mb-1">
            {hoveredOccupancy.carPark} — {hoveredOccupancy.location}
          </div>
          <div className="text-zinc-300">
            {hoveredOccupancy.occupancy}% peak occupancy
          </div>
          <div className="text-zinc-500 text-xs mt-1">
            {hoveredOccupancy.totalSpaces} total spaces
          </div>
        </div>
      )}
    </div>
  );
}
