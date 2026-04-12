"use client";

import { useState, useCallback, useRef } from "react";

interface SearchResult {
  lat: number;
  lng: number;
  label: string;
}

interface SearchBarProps {
  onSelect: (result: SearchResult) => void;
}

export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy?url=${encodeURIComponent(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", Toronto, ON, Canada")}&format=json&limit=5&countrycodes=ca`
        )}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(
          data
            .filter((r: { lat: string; lon: string }) => {
              const lat = parseFloat(r.lat);
              const lng = parseFloat(r.lon);
              return lat > 43.5 && lat < 43.9 && lng > -79.7 && lng < -79.1;
            })
            .map((r: { display_name: string; lat: string; lon: string }) => ({
              lat: parseFloat(r.lat),
              lng: parseFloat(r.lon),
              label: r.display_name.split(",").slice(0, 2).join(","),
            }))
        );
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(val), 400);
    },
    [search]
  );

  const handleSelect = useCallback(
    (r: SearchResult) => {
      onSelect(r);
      setQuery(r.label);
      setIsOpen(false);
      setResults([]);
    },
    [onSelect]
  );

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-zinc-700/50 rounded-lg px-3 py-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(161,161,170,0.6)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setIsOpen(true)}
          placeholder="Search Toronto..."
          className="bg-transparent text-sm text-white placeholder-zinc-600 outline-none w-44"
        />
        {loading && (
          <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-black/90 backdrop-blur-sm border border-zinc-700 rounded-lg overflow-hidden z-30">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-colors truncate"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
