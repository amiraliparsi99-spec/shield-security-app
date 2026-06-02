"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AddressSuggestion = {
  id: string;
  place_name: string;
  center: [number, number];
  address_line1: string;
  city: string;
  postcode: string;
  place_type: string;
  /** ISO 3166-1 alpha-2 (lowercase), e.g. "gb", "lu". Empty if Mapbox
   *  couldn't determine a country. */
  country_code: string;
  country_name: string;
};

type Props = {
  onSelect: (s: AddressSuggestion) => void;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  disabled?: boolean;
  /** Clears the search input after a selection (default: false — keeps the chosen label). */
  clearOnSelect?: boolean;
  label?: string;
  help?: string;
  /** Restrict Mapbox search to a country (ISO 3166-1 alpha-2, e.g. "gb").
   *  Pass comma-separated codes for multiple, or leave unset for worldwide. */
  country?: string;
};

/** Mapbox feature types that represent an *area* rather than a specific point.
 * Picking one of these triggers a drill-down to let the user choose a real
 * address inside the area, so we don't end up pinning the centroid of a
 * whole postcode by accident. */
const COARSE_TYPES = new Set([
  "postcode",
  "locality",
  "neighborhood",
  "district",
  "place",
]);

function isCoarse(s: AddressSuggestion): boolean {
  return COARSE_TYPES.has(s.place_type);
}

function prettyAreaLabel(s: AddressSuggestion): string {
  if (s.place_type === "postcode") return s.postcode || s.place_name;
  const parts = s.place_name.split(",");
  return parts[0]?.trim() || s.place_name;
}

/**
 * Address / postcode autocomplete backed by /api/geocode/suggest (Mapbox).
 * Works worldwide by default. Pass `country` (ISO alpha-2) to bias results.
 *
 * Flow:
 * 1. **Search mode** — debounced search (300ms, min 3 chars). Dropdown shows
 *    mixed results (addresses, POIs, postcodes, localities…). Keyboard
 *    navigable.
 * 2. Picking an *address* or *POI* fires onSelect immediately — that pin is
 *    precise.
 * 3. Picking an *area-level* result (postcode, locality, neighbourhood,
 *    district, place) switches to **drill-down mode**: we fetch real
 *    addresses / POIs near that point and show them in the dropdown.
 * 4. Inside drill-down the user can:
 *    - Pick a specific address → onSelect fires with that precise pin.
 *    - Tap "Use <area> centre as pin" → onSelect fires with the area-level
 *      suggestion (so the caller can flag it as imprecise).
 *    - Tap "Back to search" to start over.
 *
 * This prevents the footgun where a venue searches a postcode, picks the
 * postcode result, and silently ends up with a pin in the middle of a whole
 * street / block of postcodes.
 */
