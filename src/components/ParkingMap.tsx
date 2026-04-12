"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Map, useControl } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { MapboxOverlayProps } from "@deck.gl/mapbox";
import "maplibre-gl/dist/maplibre-gl.css";

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

// Dark matter WITH labels — shows street names so Toronto looks real
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const HOUR_LABELS = [
  "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM",
  "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM",
  "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM",
  "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

type ViewMode = "hourly" | "daily" | "monthly";

function getTicketColor(
  count: number,
  max: number
): [number, number, number, number] {
  const ratio = Math.min(count / max, 1);
  if (ratio < 0.33) {
    const t = ratio / 0.33;
    return [
      Math.round(16 + t * 234),
      Math.round(185 - t * 5),
      Math.round(129 - t * 129),
      220,
    ];
  } else if (ratio < 0.66) {
    const t = (ratio - 0.33) / 0.33;
    return [250, Math.round(180 - t * 100), Math.round(t * 20), 220];
  } else {
    const t = (ratio - 0.66) / 0.34;
    return [250, Math.round(80 - t * 50), Math.round(20 - t * 20), 220];
  }
}

function getOccupancyColor(
  occupancy: number
): [number, number, number, number] {
  if (occupancy < 50) return [16, 185, 129, 200];
  if (occupancy < 75) return [250, 180, 0, 200];
  return [239, 68, 68, 200];
}

// Mini bar chart for the detail panel
function MiniBarChart({
  data,
  labels,
  activeIndex,
}: {
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
            backgroundColor:
              i === activeIndex
                ? "#10b981"
                : val > 0
                ? "rgba(255,255,255,0.2)"
                : "transparent",
          }}
          title={`${labels[i]}: ${val}`}
        />
      ))}
    </div>
  );
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
  const [selectedLocation, setSelectedLocation] =
    useState<TicketLocation | null>(null);
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
    return MONTH_NAMES[currentMonth];
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

  const maxCount = useMemo(() => {
    if (!data) return 1;
    const key =
      viewMode === "hourly"
        ? String(currentHour)
        : viewMode === "daily"
        ? String(currentDay)
        : String(currentMonth);
    let max = 0;
    for (const t of data.tickets) {
      const source =
        viewMode === "hourly"
          ? t.hourly
          : viewMode === "daily"
          ? t.daily
          : t.monthly;
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
          const source =
            viewMode === "hourly"
              ? d.hourly
              : viewMode === "daily"
              ? d.daily
              : d.monthly;
          const count = source[timeKey] || 0;
          // Highlight selected location
          if (selectedLocation && d.location === selectedLocation.location) {
            return [255, 255, 255, 255];
          }
          return getTicketColor(count, maxCount);
        },
        getElevation: (d: TicketLocation) => {
          const source =
            viewMode === "hourly"
              ? d.hourly
              : viewMode === "daily"
              ? d.daily
              : d.monthly;
          return source[timeKey] || 0;
        },
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
        updateTriggers: {
          getFillColor: [timeKey, maxCount, viewMode, selectedLocation?.location],
          getElevation: [timeKey, viewMode],
        },
        transitions: {
          getElevation: { duration: 400, type: "interpolation" },
          getFillColor: { duration: 400, type: "interpolation" },
        },
      })
    );

    if (showOccupancy && data.occupancy.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: "occupancy-dots",
          data: data.occupancy,
          getPosition: (d: OccupancyLocation) => [d.lng, d.lat],
          getFillColor: (d: OccupancyLocation) =>
            getOccupancyColor(d.occupancy),
          getRadius: (d: OccupancyLocation) =>
            Math.max(30, d.totalSpaces / 3),
          pickable: true,
          radiusMinPixels: 4,
          radiusMaxPixels: 20,
        })
      );
    }

    return result;
  }, [
    data,
    viewMode,
    currentHour,
    currentDay,
    currentMonth,
    maxCount,
    showOccupancy,
    selectedLocation,
  ]);

  const onHover = useCallback((info: PickingInfo) => {
    setHoveredInfo(info.object ? info : null);
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
          <div className="text-2xl font-bold mb-2">
            Loading Toronto Parking Data...
          </div>
          <div className="text-zinc-500 text-sm">2.8M+ tickets visualized</div>
        </div>
      </div>
    );
  }

  const hoveredTicket = hoveredInfo?.object as TicketLocation | undefined;
  const hoveredOccupancy =
    hoveredInfo?.layer?.id === "occupancy-dots"
      ? (hoveredInfo?.object as OccupancyLocation | undefined)
      : undefined;

  // Peak hour for selected location
  const selectedPeakHour = selectedLocation
    ? Object.entries(selectedLocation.hourly).reduce(
        (best, [h, c]) => (c > best[1] ? [h, c] : best),
        ["0", 0]
      )
    : null;

  const selectedPeakDay = selectedLocation
    ? Object.entries(selectedLocation.daily).reduce(
        (best, [d, c]) => (c > best[1] ? [d, c] : best),
        ["0", 0]
      )
    : null;

  return (
    <div className="relative h-screen w-screen">
      <Map
        initialViewState={TORONTO_CENTER}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckGLOverlay
          layers={layers}
          onHover={onHover}
          onClick={onClick}
          interleaved
        />
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
          {viewMode === "hourly"
            ? "Time of Day"
            : viewMode === "daily"
            ? "Day of Week"
            : "Month"}{" "}
          | 2024
        </div>
      </div>

      {/* Selected location detail panel */}
      {selectedLocation && (
        <div className="absolute top-20 right-4 z-20 w-72 bg-black/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-emerald-400 font-bold text-lg leading-tight">
                {selectedLocation.location}
              </div>
              <div className="text-zinc-500 text-xs mt-1">Toronto, ON</div>
            </div>
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-zinc-500 hover:text-white text-lg leading-none ml-2"
            >
              x
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-2xl font-bold">
                {selectedLocation.total.toLocaleString()}
              </div>
              <div className="text-zinc-500 text-xs">Total Tickets</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-2xl font-bold">
                ${selectedLocation.avgFine || 0}
              </div>
              <div className="text-zinc-500 text-xs">Avg Fine</div>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-zinc-400 text-xs mb-1">Top Infraction</div>
            <div className="text-sm text-white leading-tight">
              {selectedLocation.topInfraction}
            </div>
          </div>

          {selectedPeakHour && (
            <div className="mb-3">
              <div className="text-zinc-400 text-xs mb-1">Peak Time</div>
              <div className="text-sm text-white">
                {HOUR_LABELS[parseInt(selectedPeakHour[0])]} (
                {selectedPeakHour[1].toLocaleString()} tickets)
              </div>
            </div>
          )}

          {selectedPeakDay && (
            <div className="mb-3">
              <div className="text-zinc-400 text-xs mb-1">Busiest Day</div>
              <div className="text-sm text-white">
                {DAY_LABELS[parseInt(selectedPeakDay[0])]} (
                {selectedPeakDay[1].toLocaleString()} tickets)
              </div>
            </div>
          )}

          {/* Hourly distribution mini chart */}
          <div>
            <div className="text-zinc-400 text-xs mb-1">
              Hourly Distribution
            </div>
            <MiniBarChart
              data={selectedLocation.hourly}
              labels={HOUR_LABELS}
              activeIndex={currentHour}
            />
            <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>12am</span>
            </div>
          </div>

          {/* Google Maps link */}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLocation.location + ", Toronto, ON")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-zinc-300 transition-colors"
          >
            View on Google Maps
          </a>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-6 px-6">
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
            <span className="ml-4 text-zinc-600">Click a bar for details</span>
          </div>
          <div className="text-xs text-zinc-600">
            Data: Toronto Open Data | Built by DareDev256
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredInfo &&
        hoveredInfo.x != null &&
        hoveredTicket &&
        !hoveredOccupancy &&
        !selectedLocation && (
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
            <div className="text-zinc-600 text-xs mt-1">Click for details</div>
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
