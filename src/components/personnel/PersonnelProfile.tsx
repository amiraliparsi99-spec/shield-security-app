"use client";

import Link from "next/link";
import { useId } from "react";
import type { Personnel, PersonnelReviewWithAuthor } from "@/types/database";
import { formatLocation, formatExperience, formatRating } from "@/lib/format";

interface PersonnelProfileProps {
  personnel: Personnel;
  avatarUrl?: string | null;
  reviews: PersonnelReviewWithAuthor[];
}

function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const rawId = useId();
  const gradientId = `star-half-${String(rawId).replace(/\W/g, "-")}`;
  const full = Math.floor(value);
  const half = value % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const s = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`${formatRating(value)} out of 5`}>
      {Array.from({ length: full }, (_, i) => (
        <svg key={`f-${i}`} className={s} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
      ))}
      {half ? (
        <svg className={s} fill="currentColor" viewBox="0 0 20 20"><defs><linearGradient id={gradientId}><stop offset="50%" stopColor="currentColor"/><stop offset="50%" stopColor="transparent"/></linearGradient></defs><path fill={`url(#${gradientId})`} d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
      ) : null}
      {Array.from({ length: empty }, (_, i) => (
        <svg key={`e-${i}`} className={`${s} text-white/20`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: Personnel["status"] }) {
  const styles: Record<Personnel["status"], string> = {
    available: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    looking: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    booked: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    off: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  const labels: Record<Personnel["status"], string> = {
    available: "Available",
    looking: "Looking for work",
    booked: "Booked",
    off: "Off",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function PersonnelProfile({ personnel, avatarUrl, reviews }: PersonnelProfileProps) {
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header: avatar, name, status */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-24 w-24 rounded-2xl object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-shield-500/15 text-2xl font-semibold text-shield-400 ring-1 ring-white/10">
              {personnel.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold">{personnel.display_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={personnel.status} />
            {personnel.insurance_verified && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-400">
                Insurance verified
              </span>
            )}
          </div>

          {/* Location */}
          <div className="mt-4 flex items-center gap-2 text-zinc-400">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span>{formatLocation(personnel)}</span>
          </div>

          {/* Experience: how long in security */}
          <div className="mt-2 flex items-center gap-2 text-zinc-400">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{formatExperience(personnel)}</span>
          </div>

          {personnel.user_id && (
            <Link
              href={"/chat/start?with=" + encodeURIComponent(personnel.user_id)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-shield-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition hover:bg-shield-600 active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Message
            </Link>
          )}
        </div>
      </div>

      {/* Certs, rate, bio */}
      <div className="mt-8 space-y-6">
        {personnel.certs.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Certifications</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {personnel.certs.map((c) => (
                <span
                  key={c}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {personnel.rate_per_hour != null && (
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Rate</h2>
            <p className="mt-1 text-lg font-medium">
              £{(personnel.rate_per_hour / 100).toFixed(2)}
              <span className="text-zinc-400 font-normal">/hr</span>
            </p>
          </div>
        )}

        {personnel.bio && (
          <div>
            <h2 className="text-sm font-medium text-zinc-500">About</h2>
            <p className="mt-2 text-zinc-300 leading-relaxed">{personnel.bio}</p>
          </div>
        )}
      </div>

      {/* Reviews */}
      <section className="mt-10 border-t border-white/10 pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-lg font-semibold">Reviews</h2>
          {avgRating != null && (
            <div className="flex items-center gap-2">
              <Stars value={avgRating} size="md" />
              <span className="text-zinc-400">
                {formatRating(avgRating)} · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="mt-4 text-zinc-500">No reviews yet.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Stars value={r.rating} size="sm" />
                    {r.comment && <p className="mt-2 text-zinc-300 text-sm leading-relaxed">{r.comment}</p>}
                    <p className="mt-2 text-xs text-zinc-500">
                      {r.author_name ?? "Venue"}
                      {r.venue_name ? ` at ${r.venue_name}` : ""}
                      {" · "}
                      {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
