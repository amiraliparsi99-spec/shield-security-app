"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getShieldBlogPosts } from "@/data/shield-blog";
import { useDropdown } from "./useDropdown";

type Role = "venue" | "personnel" | "agency" | "admin";

const TOUR_IDS: Partial<Record<Role, string>> = {
  venue: "venue-v1",
  personnel: "personnel-v1",
  agency: "agency-v1",
};

// Keep in sync with STORAGE_KEY_PREFIX in OnboardingTour.tsx
const TOUR_STORAGE_PREFIX = "shield-tour-completed-";

function MenuItem({
  href,
  onClick,
  icon,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const className =
    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white";
  const content = (
    <>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
        {icon}
      </span>
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function HelpMenu({ role, dashboardPath }: { role: Role; dashboardPath: string }) {
  const { open, setOpen, ref } = useDropdown();
  const router = useRouter();
  const posts = getShieldBlogPosts().slice(0, 3);
  const tourId = TOUR_IDS[role];

  function replayTour() {
    if (!tourId) return;
    localStorage.removeItem(`${TOUR_STORAGE_PREFIX}${tourId}`);
    setOpen(false);
    // The tour auto-starts from the dashboard layout once its storage flag is gone.
    if (window.location.pathname === dashboardPath) {
      window.location.reload();
    } else {
      window.location.href = dashboardPath;
    }
  }

  function askShieldAI() {
    setOpen(false);
    // Opens the floating assistant if it's mounted (dashboard pages + /help);
    // otherwise take the user to the Help Centre where it is available.
    const onDashboard =
      window.location.pathname.startsWith("/d/") ||
      window.location.pathname.startsWith("/help");
    if (onDashboard) {
      window.dispatchEvent(new CustomEvent("shield-ai:open"));
    } else {
      router.push("/help");
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Help and resources"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <MenuItem
            href="/help"
            onClick={() => setOpen(false)}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            }
          >
            Help Centre &amp; FAQs
          </MenuItem>

          <MenuItem
            href="/help/tickets"
            onClick={() => setOpen(false)}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            }
          >
            Contact support
          </MenuItem>

          <MenuItem
            onClick={askShieldAI}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            }
          >
            Ask Shield AI
          </MenuItem>

          {tourId && (
            <MenuItem
              onClick={replayTour}
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Replay app tour
            </MenuItem>
          )}

          {/* What's new */}
          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <div className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              What&apos;s new
            </div>
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 transition hover:bg-white/[0.04]"
              >
                <span className="block truncate text-sm text-zinc-300">{post.title}</span>
                <span className="block text-[11px] text-zinc-600">
                  {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </Link>
            ))}
            <Link
              href="/blog"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-xs font-medium text-shield-400 transition hover:bg-white/[0.04] hover:text-shield-300"
            >
              All updates →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
