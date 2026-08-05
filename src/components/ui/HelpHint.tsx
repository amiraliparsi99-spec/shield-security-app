"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface HelpHintProps {
  /** Plain-language explanation shown in the popover. */
  children: React.ReactNode;
  /** Optional short label/title shown above the explanation. */
  label?: string;
  /** Which side the popover opens towards. Defaults to "top". */
  side?: "top" | "bottom";
  className?: string;
}

/**
 * A small "?" trigger that reveals a plain-language explanation on click.
 * Use it next to any jargon (geofence, Shield Score, travel risk, etc.) so
 * non-technical users always have a way to understand what something means.
 */
export function HelpHint({ children, label, side = "top", className }: HelpHintProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className ?? ""}`}>
      <span
        role="button"
        tabIndex={0}
        aria-label={label ? `Help: ${label}` : "Help"}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }
        }}
        className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/5 text-[10px] font-bold leading-none text-zinc-300 transition hover:border-shield-400/60 hover:bg-shield-500/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-shield-400/50"
      >
        ?
      </span>

      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: side === "top" ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: side === "top" ? 6 : -6 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-900/95 p-3 text-left shadow-2xl backdrop-blur-xl ${
              side === "top" ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            {label && (
              <span className="mb-1 block text-xs font-semibold text-white">{label}</span>
            )}
            <span className="block text-xs leading-relaxed text-zinc-400">{children}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
