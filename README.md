# Toronto City Pulse — Real-Time 3D City Intelligence

Interactive 3D city intelligence dashboard for Toronto. 10+ live data layers from Toronto Open Data on a single 3D map — parking enforcement, TTC vehicles, bike share, road closures, cameras, collisions, and more.

**Live:** [toronto-parking-viz.vercel.app](https://toronto-parking-viz.vercel.app)

## Data Layers

| Layer | Source | Records | Refresh |
|-------|--------|---------|---------|
| Parking Tickets | Toronto Open Data | 456K+ across 491 locations | 2024 annual |
| Green P Occupancy | Toronto Parking Authority | 444 lots | Quarterly |
| 3D Building Massing | Toronto Open Data | 11K buildings (20m+) | Static |
| TTC Vehicles | TTC NextBus API | ~900 live vehicles | 15 seconds |
| Bike Share | GBFS Feed | 1,031 stations | 30 seconds |
| Road Closures | City of Toronto API | Active restrictions | Near real-time |
| Red Light Cameras | Toronto Open Data | 296 intersections | Periodic |
| Speed Cameras | Toronto Open Data | 198 locations | Periodic |
| Traffic Cameras | Toronto Open Data | 336 cameras | Periodic |
| Collisions (KSI) | Toronto Open Data | 20,457 records | Annual |
| Fire Stations | Toronto Open Data | 85 stations | Static |

The three static figures above come out of `public/data/`:

```bash
# 456,367 tickets across 491 locations, 444 Green P lots
node -e "const d=require('./public/data/toronto-parking-2024.json');console.log(d.totalTickets,d.locationCount,d.occupancy.length)"
# 11311 building footprints
node -e "console.log(require('./public/data/buildings-downtown.json').length)"
```

The live-layer counts are the sizes those APIs return and are quoted from
`src/lib/city-layers.ts`. They move when the city's data moves.

## Features

- **3D extruded columns** — parking ticket volume per location, color-coded green to red
- **Animated timelapse** — hourly, daily, monthly views with play/pause
- **10+ toggleable data layers** — organized by category (Transit, Enforcement, Safety, Infrastructure)
- **Real-time data** — TTC vehicles and Bike Share refresh every 15-30 seconds with live pulse indicators
- **Click any bar** — detail panel with address, tickets, avg fine, peak hour, hourly chart, Google Maps link
- **Top 10 ranking** — live-updating leaderboard
- **Stats bar** — real-time ticket count, location count, avg fine
- **3D building massing** — Toronto skyline as backdrop
- **Layer panel** — categorized toggles with point counts and loading states
- **Mobile responsive** — touch controls, responsive layout

## Tech Stack

- **Next.js 16** + TypeScript
- **deck.gl 9** — ColumnLayer, PolygonLayer, ScatterplotLayer
- **MapLibre GL** + CARTO dark-matter basemap
- **Toronto Open Data** — CKAN API, GBFS, NextBus XML, City REST APIs
- **Vercel** — deployment

## Data Pipeline

1. Parking tickets: 12 monthly CSVs → top 500 locations by volume → Nominatim geocoding → 491 that geocoded, aggregated to JSON (351KB)
2. Buildings: shapefile → reproject Web Mercator → filter downtown 20m+ → 11,311 footprints, 1.6MB JSON
3. City layers: Live API fetching with configurable refresh intervals and caching

## Local Development

```bash
npm install
npm run dev
```

## Data Sources

All data from public, freely accessible sources:
- [Toronto Open Data Portal](https://open.toronto.ca/) — parking tickets, buildings, cameras, collisions, fire stations
- [TTC NextBus API](https://retro.umoiq.com/) — real-time vehicle positions
- [Bike Share Toronto GBFS](https://tor.publicbikesystem.net/) — station status
- [City of Toronto Road Restrictions API](https://secure.toronto.ca/opendata/) — road closures

## License

MIT

Built by [DareDev256](https://github.com/DareDev256)
