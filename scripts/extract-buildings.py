#!/usr/bin/env python3
"""
Extract downtown Toronto buildings from 3D massing shapefile.
Reprojects from Web Mercator (EPSG:3857) to WGS84, filters to downtown core.
"""

import json
import math
import shapefile

SHP_PATH = "/tmp/3dmassing/3DMassingShapefile_2025_WGS84"
OUTPUT = "/Users/t./Documents/Projects/toronto-parking-viz/public/data/buildings-downtown.json"

# Downtown core bounding box in WGS84
BOUNDS = {
    "min_lng": -79.44,
    "max_lng": -79.33,
    "min_lat": 43.635,
    "max_lat": 43.69,
}

# Convert Web Mercator to WGS84
def merc_to_wgs84(x, y):
    lng = x / 20037508.34 * 180.0
    lat = y / 20037508.34 * 180.0
    lat = 180.0 / math.pi * (2.0 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0)
    return lng, lat

# Convert bounds to Mercator for fast filtering
def wgs84_to_merc(lng, lat):
    x = lng * 20037508.34 / 180.0
    lat_rad = lat * math.pi / 180.0
    y = math.log(math.tan(math.pi / 4.0 + lat_rad / 2.0)) * 20037508.34 / math.pi
    return x, y

MERC_MIN = wgs84_to_merc(BOUNDS["min_lng"], BOUNDS["min_lat"])
MERC_MAX = wgs84_to_merc(BOUNDS["max_lng"], BOUNDS["max_lat"])


def simplify_polygon(coords, tolerance=0.00004):
    """Reduce polygon points for web delivery."""
    if len(coords) <= 5:
        return coords
    n = max(1, len(coords) // 5)
    simplified = coords[::n]
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return simplified if len(simplified) >= 4 else coords


def main():
    print("Reading shapefile...")
    sf = shapefile.Reader(SHP_PATH)
    fields = [f[0] for f in sf.fields[1:]]
    print(f"Fields: {fields}")
    print(f"Total shapes: {len(sf)}")
    print(f"Mercator bounds: {MERC_MIN} to {MERC_MAX}")

    # Field indices: MIN_HEIGHT=0, MAX_HEIGHT=1, AVG_HEIGHT=2
    buildings = []
    skipped = 0
    short_buildings = 0

    for i, (shape, rec) in enumerate(zip(sf.shapes(), sf.records())):
        if i % 50000 == 0:
            print(f"  Processing {i}/{len(sf)}... ({len(buildings)} kept)")

        bbox = shape.bbox
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2

        if not (MERC_MIN[0] <= cx <= MERC_MAX[0] and MERC_MIN[1] <= cy <= MERC_MAX[1]):
            skipped += 1
            continue

        # Get height from MAX_HEIGHT field (index 1)
        try:
            height = float(rec[1])  # MAX_HEIGHT
        except:
            height = 0

        if height <= 0:
            try:
                height = float(rec[2])  # AVG_HEIGHT fallback
            except:
                height = 3

        # Keep only taller buildings (20m+) for the skyline backdrop effect
        if height < 20:
            short_buildings += 1
            continue

        # Convert polygon to WGS84
        parts = shape.parts if hasattr(shape, 'parts') else [0]
        points = shape.points

        for p_idx in range(len(parts)):
            start = parts[p_idx]
            end = parts[p_idx + 1] if p_idx + 1 < len(parts) else len(points)
            ring = []
            for pt in points[start:end]:
                lng, lat = merc_to_wgs84(pt[0], pt[1])
                ring.append([round(lng, 5), round(lat, 5)])

            if len(ring) < 4:
                continue

            ring = simplify_polygon(ring)
            if len(ring) < 4:
                continue

            buildings.append({
                "p": ring,  # polygon
                "h": round(height, 1),  # height
            })

    print(f"\nExtracted {len(buildings)} buildings")
    print(f"  Skipped {skipped} outside bounds")
    print(f"  Skipped {short_buildings} short buildings (<4m)")

    with open(OUTPUT, "w") as f:
        json.dump(buildings, f, separators=(",", ":"))

    import os
    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"Output: {OUTPUT}")
    print(f"Size: {size_mb:.1f} MB")

    if size_mb > 3:
        print(f"NOTE: Consider raising height threshold or tightening bounds")


if __name__ == "__main__":
    main()
