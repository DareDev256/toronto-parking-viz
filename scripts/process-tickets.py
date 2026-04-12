#!/usr/bin/env python3
"""
Process Toronto parking ticket CSVs into aggregated JSON for deck.gl.
Uses Nominatim with caching. Processes in two passes to minimize geocoding wait.
"""

import csv
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from collections import defaultdict
from datetime import datetime
from pathlib import Path

DATA_DIR = Path("/tmp/parking-tickets-2024")
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
GEOCODE_CACHE_FILE = Path(__file__).parent / "geocode_cache.json"

# Load geocode cache
if GEOCODE_CACHE_FILE.exists():
    with open(GEOCODE_CACHE_FILE) as f:
        geocode_cache = json.load(f)
else:
    geocode_cache = {}


def save_cache():
    with open(GEOCODE_CACHE_FILE, "w") as f:
        json.dump(geocode_cache, f)


def geocode(street: str) -> tuple[float, float] | None:
    key = street.upper().strip()
    if key in geocode_cache:
        val = geocode_cache[key]
        return (val["lat"], val["lng"]) if val else None

    query = f"{street}, Toronto, Ontario, Canada"
    params = urllib.parse.urlencode({"q": query, "format": "json", "limit": 1, "countrycodes": "ca"})
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TorontoParkingViz/1.0 (dev@jamesdare.com)"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data:
                lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
                # Sanity check — must be roughly in Toronto
                if 43.5 < lat < 43.9 and -79.7 < lng < -79.1:
                    geocode_cache[key] = {"lat": lat, "lng": lng}
                    save_cache()
                    time.sleep(1.05)
                    return (lat, lng)
            geocode_cache[key] = None
            save_cache()
            return None
    except Exception as e:
        print(f"  Geocode error: {street}: {e}", file=sys.stderr)
        return None


def build_location(row: dict) -> str:
    loc2 = row.get("location2", "").strip()
    if loc2:
        return loc2
    return ""


def main():
    # Pass 1: count locations
    print("Pass 1: Counting ticket locations...")
    location_counts = defaultdict(int)
    csv_files = sorted(DATA_DIR.glob("*.csv"))

    for f in csv_files:
        print(f"  {f.name}")
        with open(f) as fh:
            for row in csv.DictReader(fh):
                loc = build_location(row)
                if loc:
                    location_counts[loc] += 1

    top = sorted(location_counts.items(), key=lambda x: -x[1])[:200]
    top_set = {loc for loc, _ in top}
    print(f"\nTop 200 locations: {sum(c for _, c in top):,} of {sum(location_counts.values()):,} total tickets")

    # Geocode
    need_geocode = [loc for loc in top_set if loc.upper().strip() not in geocode_cache]
    already = len(top_set) - len(need_geocode)
    print(f"\nGeocoding: {already} cached, {len(need_geocode)} to fetch...")

    for i, loc in enumerate(need_geocode):
        result = geocode(loc)
        status = "OK" if result else "FAIL"
        if (i + 1) % 20 == 0 or status == "FAIL":
            print(f"  [{i+1}/{len(need_geocode)}] {loc}: {status}")

    # Build geocoded map
    geocoded = {}
    for loc in top_set:
        key = loc.upper().strip()
        if key in geocode_cache and geocode_cache[key]:
            geocoded[loc] = (geocode_cache[key]["lat"], geocode_cache[key]["lng"])

    print(f"\nGeocoded: {len(geocoded)}/{len(top_set)}")

    # Pass 2: aggregate data
    print("\nPass 2: Aggregating...")
    hourly = defaultdict(lambda: defaultdict(int))
    monthly = defaultdict(lambda: defaultdict(int))
    daily = defaultdict(lambda: defaultdict(int))
    infractions = defaultdict(lambda: defaultdict(int))
    fines = defaultdict(int)
    fine_counts = defaultdict(int)

    for f in csv_files:
        month_num = int(f.stem.split("_")[-1])
        print(f"  {f.name}")
        with open(f) as fh:
            for row in csv.DictReader(fh):
                loc = build_location(row)
                if loc not in geocoded:
                    continue

                t = row.get("time_of_infraction", "").strip()
                hour = int(t.zfill(4)[:2]) if t and len(t) >= 2 else 0
                hourly[loc][hour] += 1
                monthly[loc][month_num] += 1
                infractions[loc][row.get("infraction_description", "")] += 1

                try:
                    fines[loc] += int(row.get("set_fine_amount", 0) or 0)
                    fine_counts[loc] += 1
                except:
                    pass

                date_str = row.get("date_of_infraction", "")
                if len(date_str) == 8:
                    try:
                        dow = datetime.strptime(date_str, "%Y%m%d").weekday()
                        daily[loc][dow] += 1
                    except:
                        pass

    # Build output
    print("\nBuilding output...")
    features = []
    for loc, coords in geocoded.items():
        total = sum(hourly[loc].values())
        top_inf = max(infractions[loc].items(), key=lambda x: x[1])[0] if infractions[loc] else ""
        avg_fine = round(fines[loc] / fine_counts[loc]) if fine_counts[loc] else 0

        features.append({
            "location": loc,
            "lat": coords[0],
            "lng": coords[1],
            "total": total,
            "avgFine": avg_fine,
            "hourly": {str(h): hourly[loc].get(h, 0) for h in range(24)},
            "monthly": {str(m): monthly[loc].get(m, 0) for m in range(1, 13)},
            "daily": {str(d): daily[loc].get(d, 0) for d in range(7)},
            "topInfraction": top_inf,
        })

    features.sort(key=lambda f: -f["total"])

    # Fetch occupancy
    print("Fetching occupancy data...")
    occupancy = []
    try:
        url = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?id=2d1bf001-eebf-4f02-a7d3-a51f8acd884e&limit=500"
        req = urllib.request.Request(url, headers={"User-Agent": "TorontoParkingViz/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            records = json.loads(resp.read()).get("result", {}).get("records", [])
            for r in records:
                loc = r.get("Car Park Location", "")
                if not loc:
                    continue
                coords = geocode(loc)
                if coords:
                    occ_str = r.get("Average Daily Peak Occupancy %", "0%").replace("%", "")
                    try:
                        occ = int(occ_str)
                    except:
                        occ = 0
                    occupancy.append({
                        "location": loc,
                        "lat": coords[0],
                        "lng": coords[1],
                        "carPark": r.get("Car Park Number", ""),
                        "totalSpaces": int(r.get("Total Available Spaces", 0) or 0),
                        "occupancy": occ,
                        "year": r.get("Year", ""),
                        "quarter": r.get("Quarter", ""),
                    })
    except Exception as e:
        print(f"  Occupancy error: {e}")

    output = {
        "generated": time.strftime("%Y-%m-%d %H:%M:%S"),
        "totalTickets": sum(f["total"] for f in features),
        "locationCount": len(features),
        "year": 2024,
        "tickets": features,
        "occupancy": occupancy,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = OUTPUT_DIR / "toronto-parking-2024.json"
    with open(out_file, "w") as f:
        json.dump(output, f)

    size_mb = out_file.stat().st_size / 1024 / 1024
    print(f"\nDone! {out_file}")
    print(f"  {len(features)} locations, {output['totalTickets']:,} tickets")
    print(f"  {len(occupancy)} occupancy records")
    print(f"  File: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