export function AddressAutocomplete({
  onSelect,
  placeholder = "Search an address, postcode, city or place",
  initialValue = "",
  className = "",
  disabled = false,
  clearOnSelect = false,
  label,
  help,
  country,
}: Props) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Drill-down state
  const [mode, setMode] = useState<"search" | "drill">("search");
  const [parent, setParent] = useState<AddressSuggestion | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillResults, setDrillResults] = useState<AddressSuggestion[]>([]);
  const [drillError, setDrillError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q });
      if (country) params.set("country", country);
      const res = await fetch(`/api/geocode/suggest?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setSuggestions([]);
        setError(
          typeof data.error === "string"
            ? data.error
            : "Address lookup failed.",
        );
        return;
      }
      const results = Array.isArray(data.results)
        ? (data.results as AddressSuggestion[])
        : [];
      setSuggestions(results);
      setIsOpen(true);
      setHighlighted(-1);
    } catch {
      setSuggestions([]);
      setError("Could not reach address lookup.");
    } finally {
      setLoading(false);
    }
  }, [country]);

  /** Fetch address / POI results near the picked area, so the user can pick
   *  a specific building inside that postcode / locality. */
  const fetchDrillDown = useCallback(async (p: AddressSuggestion) => {
    setDrillLoading(true);
    setDrillError(null);
    setDrillResults([]);
    try {
      // For a postcode, re-query the postcode itself restricted to addresses.
      // For a locality / neighbourhood, query its name with proximity bias.
      const q = p.place_type === "postcode" ? p.postcode || p.place_name : (
        p.place_name.split(",")[0] ?? p.place_name
      );
      const params = new URLSearchParams({
        q: q.trim(),
        types: "address,poi",
        proximity: `${p.center[0]},${p.center[1]}`,
      });
      // Bias drill-down to the picked feature's country when known, falling
      // back to the prop, falling back to worldwide.
      const drillCountry = p.country_code || country || "";
      if (drillCountry) params.set("country", drillCountry);
      const res = await fetch(`/api/geocode/suggest?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setDrillError(
          typeof data.error === "string"
            ? data.error
            : "Could not load addresses in that area.",
        );
        return;
      }
      const results = Array.isArray(data.results)
        ? (data.results as AddressSuggestion[])
        : [];
      // Only keep actual points (address / poi); drop anything else that slipped through.
      const filtered = results.filter(
        (r) => r.place_type === "address" || r.place_type === "poi",
      );
      setDrillResults(filtered);
      setHighlighted(-1);
    } catch {
      setDrillError("Could not reach address lookup.");
    } finally {
      setDrillLoading(false);
    }
  }, [country]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!touched) return;
    if (mode !== "search") return;
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(q);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, touched, mode, fetchSuggestions]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const commitSelection = useCallback(
    (s: AddressSuggestion) => {
      setQuery(clearOnSelect ? "" : s.place_name);
      setSuggestions([]);
      setDrillResults([]);
      setParent(null);
      setMode("search");
      setIsOpen(false);
      setHighlighted(-1);
      setError(null);
      setDrillError(null);
      onSelect(s);
    },
    [clearOnSelect, onSelect],
  );

  /** Handle click on any suggestion from the search-mode dropdown. */
  const handleSearchPick = (s: AddressSuggestion) => {
    if (isCoarse(s)) {
      // Don't commit yet — drill down into this area.
      setParent(s);
      setMode("drill");
      setQuery(s.place_name);
      setIsOpen(true);
      void fetchDrillDown(s);
      return;
    }
    commitSelection(s);
  };

  const backToSearch = () => {
    setMode("search");
    setParent(null);
    setDrillResults([]);
    setDrillError(null);
    setHighlighted(-1);
    inputRef.current?.focus();
  };

  const activeList: AddressSuggestion[] =
    mode === "drill" ? drillResults : suggestions;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || activeList.length === 0) {
      if (e.key === "ArrowDown" && activeList.length > 0) {
        setIsOpen(true);
        setHighlighted(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, activeList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      const picked = activeList[highlighted];
      if (mode === "drill") {
        commitSelection(picked);
      } else {
        handleSearchPick(picked);
      }
    } else if (e.key === "Escape") {
      if (mode === "drill") backToSearch();
      else setIsOpen(false);
    }
  };

  const showEmptyHint =
    mode === "search" &&
    isOpen &&
    !loading &&
    !error &&
    query.trim().length >= 3 &&
    suggestions.length === 0;

  const parentLabel = parent ? prettyAreaLabel(parent) : "";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      )}
      {help && <p className="text-xs text-zinc-500 mb-2">{help}</p>}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          readOnly={mode === "drill"}
          onChange={(e) => {
            setQuery(e.target.value);
            setTouched(true);
          }}
          onFocus={() => {
            if (activeList.length > 0 || mode === "drill") setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-9 py-2 text-white text-sm placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none transition disabled:opacity-60 ${
            mode === "drill" ? "cursor-default" : ""
          }`}
        />
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M21 21l-5-5m2-6a8 8 0 11-16 0 8 8 0 0116 0z"
            />
          </svg>
        </div>
        {(loading || drillLoading || query.length > 0) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {loading || drillLoading ? (
              <svg
                className="h-4 w-4 animate-spin text-zinc-400"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSuggestions([]);
                  setDrillResults([]);
                  setParent(null);
                  setMode("search");
                  setIsOpen(false);
                  setTouched(true);
                  inputRef.current?.focus();
                }}
                className="rounded p-1 text-zinc-500 transition hover:text-zinc-200"
                aria-label="Clear search"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drill-down panel: user picked a postcode / locality, now pick an exact address inside it */}
      {isOpen && mode === "drill" && parent && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-purple-300">
                Pick the exact location
              </div>
              <div className="truncate text-xs text-zinc-400">
                Inside{" "}
                <span className="text-zinc-200 font-medium">
                  {parentLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={backToSearch}
              className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 transition hover:bg-white/10"
            >
              ← Back
            </button>
          </div>

          {drillLoading && (
            <div className="px-3 py-3 text-xs text-zinc-400">
              Loading addresses in {parentLabel}…
            </div>
          )}

          {!drillLoading && drillError && (
            <div className="px-3 py-3 text-xs text-amber-400">{drillError}</div>
          )}

          {!drillLoading && !drillError && drillResults.length > 0 && (
            <ul role="listbox" className="max-h-64 overflow-auto">
              {drillResults.map((s, idx) => {
                const secondary =
                  [s.city, s.postcode].filter(Boolean).join(" · ") ||
                  s.place_type;
                return (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={idx === highlighted}
                    onMouseEnter={() => setHighlighted(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitSelection(s);
                    }}
                    className={`cursor-pointer border-b border-white/5 px-3 py-2 text-sm text-white transition last:border-b-0 ${
                      idx === highlighted
                        ? "bg-purple-500/20"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-emerald-400">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {s.place_name}
                        </div>
                        {secondary && (
                          <div className="truncate text-xs text-zinc-400">
                            {secondary}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!drillLoading && !drillError && drillResults.length === 0 && (
            <div className="px-3 py-3 text-xs text-zinc-400">
              No specific addresses are in the map for {parentLabel}. You can
              still use the area centre below, or go back and search by street
              name.
            </div>
          )}

          {/* Area-centroid fallback — deliberate, never silent. */}
          <div className="border-t border-white/10 bg-black/30 px-3 py-2">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (parent) commitSelection(parent);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-2 text-left text-xs text-amber-200 transition hover:bg-amber-500/10"
            >
              <span className="flex items-center gap-2">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                <span>
                  Use {parentLabel} centre as pin{" "}
                  <span className="text-amber-300/70">
                    (approximate — can be ~100m off)
                  </span>
                </span>
              </span>
              <span className="text-amber-300">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Search-mode suggestions */}
      {isOpen && mode === "search" && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl backdrop-blur"
        >
          {suggestions.map((s, idx) => {
            const coarse = isCoarse(s);
            const secondary =
              [s.city, s.postcode].filter(Boolean).join(" · ") || s.place_type;
            return (
              <li
                key={s.id}
                role="option"
                aria-selected={idx === highlighted}
                onMouseEnter={() => setHighlighted(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSearchPick(s);
                }}
                className={`cursor-pointer border-b border-white/5 px-3 py-2 text-sm text-white transition last:border-b-0 ${
                  idx === highlighted ? "bg-purple-500/20" : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 ${
                      coarse ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {s.place_type === "postcode" ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 7h18M3 12h18M3 17h18"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.place_name}</div>
                    <div className="truncate text-xs text-zinc-400">
                      {secondary}
                      {coarse && (
                        <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                          area — pick exact next
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showEmptyHint && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-400 backdrop-blur">
          No matches. Try the postcode on its own, or fewer words.
        </div>
      )}

      {error && <p className="mt-1 text-xs text-amber-400">{error}</p>}
    </div>
  );
}
