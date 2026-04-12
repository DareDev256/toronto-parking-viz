# Toronto Parking Activity — 3D Visualization

Interactive 3D timelapse of 456K+ parking tickets across 491 locations in Toronto (2024 data). First 3D parking visualization for Toronto.

**Live:** [toronto-parking-viz.vercel.app](https://toronto-parking-viz.vercel.app)

## Features

- **3D extruded columns** — ticket volume per location, color-coded green to red
- **Animated timelapse** — watch enforcement patterns shift hour by hour
- **Three view modes** — Hourly, Daily, Monthly breakdowns
- **Click any bar** — detail panel with exact address, total tickets, avg fine, peak hour, hourly distribution chart, Google Maps link
- **Top 10 ranking** — live-updating leaderboard of hottest ticket spots
- **Stats bar** — real-time ticket count, location count, avg fine for current time slice
- **3D building massing** — 11K Toronto buildings as skyline backdrop (toggleable)
- **Green P occupancy overlay** — 444 parking lots with occupancy data
- **Mobile responsive** — touch controls, responsive layout

## Tech Stack

- **Next.js 16** + TypeScript
- **deck.gl 9** — ColumnLayer, PolygonLayer, ScatterplotLayer
- **MapLibre GL** + CARTO dark-matter basemap
- **Toronto Open Data** — parking tickets (2024), parking occupancy, 3D building massing
- **Nominatim** — geocoding street addresses to coordinates
- **Vercel** — deployment

## Data Pipeline

1. Download 12 monthly CSVs from Toronto Open Data (2.8M tickets/year)
2. Aggregate by top 500 locations
3. Geocode via Nominatim with aggressive caching (614 locations)
4. Extract 3D building massing from 210MB shapefile, filter to downtown core (20m+ height)
5. Output optimized JSON for web delivery (0.3MB tickets + 1.6MB buildings)

## Local Development

```bash
npm install
npm run dev
```

Data files are pre-built in `public/data/`. To regenerate:

```bash
# Download parking tickets CSV from Toronto Open Data first
python3 scripts/process-tickets.py
python3 scripts/extract-buildings.py
```

## Data Sources

- [Parking Tickets](https://open.toronto.ca/dataset/parking-tickets/) — City of Toronto Open Data
- [Parking Occupancy](https://open.toronto.ca/dataset/parking-occupancy/) — Toronto Parking Authority
- [3D Massing](https://open.toronto.ca/dataset/3d-massing/) — City of Toronto Open Data

## License

MIT

Built by [DareDev256](https://github.com/DareDev256)
