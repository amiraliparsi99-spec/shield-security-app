import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { fetchApi } from "../../lib/api";
import { getPersonnelId, getProfileIdAndRole } from "../../lib/auth";
import { colors, radius, spacing, typography } from "../../theme";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const MIN_WINDOW_MS = 60 * 1000;
const POLL_MS = 7500;
const STORAGE_KEY = "attendance_confirm_responses_v1";
/** Hard deadline on any single confirm/cancel POST. Without this the modal
 *  gets stuck on the "busy" spinner forever if the network is flaky. */
const REQUEST_TIMEOUT_MS = 10000;

type ResponseState = Record<
  string,
  { status: "confirmed" | "cannot_make_it"; reason?: string; responded_at: string }
>;

type PromptShift = {
  id: string;
  booking_id: string;
  scheduled_start: string;
  accepted_at: string | null;
  role: string | null;
  event_name: string;
  venue_name: string;
};

function shouldSuppressPromptForCurrentAcceptance(
  response: ResponseState[string] | undefined,
  acceptedAt: string | null,
): boolean {
  if (!response) return false;

  const respondedMs = Date.parse(response.responded_at);
  const acceptedMs = acceptedAt ? Date.parse(acceptedAt) : Number.NaN;

  // If the shift has been accepted again after a prior response, prompt again.
  if (Number.isFinite(acceptedMs) && Number.isFinite(respondedMs) && acceptedMs > respondedMs) {
    return false;
  }

  return true;
}

/** Wraps a fetch in an AbortController with a timeout so we never leave the
 *  user's Confirm button spinning forever. */
