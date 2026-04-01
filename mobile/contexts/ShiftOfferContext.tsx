/**
 * ShiftOfferContext — Uber-style shift offer popup system
 *
 * STRATEGY: Poll the shifts table directly for new unclaimed shifts.
 * When a new shift appears that the guard hasn't seen yet, show the popup.
 * This is completely self-contained — no dependency on any API, server,
 * or the shift_offers table being populated externally.
 *
 * Also listens to Supabase Realtime on the shifts table for instant detection.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Vibration, Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { getPersonnelId, isPersonnelVerified } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { getApiBaseUrl } from "../lib/api";

// ——— Types ———

export interface ShiftOffer {
  id: string;
  shift_id: string;
  personnel_id: string;
  status: string;
  hourly_rate: number;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  shift_date: string | null;
  start_time: string | null;
  end_time: string | null;
  distance_miles: number | null;
  expires_at: string;
  created_at: string;
}

interface ShiftOfferContextValue {
  currentOffer: ShiftOffer | null;
  countdown: number;
  accepting: boolean;
  acceptOffer: () => Promise<void>;
  declineOffer: () => Promise<void>;
  dismissOffer: () => void;
}

const ShiftOfferContext = createContext<ShiftOfferContextValue | null>(null);

const OFFER_DURATION_SECONDS = 120;

function buildOfferFromShift(
  shift: any,
  personnelId: string,
  meta?: { event_name?: string; venue_name?: string; venue_city?: string }
): ShiftOffer {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  const eventName = meta?.event_name || "New Shift";
  const venueName = meta?.venue_name || "Venue";
  return {
    id: `shift-${shift.id}`,
    shift_id: shift.id,
    personnel_id: personnelId,
    status: "pending",
    hourly_rate: Number(shift.hourly_rate) || 0,
    venue_name: `${eventName} @ ${venueName}`,
    venue_address: meta?.venue_city || null,
    venue_latitude: null,
    venue_longitude: null,
    shift_date: start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    start_time: start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    end_time: end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    distance_miles: null,
    expires_at: new Date(Date.now() + OFFER_DURATION_SECONDS * 1000).toISOString(),
    created_at: shift.created_at || new Date().toISOString(),
  };
}

// ——— Provider ———

export function ShiftOfferProvider({ children }: { children: React.ReactNode }) {
  const [currentOffer, setCurrentOffer] = useState<ShiftOffer | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [isVerifiedGuard, setIsVerifiedGuard] = useState(false);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const offerQueueRef = useRef<ShiftOffer[]>([]);
  const seenShiftIdsRef = useRef<Set<string>>(new Set());
  const metaCacheRef = useRef<Record<string, any>>({});

  // --- Initialize ---
  useEffect(() => {
    if (!supabase) return;

    const init = async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const pId = await getPersonnelId(supabase, user.id);
      if (pId) {
        setPersonnelId(pId);
        const verified = await isPersonnelVerified(supabase, pId);
        setIsVerifiedGuard(verified);
        console.log("[ShiftOffer] Init:", pId, "verified:", verified);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        if (!supabase) return;
        const pId = await getPersonnelId(supabase, session.user.id);
        setPersonnelId(pId);
        setCurrentOffer(null);
        offerQueueRef.current = [];
        seenShiftIdsRef.current.clear();
        metaCacheRef.current = {};
        setIsVerifiedGuard(false);
        if (pId) {
          const verified = await isPersonnelVerified(supabase, pId);
          setIsVerifiedGuard(verified);
          console.log("[ShiftOffer] SignIn:", pId, "verified:", verified);
        }
      } else if (event === "SIGNED_OUT") {
        setPersonnelId(null);
        setCurrentOffer(null);
        setIsVerifiedGuard(false);
        offerQueueRef.current = [];
        seenShiftIdsRef.current.clear();
        metaCacheRef.current = {};
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // --- Fetch booking metadata (event name + venue name) ---
  const fetchMetadata = useCallback(async (bookingIds: string[]) => {
    const missing = bookingIds.filter((id) => !metaCacheRef.current[id]);
    if (missing.length === 0) return;

    // Try API endpoint first
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${getApiBaseUrl()}/api/shifts/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_ids: missing }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          Object.assign(metaCacheRef.current, data);
          return;
        }
      }
    } catch {
      // API unreachable — try direct Supabase
    }

    // Fallback: try Supabase directly (may fail due to RLS for unassigned bookings)
    if (supabase) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, event_name, venue_id")
        .in("id", missing);
      if (bookings && bookings.length > 0) {
        const venueIds = [...new Set(bookings.map((b) => b.venue_id).filter(Boolean))];
        let venuesMap: Record<string, any> = {};
        if (venueIds.length > 0) {
          const { data: venues } = await supabase.from("venues").select("id, name, city").in("id", venueIds);
          if (venues) venues.forEach((v) => { venuesMap[v.id] = v; });
        }
        for (const b of bookings) {
          const v = venuesMap[b.venue_id] || {};
          metaCacheRef.current[b.id] = {
            event_name: b.event_name || "Security Shift",
            venue_name: v.name || "Venue",
            venue_city: v.city || "",
          };
        }
      }
    }
  }, []);

  // --- Show an offer ---
  const showOffer = useCallback((offer: ShiftOffer) => {
    if (seenShiftIdsRef.current.has(offer.shift_id)) {
      console.log("[ShiftOffer] Already seen shift:", offer.shift_id.slice(0, 8));
      return;
    }
    seenShiftIdsRef.current.add(offer.shift_id);
    console.log("[ShiftOffer] SHOWING POPUP for shift:", offer.shift_id.slice(0, 8), "venue:", offer.venue_name);

    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 300, 100, 300]);
    }
    safeHaptic("heavy");

    setCurrentOffer((prev) => {
      if (prev) {
        offerQueueRef.current.push(offer);
        console.log("[ShiftOffer] Queued (already showing one). Queue size:", offerQueueRef.current.length);
        return prev;
      }
      return offer;
    });
  }, []);

  // --- Poll shifts table for new unclaimed shifts ---
  useEffect(() => {
    if (!supabase || !personnelId || !isVerifiedGuard) return;

    let cancelled = false;
    // Clear seen IDs on each effect run to avoid stale data from previous runs
    seenShiftIdsRef.current.clear();
    console.log("[ShiftOffer] Starting shift poll for", personnelId);

    const pollShifts = async () => {
      if (cancelled || !supabase) return;

      try {
        const { data: shifts } = await supabase
          .from("shifts")
          .select("id, booking_id, role, hourly_rate, scheduled_start, scheduled_end, created_at")
          .is("personnel_id", null)
          .eq("status", "pending")
          .gte("scheduled_start", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(10);

        if (cancelled || !shifts || shifts.length === 0) return;

        const newShifts = shifts.filter((s) => !seenShiftIdsRef.current.has(s.id));
        if (newShifts.length === 0) return;

        // Fetch metadata for these bookings
        const bookingIds = [...new Set(newShifts.map((s) => s.booking_id).filter(Boolean))];
        await fetchMetadata(bookingIds);

        if (cancelled) return;

        for (const shift of newShifts) {
          const meta = metaCacheRef.current[shift.booking_id];
          const offer = buildOfferFromShift(shift, personnelId, meta);
          showOffer(offer);
        }
      } catch (err) {
        console.warn("[ShiftOffer] Poll error:", err);
      }
    };

    // Initial load — show popups for shifts created in the last 10 min, mark older as seen
    const recentThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let intervalId: NodeJS.Timeout | null = null;

    const initPoll = async () => {
      if (!supabase || cancelled) return;

      const { data: existing } = await supabase
        .from("shifts")
        .select("id, booking_id, role, hourly_rate, scheduled_start, scheduled_end, created_at")
        .is("personnel_id", null)
        .eq("status", "pending")
        .gte("scheduled_start", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelled || !existing) return;

      const recent: typeof existing = [];
      for (const s of existing) {
        if (s.created_at && s.created_at >= recentThreshold) {
          recent.push(s);
        } else {
          seenShiftIdsRef.current.add(s.id);
        }
      }

      console.log("[ShiftOffer] Existing:", existing.length, "Recent:", recent.length, "Marked seen:", existing.length - recent.length);

      // Show popups for recent shifts
      if (recent.length > 0 && !cancelled) {
        const bookingIds = [...new Set(recent.map((s) => s.booking_id).filter(Boolean))];
        await fetchMetadata(bookingIds);
        if (cancelled) return;
        for (const shift of recent) {
          const meta = metaCacheRef.current[shift.booking_id];
          const offer = buildOfferFromShift(shift, personnelId, meta);
          showOffer(offer);
        }
      }

      // Start polling for new shifts
      if (!cancelled) {
        intervalId = setInterval(pollShifts, 5000);
      }
    };

    initPoll();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [personnelId, isVerifiedGuard, fetchMetadata, showOffer]);

  // --- Also subscribe to Realtime on shifts table for instant detection ---
  useEffect(() => {
    if (!supabase || !personnelId || !isVerifiedGuard) return;

    const channel = supabase
      .channel(`new-shifts:${personnelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shifts",
        },
        async (payload) => {
          const shift = payload.new as any;
          if (shift.personnel_id !== null || shift.status !== "pending") return;
          if (seenShiftIdsRef.current.has(shift.id)) return;

          console.log("[ShiftOffer] Realtime new shift detected:", shift.id);

          if (shift.booking_id) {
            await fetchMetadata([shift.booking_id]);
          }
          const meta = metaCacheRef.current[shift.booking_id];
          const offer = buildOfferFromShift(shift, personnelId, meta);
          showOffer(offer);
        }
      )
      .subscribe((status) => {
        console.log("[ShiftOffer] Realtime shifts subscription:", status);
      });

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [personnelId, isVerifiedGuard, fetchMetadata, showOffer]);

  // --- Countdown timer ---
  useEffect(() => {
    if (!currentOffer) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    const expiresAt = new Date(currentOffer.expires_at).getTime();
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    setCountdown(remaining);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          setCurrentOffer(null);
          showNextFromQueue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [currentOffer?.id]);

  // --- Queue ---
  const showNextFromQueue = useCallback(() => {
    const next = offerQueueRef.current.shift();
    if (next) {
      if (new Date(next.expires_at).getTime() > Date.now()) {
        setCurrentOffer(next);
        safeHaptic("medium");
      } else {
        showNextFromQueue();
      }
    }
  }, []);

  // --- Actions ---

  const acceptOffer = useCallback(async () => {
    if (!currentOffer || !supabase || accepting) return;

    setAccepting(true);
    safeHaptic("medium");

    try {
      // Claim the shift directly
      const { error: claimErr } = await supabase.rpc("claim_shift", {
        p_shift_id: currentOffer.shift_id,
        p_personnel_id: currentOffer.personnel_id,
      });

      if (claimErr) {
        // Fallback: direct update
        await supabase
          .from("shifts")
          .update({
            personnel_id: currentOffer.personnel_id,
            status: "accepted",
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentOffer.shift_id)
          .eq("status", "pending")
          .is("personnel_id", null);
      }

      safeHaptic("success");

      setTimeout(() => {
        setCurrentOffer(null);
        setAccepting(false);
        showNextFromQueue();
      }, 2000);
    } catch (err) {
      console.error("[ShiftOffer] Accept error:", err);
      safeHaptic("error");
      setAccepting(false);
    }
  }, [currentOffer, accepting, showNextFromQueue]);

  const declineOffer = useCallback(async () => {
    if (!currentOffer) return;
    safeHaptic("light");
    setCurrentOffer(null);
    showNextFromQueue();
  }, [currentOffer, showNextFromQueue]);

  const dismissOffer = useCallback(() => {
    setCurrentOffer(null);
    showNextFromQueue();
  }, [showNextFromQueue]);

  return (
    <ShiftOfferContext.Provider
      value={{
        currentOffer,
        countdown,
        accepting,
        acceptOffer,
        declineOffer,
        dismissOffer,
      }}
    >
      {children}
    </ShiftOfferContext.Provider>
  );
}

// ——— Hook ———

export function useShiftOffer(): ShiftOfferContextValue {
  const ctx = useContext(ShiftOfferContext);
  if (!ctx) {
    throw new Error("useShiftOffer must be used within a ShiftOfferProvider");
  }
  return ctx;
}
