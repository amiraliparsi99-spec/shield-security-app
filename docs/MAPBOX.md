# Mapbox in Shield HQ

**Pre-launch focus:** venue booking uses Mapbox **geocoding** so staff can set a check-in pin via postcode/address search. **Live GPS maps** (agency tracking page) are secondary until you need them.

Mapbox is used in **two separate ways** in this repo. Both can share the **same public token** (`pk.*`).

---

## 1. Map loads (interactive map UI)

**Where:** `src/components/maps/StaffTrackingMap.tsx`  
**Used on:** Agency dashboard — `src/app/d/agency/tracking/page.tsx` (dynamic import).

**How it works:**

- **Library:** `react-map-gl` wraps **Mapbox GL JS** (`mapbox-gl`).
- **Token:** `NEXT_PUBLIC_MAPBOX_TOKEN` (injected at build time; must be public for the browser).
- **Style:** `mapbox://styles/mapbox/dark-v11` — vector tiles from Mapbox servers.
- **Behaviour:** Shows staff markers, optional venue **geofence circles** (GeoJSON polygons drawn client-side — the math is yours; Mapbox only draws them), popups, fit-bounds to markers.

If the token is **missing**, the component shows a placeholder (“Map requires configuration”) instead of crashing.

**Billing note:** Mapbox bills **map loads** (each time the map initializes in a session, subject to their pricing docs). Tuning `reuseMaps` / not remounting unnecessarily helps.

---

## 2. Geocoding (address → coordinates)

**Where:** `src/app/api/geocode/suggest/route.ts`  
**Used on:** Venue **new booking** flow — venues type address fields manually (street/site without a door number is fine), then **Set check-in pin from this address** runs one geocode and uses the first result (`/d/venue/bookings/new`).

**How it works:**

- **API:** [Mapbox Geocoding API](https://docs.mapbox.com/api/search/geocoding/) — HTTP GET to  
  `https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json`
- **Token:** Same `NEXT_PUBLIC_MAPBOX_TOKEN`, or optional `MAPBOX_ACCESS_TOKEN` if you prefer a server-only secret (not required for basic use).
- **Server-side:** Next.js route proxies the request so the browser calls **your** `/api/geocode/suggest?q=...`, not Mapbox directly (cleaner CORS and optional rate limits later).
- **Parameters in code:** `country=gb`, `types=address,place,postcode,...` — UK-biased. The UI builds `q` from the typed lines (address + optional city + postcode); there is no suggestion dropdown — first result sets the pin.

**Billing note:** Geocoding has its own **request** quotas on your Mapbox account (separate from map loads).

---

## 3. Configuration

1. Create a token at [mapbox.com](https://account.mapbox.com/) (default **public** token is fine for both uses above).
2. In `.env.local`:

   ```bash
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
   ```

3. Restart `next dev` after changes.

See `.env.local.example` for the commented line.

---

## 4. What Mapbox does *not* do here

- **Live guard GPS** is not sent to Mapbox continuously. Positions come from **your** backend/DB; the map only **displays** lat/lng you pass in.
- **Check-in geofence validation** uses **Haversine** math in the API (`src/lib/geo/distance.ts`) against booking/venue coordinates — not Mapbox.
- **Mobile** may use `react-native-maps` or device GPS separately; this doc is **web** Mapbox usage.

---

## 5. Later: AI agent layer

The [tracking / AI agent sketch](./TRACKING_AI_AGENT.md) sits **above** location events and notifications. Mapbox remains **maps + geocoding**; AI would handle summaries and tooling, not replace geofencing math.
