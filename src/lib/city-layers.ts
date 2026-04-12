/**
 * Toronto City Intelligence — Data Layer Definitions & Fetchers
 * Each layer has: id, name, fetcher, color, icon, and deck.gl layer config
 */

export interface CityLayerDef {
  id: string;
  name: string;
  category: "safety" | "transit" | "infrastructure" | "enforcement";
  color: [number, number, number];
  description: string;
  refreshInterval?: number; // ms, if real-time
}

export const CITY_LAYERS: CityLayerDef[] = [
  {
    id: "ttc",
    name: "TTC Vehicles",
    category: "transit",
    color: [220, 38, 38],
    description: "Live TTC bus & streetcar positions (~900 vehicles)",
    refreshInterval: 15000,
  },
  {
    id: "bikeshare",
    name: "Bike Share",
    category: "transit",
    color: [34, 197, 94],
    description: "1,031 stations with real-time bike/dock availability",
    refreshInterval: 30000,
  },
  {
    id: "road_closures",
    name: "Road Closures",
    category: "infrastructure",
    color: [249, 115, 22],
    description: "Active road restrictions and closures",
  },
  {
    id: "red_light_cameras",
    name: "Red Light Cameras",
    category: "enforcement",
    color: [239, 68, 68],
    description: "296 red light camera intersections",
  },
  {
    id: "speed_cameras",
    name: "Speed Cameras",
    category: "enforcement",
    color: [168, 85, 247],
    description: "198 automated speed enforcement locations",
  },
  {
    id: "traffic_cameras",
    name: "Traffic Cameras",
    category: "infrastructure",
    color: [59, 130, 246],
    description: "336 live traffic camera feeds",
  },
  {
    id: "collisions",
    name: "Collisions (KSI)",
    category: "safety",
    color: [239, 68, 68],
    description: "20,457 killed/seriously injured collision records",
  },
  {
    id: "fire_stations",
    name: "Fire Stations",
    category: "safety",
    color: [234, 88, 12],
    description: "85 Toronto Fire Services stations",
  },
];

export interface PointData {
  lat: number;
  lng: number;
  label: string;
  detail?: string;
  extra?: Record<string, unknown>;
}

// --- Fetchers ---

function parseGeometry(g: string | object): [number, number] | null {
  try {
    const geo = typeof g === "string" ? JSON.parse(g) : g;
    if (geo?.type === "Point" && geo.coordinates) {
      return [geo.coordinates[0], geo.coordinates[1]];
    }
  } catch {}
  return null;
}

export async function fetchTTCVehicles(): Promise<PointData[]> {
  const res = await fetch(
    "https://retro.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a=ttc&t=0"
  );
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");
  const vehicles = xml.querySelectorAll("vehicle");
  const points: PointData[] = [];
  vehicles.forEach((v) => {
    const lat = parseFloat(v.getAttribute("lat") || "0");
    const lon = parseFloat(v.getAttribute("lon") || "0");
    const route = v.getAttribute("routeTag") || "";
    const heading = v.getAttribute("heading") || "";
    const speed = v.getAttribute("speedKmHr") || "0";
    if (lat && lon) {
      points.push({
        lat,
        lng: lon,
        label: `Route ${route}`,
        detail: `${speed} km/h`,
        extra: { heading: parseFloat(heading), route, speed: parseFloat(speed) },
      });
    }
  });
  return points;
}

export async function fetchBikeShare(): Promise<PointData[]> {
  const [infoRes, statusRes] = await Promise.all([
    fetch("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_information"),
    fetch("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_status"),
  ]);
  const info = await infoRes.json();
  const status = await statusRes.json();

  const statusMap = new Map<string, { bikes: number; docks: number; ebikes: number }>();
  for (const s of status.data.stations) {
    statusMap.set(s.station_id, {
      bikes: s.num_bikes_available || 0,
      docks: s.num_docks_available || 0,
      ebikes: s.num_bikes_available_types?.ebike || 0,
    });
  }

  return info.data.stations.map((s: { station_id: string; name: string; lat: number; lon: number; capacity: number }) => {
    const st = statusMap.get(s.station_id);
    return {
      lat: s.lat,
      lng: s.lon,
      label: s.name,
      detail: st ? `${st.bikes} bikes, ${st.docks} docks${st.ebikes ? `, ${st.ebikes} e-bikes` : ""}` : `${s.capacity} capacity`,
      extra: { capacity: s.capacity, ...st },
    };
  });
}

