"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface EmptyStateProps {
  /** Emoji or icon node shown in the circle. */
  icon?: React.ReactNode;
  title: string;
  description: string;
  /** Primary call-to-action. Provide either `href` (link) or `onAction` (button). */
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * A consistent empty state for web lists and dashboards. Every empty screen
 * should teach the user what this area is for and give them one obvious next
 * step, so they're never left staring at a blank panel.
 */
export function EmptyState({
  icon = "✨",
  title,
  description,
  actionLabel,
  href,
  onAction,
  className,
}: EmptyStateProps) {
  const action = actionLabel ? (
    href ? (
      <Link
        href={href}
        className="inline-flex items-center justify-center rounded-xl bg-shield-500 px-5 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400"
      >
        {actionLabel}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center justify-center rounded-xl bg-shield-500 px-5 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400"
      >
        {actionLabel}
      </button>
    )
  ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className ?? ""}`}
    >
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-shield-500/20 bg-shield-500/10 text-4xl">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-400">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
