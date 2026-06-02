/**
 * ShiftOfferContext — Uber-style shift offer popup system
 *
 * Only shows offers where the guard has a row in `shift_offers` (targeted offers).
 * Polls `shift_offers` and listens to Realtime inserts for this personnel_id.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Vibration, Platform, Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { getPersonnelId, isPersonnelVerified } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { acceptOfferWithLocation } from "../lib/shiftClaim";

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

function mapOfferRow(row: Record<string, unknown>): ShiftOffer {
  return {
    id: String(row.id),
    shift_id: String(row.shift_id),
    personnel_id: String(row.personnel_id),
    status: String(row.status ?? "pending"),
    hourly_rate: Number(row.hourly_rate) || 0,
    venue_name: row.venue_name != null ? String(row.venue_name) : null,
    venue_address: row.venue_address != null ? String(row.venue_address) : null,
    venue_latitude:
      row.venue_latitude != null && row.venue_latitude !== ""
        ? Number(row.venue_latitude)
        : null,
    venue_longitude:
      row.venue_longitude != null && row.venue_longitude !== ""
        ? Number(row.venue_longitude)
        : null,
    shift_date: row.shift_date != null ? String(row.shift_date) : null,
    start_time: row.start_time != null ? String(row.start_time) : null,
    end_time: row.end_time != null ? String(row.end_time) : null,
    distance_miles:
      row.distance_miles != null && row.distance_miles !== ""
        ? Number(row.distance_miles)
        : null,
    expires_at: String(row.expires_at ?? new Date().toISOString()),
    created_at: String(row.created_at ?? new Date().toISOString()),
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
  const seenOfferIdsRef = useRef<Set<string>>(new Set());

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
        seenOfferIdsRef.current.clear();
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
        seenOfferIdsRef.current.clear();
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // --- Show an offer ---
  const showOffer = useCallback((offer: ShiftOffer) => {
    if (seenOfferIdsRef.current.has(offer.id)) {
      console.log("[ShiftOffer] Already seen offer:", offer.id.slice(0, 8));
      return;
    }
    seenOfferIdsRef.current.add(offer.id);
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

  // --- Poll shift_offers for this guard ---
  useEffect(() => {
    if (!supabase || !personnelId) return;

    let cancelled = false;
    seenOfferIdsRef.current.clear();
    console.log("[ShiftOffer] Starting shift_offers poll for", personnelId);

    const pollOffers = async () => {
      if (cancelled || !supabase) return;

      try {
        const nowIso = new Date().toISOString();
        const { data: rows } = await supabase
          .from("shift_offers")
          .select("*")
          .eq("personnel_id", personnelId)
          .eq("status", "pending")
          .gt("expires_at", nowIso)
          .order("created_at", { ascending: false })
          .limit(15);

        if (cancelled || !rows || rows.length === 0) return;

        let offers = rows.map(mapOfferRow).filter((o) => new Date(o.expires_at).getTime() > Date.now());
        for (const offer of offers) {
          showOffer(offer);
        }
      } catch (err) {
        console.warn("[ShiftOffer] Poll error:", err);
      }
    };

    let intervalId: NodeJS.Timeout | null = null;

    const initPoll = async () => {
      if (!supabase || cancelled) return;

      const nowIso = new Date().toISOString();
      const { data: existing } = await supabase
        .from("shift_offers")
        .select("*")
        .eq("personnel_id", personnelId)
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(40);

      if (cancelled || !existing) return;

      const offers = existing.map(mapOfferRow);
      for (const offer of offers) {
        showOffer(offer);
      }

      if (!cancelled) {
        intervalId = setInterval(pollOffers, 2000);
      }
    };

    initPoll();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [personnelId, showOffer]);

  // --- Realtime: new shift_offers for this guard ---
  useEffect(() => {
    if (!supabase || !personnelId) return;

    const channel = supabase
      .channel(`shift-offers:${personnelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shift_offers",
          filter: `personnel_id=eq.${personnelId}`,
        },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (String(row.status) !== "pending") return;
          const offer = mapOfferRow(row);
          if (new Date(offer.expires_at).getTime() <= Date.now()) return;
          showOffer(offer);
        }
      )
      .subscribe((status) => {
        console.log("[ShiftOffer] Realtime shift_offers subscription:", status);
      });

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [personnelId, showOffer]);

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
      await acceptOfferWithLocation(currentOffer.id, currentOffer.personnel_id);

      safeHaptic("success");

      setTimeout(() => {
        setCurrentOffer(null);
        setAccepting(false);
        showNextFromQueue();
      }, 2000);
    } catch (err) {
      console.error("[ShiftOffer] Accept error:", err);
      Alert.alert("Unable to accept shift", (err as Error)?.message || "Please try again.");
      safeHaptic("error");
      setAccepting(false);
    }
  }, [currentOffer, accepting, showNextFromQueue]);

  const declineOffer = useCallback(async () => {
    if (!currentOffer || !supabase) return;
    safeHaptic("light");
    await supabase
      .from("shift_offers")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", currentOffer.id)
      .eq("personnel_id", currentOffer.personnel_id);
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