export async function fetchRoadClosures(): Promise<PointData[]> {
  // This API has invalid JSON escapes sometimes, so we handle errors
  try {
    const res = await fetch(
      "https://secure.toronto.ca/opendata/cart/road_restrictions/v3?format=json"
    );
    const text = await res.text();
    // Fix invalid escapes
    const cleaned = text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    const data = JSON.parse(cleaned);
    return data
      .filter((r: { latitude: number; longitude: number }) => r.latitude && r.longitude)
      .map((r: { road: string; type: string; description: string; latitude: number; longitude: number; startTime: string; endTime: string }) => ({
        lat: r.latitude,
        lng: r.longitude,
        label: r.road,
        detail: `${r.type}: ${r.description || ""}`.slice(0, 100),
        extra: { type: r.type, start: r.startTime, end: r.endTime },
      }));
  } catch (e) {
    console.error("Road closures fetch error:", e);
    return [];
  }
}

async function fetchCKANGeoJSON(resourceId: string, limit = 500): Promise<PointData[]> {
  const res = await fetch(
    `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?id=${resourceId}&limit=${limit}`
  );
  const data = await res.json();
  const records = data.result?.records || [];
  return records
    .map((r: Record<string, unknown>) => {
      let lat: number | null = null;
      let lng: number | null = null;

      // Try geometry field first
      if (r.geometry) {
        const coords = parseGeometry(r.geometry as string | object);
        if (coords) {
          lng = coords[0];
          lat = coords[1];
        }
      }
      // Fallback to lat/lng fields
      if (!lat && r.LATITUDE) {
        lat = parseFloat(r.LATITUDE as string);
        lng = parseFloat(r.LONGITUDE as string);
      }

      if (!lat || !lng) return null;

      // Build label from available fields
      const label =
        (r.NAME as string) ||
        (r.location as string) ||
        (r.MAIN as string) ||
        [r.LINEAR_NAME_FULL_1, r.LINEAR_NAME_FULL_2].filter(Boolean).join(" & ") ||
        [r.stname1, r.stname2].filter(Boolean).join(" & ") ||
        `Record ${r._id}`;

      return { lat, lng, label: String(label), detail: "", extra: r };
    })
    .filter(Boolean) as PointData[];
}

export async function fetchRedLightCameras(): Promise<PointData[]> {
  const points = await fetchCKANGeoJSON("b57a31a1-5ee6-43e3-bfb9-206ebe93066d", 500);
  return points.map((p) => ({
    ...p,
    detail: `Activated: ${(p.extra?.ACTIVATION_DATE as string) || "N/A"}`,
  }));
}

export async function fetchSpeedCameras(): Promise<PointData[]> {
  const points = await fetchCKANGeoJSON("e25e9460-a0e8-469c-b9fb-9a4837ac6c1c", 500);
  return points.map((p) => ({
    ...p,
    detail: `Status: ${(p.extra?.Status as string) || "Active"}`,
  }));
}

export async function fetchTrafficCameras(): Promise<PointData[]> {
  const points = await fetchCKANGeoJSON("824d2986-2fe0-4513-bdfb-e37e2499e7a9", 500);
  return points.map((p) => ({
    ...p,
    label: [p.extra?.MAINROAD, p.extra?.CROSSROAD].filter(Boolean).join(" & ") as string,
    detail: (p.extra?.IMAGEURL as string) || "",
  }));
}

export async function fetchCollisions(): Promise<PointData[]> {
  // Fetch recent years only (2020+) to keep it manageable
  const res = await fetch(
    `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?id=9c9a9b60-95c1-4541-ad44-15c4a643aff9&limit=5000&filters={"YEAR":"2024"}`
  );
  const data = await res.json();
  const records = data.result?.records || [];
  return records
    .filter((r: Record<string, unknown>) => r.LATITUDE && r.LONGITUDE)
    .map((r: Record<string, unknown>) => ({
      lat: parseFloat(r.LATITUDE as string),
      lng: parseFloat(r.LONGITUDE as string),
      label: [r.stname1, r.stname2].filter(Boolean).join(" & ") as string,
      detail: `${r.acclass} — ${r.impactype || ""}`,
      extra: { severity: r.acclass, type: r.impactype, date: r.accdate },
    }));
}

export async function fetchFireStations(): Promise<PointData[]> {
  const points = await fetchCKANGeoJSON("9d1b7352-32ce-4af2-8681-595ce9e47b6e", 200);
  return points.map((p) => ({
    ...p,
    label: `Station ${p.extra?.STATION || ""}`,
    detail: (p.extra?.ADDRESS as string) || "",
  }));
}

// Master fetcher map
export const FETCHERS: Record<string, () => Promise<PointData[]>> = {
  ttc: fetchTTCVehicles,
  bikeshare: fetchBikeShare,
  road_closures: fetchRoadClosures,
  red_light_cameras: fetchRedLightCameras,
  speed_cameras: fetchSpeedCameras,
  traffic_cameras: fetchTrafficCameras,
  collisions: fetchCollisions,
  fire_stations: fetchFireStations,
};
