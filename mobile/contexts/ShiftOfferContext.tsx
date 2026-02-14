/**
 * ShiftOfferContext — Uber-style shift offer popup system
 *
 * Subscribes to Supabase Realtime on the shift_offers table.
 * When a new pending offer arrives for the current guard,
 * it triggers the ShiftOfferPopup overlay with a countdown timer.
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
import { getPersonnelId } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import * as Notifications from "expo-notifications";

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

// ——— Provider ———

export function ShiftOfferProvider({ children }: { children: React.ReactNode }) {
  const [currentOffer, setCurrentOffer] = useState<ShiftOffer | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const offerQueueRef = useRef<ShiftOffer[]>([]);

  // --- Initialize: get the current user's personnel ID ---
  useEffect(() => {
    if (!supabase) return;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Resolve personnel ID (try profile → auth fallback)
      const pId = await getPersonnelId(supabase, user.id);
      if (pId) {
        setPersonnelId(pId);
      }
    };

    init();

    // Re-init on auth change
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUserId(session.user.id);
        const pId = await getPersonnelId(supabase, session.user.id);
        setPersonnelId(pId);
      } else if (event === "SIGNED_OUT") {
        setUserId(null);
        setPersonnelId(null);
        setCurrentOffer(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- Subscribe to Supabase Realtime for new shift_offers ---
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
        (payload) => {
          const offer = payload.new as ShiftOffer;
          if (offer.status === "pending") {
            handleNewOffer(offer);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[ShiftOffer] Subscribed to realtime offers for", personnelId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [personnelId]);

  // --- Also intercept foreground push notifications ---
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.type === "new_shift_offer" && data?.shift_id) {
        // The realtime subscription will handle showing the popup.
        // This listener is just for extra reliability — vibrate to alert.
        if (Platform.OS !== "web") {
          Vibration.vibrate([0, 200, 100, 200]);
        }
      }
    });

    return () => sub.remove();
  }, []);

  // --- Countdown timer ---
  useEffect(() => {
    if (!currentOffer) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    // Calculate initial countdown from expires_at
    const expiresAt = new Date(currentOffer.expires_at).getTime();
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    setCountdown(remaining);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Offer expired — auto-dismiss and show next in queue
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

  // --- Offer handling ---

  const handleNewOffer = useCallback(
    (offer: ShiftOffer) => {
      // Vibrate + haptic to alert the guard
      if (Platform.OS !== "web") {
        Vibration.vibrate([0, 300, 100, 300]);
      }
      safeHaptic("heavy");

      if (currentOffer) {
        // Queue the offer if one is already showing
        offerQueueRef.current.push(offer);
      } else {
        setCurrentOffer(offer);
      }
    },
    [currentOffer]
  );

  const showNextFromQueue = useCallback(() => {
    const next = offerQueueRef.current.shift();
    if (next) {
      // Only show if not expired
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
      // 1. Mark this offer as accepted
      const { error: offerErr } = await supabase
        .from("shift_offers")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", currentOffer.id)
        .eq("status", "pending");

      if (offerErr) {
        console.error("[ShiftOffer] Offer update error:", offerErr);
        throw offerErr;
      }

      // 2. Claim the shift (atomic — only works if still unassigned)
      const { error: shiftErr } = await supabase
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

      if (shiftErr) {
        console.warn("[ShiftOffer] Shift claim failed (may already be taken):", shiftErr);
      }

      // 3. Expire other pending offers for this shift
      await supabase
        .from("shift_offers")
        .update({
          status: "expired",
          responded_at: new Date().toISOString(),
        })
        .eq("shift_id", currentOffer.shift_id)
        .eq("status", "pending")
        .neq("id", currentOffer.id);

      safeHaptic("success");

      // Brief delay to show success state before dismissing
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
    if (!currentOffer || !supabase) return;

    safeHaptic("light");

    try {
      await supabase
        .from("shift_offers")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", currentOffer.id);
    } catch (err) {
      console.warn("[ShiftOffer] Decline error:", err);
    }

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
