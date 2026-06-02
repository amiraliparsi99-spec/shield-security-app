/**
 * useGuestLocation — soft-resolve the device's coarse location for guests.
 *
 * Used to position the rotating sample shifts (and map markers) near the
 * user's actual area instead of hard-coding London. Behaviour:
 *
 *   1) If foreground location permission is already granted, fetch position
 *      silently — no prompt, no friction.
 *   2) If permission has never been asked, request it once with the standard
 *      OS dialog. The Info.plist usage description already mentions "show you
 *      nearby venues", which is honest for this use case.
 *   3) If the user denies, we silently fall back to null and the caller
 *      uses its default centre (e.g. central London).
 *
 * Reverse-geocodes to a city/locality label so the UI can say
 * "Live shifts near {City}" — non-blocking; null label is fine.
 */

import { useEffect, useState } from "react";
import * as Location from "expo-location";

export type GuestLocation = {
  lat: number;
  lng: number;
  /** Locality / city / postcode label, e.g. "Camden", "Manchester", "M1". */
  label: string | null;
};

/** Options to make the hook callable conditionally. */
interface UseGuestLocationOptions {
  /** Skip resolution entirely (e.g. when already authenticated). */
  skip?: boolean;
  /** If true, prompt the user when permission has not yet been determined. */
  askIfUndetermined?: boolean;
}

export function useGuestLocation({
  skip = false,
  askIfUndetermined = true,
}: UseGuestLocationOptions = {}): GuestLocation | null {
  const [coords, setCoords] = useState<GuestLocation | null>(null);

  useEffect(() => {
    if (skip) return;
    let cancelled = false;

    (async () => {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        let granted = existing.status === "granted";

        if (!granted && askIfUndetermined && existing.canAskAgain) {
          const requested = await Location.requestForegroundPermissionsAsync();
          granted = requested.status === "granted";
        }

        if (!granted) return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
        });
        if (cancelled) return;

        const base: GuestLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: null,
        };
        setCoords(base);

        // Reverse-geocode in the background (best-effort).
        try {
          const places = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (cancelled) return;
          const first = places?.[0];
          if (first) {
            const label =
              first.city ||
              first.subregion ||
              first.region ||
              first.district ||
              first.postalCode ||
              null;
            if (label) setCoords({ ...base, label });
          }
        } catch {
          // ignore — coords without label still work fine
        }
      } catch {
        // ignore — caller will use its fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [skip, askIfUndetermined]);

  return coords;
}