async function fetchWithTimeout(
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

export function ShiftAttendanceConfirmPopup() {
  const insets = useSafeAreaInsets();
  const [responses, setResponses] = useState<ResponseState>({});
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [currentShift, setCurrentShift] = useState<PromptShift | null>(null);
  const [mode, setMode] = useState<"choice" | "reason">("choice");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  /** Prevents overlapping polls — if the last check is still in flight we
   *  skip this tick instead of stacking more work on top. */
  const pollInFlight = useRef(false);

  const responseKey = useCallback(
    (shiftId: string) => (currentUserId ? `${currentUserId}:${shiftId}` : shiftId),
    [currentUserId]
  );

  const persistResponses = useCallback(async (next: ResponseState) => {
    setResponses(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("[AttendanceConfirm] storage save failed:", e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        try {
          const parsed = raw ? (JSON.parse(raw) as ResponseState) : {};
          setResponses(parsed || {});
        } catch {
          setResponses({});
        }
        setStorageLoaded(true);
      })
      .catch(() => {
        if (mounted) {
          setResponses({});
          setStorageLoaded(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const checkForPrompt = useCallback(async () => {
    if (!supabase || !storageLoaded) return;
    if (pollInFlight.current) return;
    // Do not interrupt the user while they are typing a release reason.
    if (mode === "reason" && currentShift) return;

    pollInFlight.current = true;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUserId(null);
        setCurrentShift(null);
        return;
      }
      setCurrentUserId(user.id);

      const profile = await getProfileIdAndRole(supabase, user.id);
      if (!profile || profile.role !== "personnel") {
        setCurrentShift(null);
        return;
      }

      const personnelId = await getPersonnelId(supabase, profile.profileId);
      if (!personnelId) {
        setCurrentShift(null);
        return;
      }

      const nowIso = new Date().toISOString();
      // attendance_confirmed_at is the DB-backed source of truth post-migration
      // 0054. We request it tolerantly: if the column doesn't exist (older DB),
      // Supabase returns an error and we fall back to a simpler select. This
      // keeps the prompt working during the migration rollout window.
      let shiftsRows: Array<{
        id: string;
        booking_id: string;
        scheduled_start: string;
        accepted_at: string | null;
        role: string | null;
        status: string;
        attendance_confirmed_at?: string | null;
      }> | null = null;
      const richResp = await supabase
        .from("shifts")
        .select(
          "id, booking_id, scheduled_start, accepted_at, role, status, attendance_confirmed_at",
        )
        .eq("personnel_id", personnelId)
        .eq("status", "accepted")
        .gt("scheduled_start", nowIso)
        .order("scheduled_start", { ascending: true })
        .limit(20);
      if (richResp.error) {
        const fallback = await supabase
          .from("shifts")
          .select("id, booking_id, scheduled_start, accepted_at, role, status")
          .eq("personnel_id", personnelId)
          .eq("status", "accepted")
          .gt("scheduled_start", nowIso)
          .order("scheduled_start", { ascending: true })
          .limit(20);
        shiftsRows = fallback.data as typeof shiftsRows;
      } else {
        shiftsRows = richResp.data as typeof shiftsRows;
      }

      if (!shiftsRows || shiftsRows.length === 0) {
        setCurrentShift(null);
        return;
      }

      const nowMs = Date.now();
      const candidate = shiftsRows.find((s) => {
        // Server-side confirm wins over local AsyncStorage. Prevents the prompt
        // from re-appearing after reinstall once the guard has already tapped.
        if (s.attendance_confirmed_at) {
          const confirmedMs = Date.parse(s.attendance_confirmed_at);
          const acceptedMs = s.accepted_at ? Date.parse(s.accepted_at) : Number.NaN;
          if (
            !Number.isFinite(acceptedMs) ||
            !Number.isFinite(confirmedMs) ||
            confirmedMs >= acceptedMs
          ) {
            return false;
          }
        }
        const key = `${user.id}:${s.id}`;
        const dismissKey = `${key}:${s.accepted_at ?? "none"}`;
        if (shouldSuppressPromptForCurrentAcceptance(responses[key], s.accepted_at ?? null)) {
          return false;
        }
        if (dismissed.has(dismissKey)) return false;
        const msUntil = new Date(s.scheduled_start).getTime() - nowMs;
        return msUntil <= TWO_HOURS_MS && msUntil >= MIN_WINDOW_MS;
      });

      if (!candidate) {
        setCurrentShift(null);
        return;
      }

      let eventName = "Shift";
      let venueName = "the venue";
      const { data: booking } = await supabase
        .from("bookings")
        .select("event_name, venue_id, site_label, agency_id")
        .eq("id", candidate.booking_id)
        .maybeSingle();
      if (booking?.event_name) eventName = booking.event_name;
      if (booking?.site_label) {
        venueName = booking.site_label;
      } else if (booking?.venue_id) {
        const { data: venue } = await supabase
          .from("venues")
          .select("name")
          .eq("id", booking.venue_id)
          .maybeSingle();
        if (venue?.name) venueName = venue.name;
      } else if (booking?.agency_id) {
        const { data: agency } = await supabase
          .from("agencies")
          .select("name")
          .eq("id", booking.agency_id)
          .maybeSingle();
        if (agency?.name) venueName = agency.name;
      }

      const nextShift: PromptShift = {
        id: candidate.id,
        booking_id: candidate.booking_id,
        scheduled_start: candidate.scheduled_start,
        accepted_at: candidate.accepted_at ?? null,
        role: candidate.role,
        event_name: eventName,
        venue_name: venueName,
      };

      // If we're already handling this same shift (e.g. user typing reason),
      // refresh data without forcing the UI back to choice mode.
      if (currentShift?.id === nextShift.id) {
        setCurrentShift((prev) => (prev ? { ...prev, ...nextShift } : nextShift));
        return;
      }

      setCurrentShift(nextShift);
      setMode("choice");
      setError(null);
    } finally {
      pollInFlight.current = false;
    }
  }, [responses, storageLoaded, dismissed, mode, currentShift]);

  useEffect(() => {
    checkForPrompt();
    const timer = setInterval(checkForPrompt, POLL_MS);
    return () => clearInterval(timer);
  }, [checkForPrompt]);

  const shiftTimeText = useMemo(() => {
    if (!currentShift) return "";
    return new Date(currentShift.scheduled_start).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [currentShift]);

  /** Emergency dismiss — suppresses the prompt for this accepted version of
   *  the shift for the rest of the session. Available even while busy so the
   *  user is never truly locked into the modal if something goes wrong. */
  const dismissForSession = useCallback(() => {
    if (!currentShift || !currentUserId) {
      setCurrentShift(null);
      setBusy(false);
      setError(null);
      return;
    }
    const dismissKey = `${currentUserId}:${currentShift.id}:${currentShift.accepted_at ?? "none"}`;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(dismissKey);
      return next;
    });
    setCurrentShift(null);
    setReason("");
    setMode("choice");
    setBusy(false);
    setError(null);
  }, [currentShift, currentUserId]);

  /**
   * Try to grab a quick GPS fix to send alongside the confirm. Best-effort:
   * if permission isn't granted or the device is slow to fix, we send the
   * confirm without location so the modal never blocks on it.
   */
  const captureLocationBestEffort = useCallback(async (): Promise<{
    lat: number;
    lng: number;
    accuracy_m?: number;
    recorded_at: string;
  } | null> => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") return null;
      // 4s budget — the Confirm tap should feel instant. We prefer the last
      // known fix and only escalate to a fresh fix if there isn't one cached.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
      const fix =
        last ??
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]));
      if (!fix) return null;
      return {
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
        accuracy_m: fix.coords.accuracy ?? undefined,
        recorded_at: new Date(fix.timestamp ?? Date.now()).toISOString(),
      };
    } catch {
      return null;
    }
  }, []);

  const confirmAttendance = useCallback(async () => {
    if (!currentShift || !currentUserId || busy) return;
    if (!supabase) return;

    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No active session");
      }

      const location = await captureLocationBestEffort();

      const res = await fetchWithTimeout(
        "/api/shifts/attendance-confirm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            shift_id: currentShift.id,
            response: "can_make_it",
            location,
          }),
        },
        REQUEST_TIMEOUT_MS,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Unable to confirm attendance");
      }

      const key = responseKey(currentShift.id);
      const next: ResponseState = {
        ...responses,
        [key]: {
          status: "confirmed" as const,
          responded_at: new Date().toISOString(),
        },
      };
      setCurrentShift(null);
      await persistResponses(next);
    } catch (e: any) {
      const msg = e?.message || "";
      const friendly =
        msg.toLowerCase().includes("abort") || msg.includes("timed out")
          ? "The request timed out. Check your connection and try again."
          : msg || "Please try again.";
      setError(friendly);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    captureLocationBestEffort,
    currentShift,
    currentUserId,
    persistResponses,
    responseKey,
    responses,
  ]);

  const submitCannotMakeIt = useCallback(async () => {
    if (!currentShift || busy || !currentUserId) return;
    if (reason.trim().length < 5) {
      Alert.alert("Reason required", "Please enter at least 5 characters.");
      return;
    }
    if (!supabase) return;

    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No active session");
      }

      const res = await fetchWithTimeout(
        "/api/shifts/cancel",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            shift_id: currentShift.id,
            reason: reason.trim(),
            cancelled_by: "guard",
          }),
        },
        REQUEST_TIMEOUT_MS,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Unable to release shift");
      }

      const key = responseKey(currentShift.id);
      const next = {
        ...responses,
        [key]: {
          status: "cannot_make_it" as const,
          reason: reason.trim(),
          responded_at: new Date().toISOString(),
        },
      };
      await persistResponses(next);
      setCurrentShift(null);
      setReason("");
      setMode("choice");
    } catch (e: any) {
      const msg = e?.message || "";
      const friendly =
        msg.toLowerCase().includes("abort") || msg.includes("timed out")
          ? "The request timed out. Check your connection and try again."
          : msg || "Please try again.";
      setError(friendly);
    } finally {
      setBusy(false);
    }
  }, [busy, currentShift, currentUserId, persistResponses, reason, responseKey, responses]);

  if (!currentShift) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissForSession}
    >
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <LinearGradient
          colors={["rgba(0,0,0,0.86)", "rgba(0,0,0,0.96)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.card}>
          {/* Always-available escape hatch. Never disabled, so the modal can
              never trap the user even if the network hangs. */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={dismissForSession}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Can you definitely make this shift?</Text>
          <Text style={styles.subtitle}>
            {currentShift.event_name} at {currentShift.venue_name}
          </Text>
          <Text style={styles.meta}>
            {shiftTimeText} {currentShift.role ? `• ${currentShift.role}` : ""}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {mode === "choice" ? (
            <>
              <TouchableOpacity
                style={[styles.confirmBtn, busy && styles.disabled]}
                onPress={confirmAttendance}
                disabled={busy}
              >
                {busy ? (
                  <View style={styles.btnInner}>
                    <ActivityIndicator color="#05211d" />
                    <Text style={styles.confirmText}>Confirming…</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmText}>Yes, I can make it</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cannotBtn, busy && styles.disabled]}
                onPress={() => {
                  setError(null);
                  setMode("reason");
                }}
                disabled={busy}
              >
                <Text style={styles.cannotText}>I can't confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.laterBtn}
                onPress={dismissForSession}
              >
                <Text style={styles.laterText}>Remind me later</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="Why can't you make it?"
                placeholderTextColor={colors.textMuted}
                multiline
                editable={!busy}
              />
              <TouchableOpacity
                style={[styles.confirmBtn, busy && styles.disabled]}
                onPress={submitCannotMakeIt}
                disabled={busy}
              >
                {busy ? (
                  <View style={styles.btnInner}>
                    <ActivityIndicator color="#05211d" />
                    <Text style={styles.confirmText}>Releasing…</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmText}>Submit and release shift</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cannotBtn}
                onPress={() => {
                  setReason("");
                  setError(null);
                  setMode("choice");
                }}
                disabled={busy}
              >
                <Text style={styles.cannotText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: "#070b10",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: spacing.lg,
    paddingTop: spacing.lg + 8,
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  closeBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    ...typography.titleCard,
    color: colors.text,
    marginBottom: spacing.xs,
    paddingRight: 28,
  },
  subtitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: "#ff9a7a",
    backgroundColor: "rgba(255, 90, 60, 0.08)",
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 90, 60, 0.25)",
  },
  confirmBtn: {
    backgroundColor: "#00c7a2",
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginBottom: spacing.sm,
  },
  confirmText: {
    color: "#021611",
    fontWeight: "800",
    fontSize: 15,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cannotBtn: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  cannotText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 14,
  },
  laterBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  laterText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
  },
  input: {
    minHeight: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "#05080d",
    color: "#f5f7fa",
    padding: spacing.md,
    textAlignVertical: "top",
    marginBottom: spacing.sm,
  },
  disabled: {
    opacity: 0.6,
  },
});
