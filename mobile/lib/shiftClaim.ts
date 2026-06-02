import * as Location from "expo-location";
import { fetchApi } from "./api";
import { supabase } from "./supabase";

/** Hard ceiling for any single slow step (GPS, network). Prevents the
 *  UI ever feeling "frozen" — if we hit this we fail fast with a clear error. */
const GPS_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 12000;

/** A last-known GPS fix is good enough for a 10km-radius proximity check as
 *  long as it's not ancient. Anything fresher than this we reuse directly
 *  instead of waiting for a new satellite lock. */
const STALE_FIX_THRESHOLD_MS = 2 * 60 * 1000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function getAuthTokenOrThrow(): Promise<string> {
  if (!supabase) throw new Error("Supabase client unavailable");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Please log in again.");
  }
  return session.access_token;
}

/**
 * Fast, resilient coordinate fetcher for shift claims.
 *
 * Strategy (in order, fast → slow):
 *   1. Check permission with `getForegroundPermissionsAsync` (cheap). Only
 *      request explicitly if not yet granted.
 *   2. Try `getLastKnownPositionAsync` — returns instantly if the OS has a
 *      cached fix, and for a 10km-radius check it's perfectly accurate
 *      enough as long as it's < 2 minutes old.
 *   3. Fall back to a live fix with `Balanced` accuracy (≈10–100m — more
 *      than enough, and much faster than High), wrapped in an 8s timeout
 *      so the UI never hangs on a device with poor GPS.
 */
async function getCurrentCoordsOrThrow(): Promise<{
  latitude: number;
  longitude: number;
}> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    perm = await Location.requestForegroundPermissionsAsync();
  }
  if (perm.status !== "granted") {
    throw new Error(
      "Location permission is required to claim nearby shifts. Please enable location in Settings and try again.",
    );
  }

  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: STALE_FIX_THRESHOLD_MS,
      requiredAccuracy: 200, // metres — plenty for a 10km radius check
    });
    if (last) {
      return {
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
      };
    }
  } catch {
    // Swallow — the fresh-fix path below is our real source of truth.
  }

  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      GPS_TIMEOUT_MS,
      "GPS fix",
    );
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("timed out")) {
      throw new Error(
        "Couldn't get your location in time. Try stepping outside for a better GPS signal and tap Claim again.",
      );
    }
    throw new Error(
      "Couldn't read your location. Please make sure Location Services are on and try again.",
    );
  }
}

/**
 * Wraps fetchApi with an AbortController-backed timeout so a flaky network
 * doesn't leave the Claim button spinning for a minute.
 */
async function fetchApiWithTimeout(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchApi(path, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function claimShiftWithLocation(
  shiftId: string,
  personnelId?: string | null,
): Promise<any> {
  const token = await getAuthTokenOrThrow();
  const { latitude, longitude } = await getCurrentCoordsOrThrow();

  let res: Response;
  try {
    res = await fetchApiWithTimeout(
      "/api/shifts/claim",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shift_id: shiftId,
          personnel_id: personnelId ?? null,
          latitude,
          longitude,
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted") || msg.toLowerCase().includes("abort")) {
      throw new Error(
        "The server took too long to respond. Check your connection and try again.",
      );
    }
    throw new Error("Could not reach Shield HQ. Check your connection and try again.");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json?.debug) {
      console.log("[claimShift] server debug:", JSON.stringify(json.debug, null, 2));
    }
    const err: any = new Error(json?.error || "Unable to claim shift");
    err.debug = json?.debug;
    err.code = json?.code;
    throw err;
  }
  return json;
}

export async function acceptOfferWithLocation(
  shiftOfferId: string,
  personnelId?: string | null,
): Promise<any> {
  const token = await getAuthTokenOrThrow();
  const { latitude, longitude } = await getCurrentCoordsOrThrow();

  let res: Response;
  try {
    res = await fetchApiWithTimeout(
      "/api/shifts/respond-offer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shift_offer_id: shiftOfferId,
          response: "accepted",
          personnel_id: personnelId ?? null,
          latitude,
          longitude,
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted") || msg.toLowerCase().includes("abort")) {
      throw new Error(
        "The server took too long to respond. Check your connection and try again.",
      );
    }
    throw new Error("Could not reach Shield HQ. Check your connection and try again.");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json?.debug) {
      console.log("[acceptOffer] server debug:", JSON.stringify(json.debug));
    }
    throw new Error(json?.error || "Unable to accept shift");
  }
  return json;
}
