"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IntroVideoPlayer } from "@/components/personnel/IntroVideoPlayer";
import { AddToPreferredButton } from "@/components/personnel/AddToPreferredButton";

interface ScoutGuard {
  id: string;
  display_name: string | null;
  city: string | null;
  bio: string | null;
  skills: string[] | null;
  shield_score: number | null;
  hourly_rate: number | null;
  intro_video_status: string | null;
  intro_video_playback_id: string | null;
}

function rateLabel(g: ScoutGuard): string | null {
  if (g.hourly_rate != null) return `£${g.hourly_rate}/hr`;
  return null;
}

/**
 * Searchable directory of available guards for venues/agencies to scout.
 * Leads with each guard's intro video (Mux thumbnail + play badge) so hirers
 * can see who they are before booking/recruiting. RLS limits rows to active +
 * available personnel.
 */
export function ScoutDirectory() {
  const supabase = createClient();
  const [guards, setGuards] = useState<ScoutGuard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState<string>("");
  const [videoOnly, setVideoOnly] = useState(false);
  const [selected, setSelected] = useState<ScoutGuard | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("personnel")
        .select(
          "id, display_name, city, bio, skills, shield_score, hourly_rate, intro_video_status, intro_video_playback_id",
        )
        .eq("is_active", true)
        .eq("is_available", true)
        .limit(200);
      if (!cancelled) {
        setGuards((data as ScoutGuard[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const allSkills = useMemo(() => {
    const set = new Set<string>();
    guards.forEach((g) => (g.skills ?? []).forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [guards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guards
      .filter((g) => {
        if (videoOnly && g.intro_video_status !== "approved") return false;
        if (skill && !(g.skills ?? []).includes(skill)) return false;
        if (q) {
          const hay = `${g.display_name ?? ""} ${g.city ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Video-having + higher Shield Score first.
        const av = a.intro_video_status === "approved" ? 1 : 0;
        const bv = b.intro_video_status === "approved" ? 1 : 0;
        if (av !== bv) return bv - av;
        return (b.shield_score ?? 0) - (a.shield_score ?? 0);
      });
  }, [guards, search, skill, videoOnly]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Find Staff</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Browse available security professionals. Watch their intro video to
          see who you&apos;re bringing on before you book.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or city…"
          className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-shield-500/50 focus:outline-none"
        />
        <select
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none"
        >
          <option value="">All skills</option>
          {allSkills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setVideoOnly((v) => !v)}
          className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            videoOnly
              ? "bg-shield-500 text-white"
              : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
          }`}
        >
          ▶ Has intro video
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-400">
          No available guards match your filters yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <ScoutCard key={g.id} guard={g} onOpen={() => setSelected(g)} />
          ))}
        </div>
      )}

      {selected && (
        <ScoutModal guard={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

interface ScoutReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface AvailabilityRow {
  day_of_week: number; // 0=Sun .. 6=Sat
  start_time: string | null;
  end_time: string | null;
}

// Mon-first ordering for display.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

function fmtTime(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5); // "18:00:00" -> "18:00"
}

function ScoutModal({
  guard,
  onClose,
}: {
  guard: ScoutGuard;
  onClose: () => void;
}) {
  const supabase = createClient();
  const name = guard.display_name || "Security Professional";
  const place = guard.city || null;
  const rate = rateLabel(guard);
  const skills = guard.skills ?? [];
  const hasVideo =
    guard.intro_video_status === "approved" && !!guard.intro_video_playback_id;

  const [reviews, setReviews] = useState<ScoutReview[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("availability")
        .select("day_of_week, start_time, end_time")
        .eq("personnel_id", guard.id)
        .eq("is_available", true);
      if (!cancelled) setAvailability((data as AvailabilityRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, guard.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, overall_rating, content, created_at")
        .eq("reviewee_id", guard.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!cancelled) {
        setReviews(
          ((data as { id: string; overall_rating: number; content: string | null; created_at: string }[]) ?? []).map(
            (r) => ({
              id: r.id,
              rating: Number(r.overall_rating || 0),
              comment: r.content,
              created_at: r.created_at,
            }),
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, guard.id]);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close — top-right, clear of the content */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        <div className="flex flex-col gap-5 sm:flex-row">
          {/* Video / poster — the hero */}
          <div className="mx-auto w-[220px] max-w-full shrink-0 sm:mx-0">
            {hasVideo ? (
              <IntroVideoPlayer
                playbackId={guard.intro_video_playback_id as string}
                name={name}
              />
            ) : (
              <div className="flex aspect-[9/16] max-h-[300px] w-full items-center justify-center rounded-xl bg-shield-500/10 text-4xl font-semibold text-shield-400">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Details + About beside the video */}
          <div className="min-w-0 flex-1 pr-8">
            {/* Name + Shield inline (no clash with the close button) */}
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-white">{name}</h2>
              {guard.shield_score != null && (
                <span className="rounded-full bg-shield-500/15 px-2 py-0.5 text-xs font-medium text-shield-300">
                  {guard.shield_score} Shield
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {place && <span className="text-zinc-400">{place}</span>}
              {rate && <span className="font-medium text-shield-400">{rate}</span>}
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Available for work
              </span>
            </div>

            {availability.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Weekly availability
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DAY_ORDER.filter((d) =>
                    availability.some((a) => a.day_of_week === d),
                  ).map((d) => {
                    const row = availability.find((a) => a.day_of_week === d)!;
                    const time =
                      row.start_time && row.end_time
                        ? `${fmtTime(row.start_time)}–${fmtTime(row.end_time)}`
                        : "All day";
                    return (
                      <span
                        key={d}
                        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-xs text-emerald-200"
                      >
                        <span className="font-medium text-emerald-300">{DAY_LABEL[d]}</span>{" "}
                        {time}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.slice(0, 6).map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">About</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                {guard.bio?.trim()
                  ? guard.bio
                  : `${name} is available for security work${place ? ` around ${place}` : ""}. Watch their intro video above to get a feel for who they are.`}
              </p>
            </div>

            <div className="mt-5">
              <AddToPreferredButton personnelId={guard.id} />
            </div>
          </div>
        </div>

        {/* Reviews — full width under the hero */}
        {reviews.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Reviews</h3>
              {avgRating != null && (
                <span className="text-sm text-amber-400">
                  ★ {avgRating.toFixed(1)}{" "}
                  <span className="text-zinc-500">
                    · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                  </span>
                </span>
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {reviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="text-xs text-amber-400">
                    {"★".repeat(Math.round(r.rating))}
                    <span className="text-zinc-600">
                      {"★".repeat(Math.max(0, 5 - Math.round(r.rating)))}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-1 text-sm leading-relaxed text-zinc-300">{r.comment}</p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoutCard({
  guard,
  onOpen,
}: {
  guard: ScoutGuard;
  onOpen: () => void;
}) {
  const name = guard.display_name || "Security Professional";
  const place = guard.city || null;
  const rate = rateLabel(guard);
  const skills = guard.skills ?? [];
  const hasVideo =
    guard.intro_video_status === "approved" && !!guard.intro_video_playback_id;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:border-shield-500/30 hover:bg-white/[0.06]"
    >
      {/* Video thumbnail / poster — fixed compact height so all cards match */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-black/40">
        {hasVideo ? (
          <>
            {/* smartcrop returns a centred landscape frame from the portrait clip */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://image.mux.com/${guard.intro_video_playback_id}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop`}
              alt=""
              className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-sm text-white ring-1 ring-white/40 backdrop-blur">
                ▶
              </span>
            </span>
            <span className="absolute left-2 top-2 rounded-full bg-shield-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              Intro video
            </span>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-shield-500/10 text-3xl font-semibold text-shield-400">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-white">{name}</span>
          {guard.shield_score != null && (
            <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
              {guard.shield_score} Shield
            </span>
          )}
        </div>
        {place && <p className="mt-1 text-sm text-zinc-400">{place}</p>}
        {skills.length > 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            {skills.slice(0, 3).join(" · ")}
            {skills.length > 3 ? ` · +${skills.length - 3}` : ""}
          </p>
        )}
        <div className="mt-auto pt-3">
          {rate && <span className="text-sm font-medium text-shield-400">{rate}</span>}
        </div>
      </div>
    </button>
  );
}
