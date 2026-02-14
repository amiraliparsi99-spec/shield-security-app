"use client";

import { motion } from "framer-motion";

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

export function MetricsCard({ title, value, subtitle, icon, trend, onClick }: MetricsCardProps) {
  const Card = onClick ? motion.button : motion.div;
  
  return (
    <Card
      className={`glass group rounded-2xl p-6 text-left transition-all ${
        onClick ? "cursor-pointer hover:shadow-glow-sm" : ""
      }`}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-shield-500/20 text-shield-400 transition-colors group-hover:bg-shield-500/30">
          {icon}
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              trend.isPositive
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-zinc-400">{title}</p>
        <p className="mt-1 font-display text-3xl font-semibold text-white">{value}</p>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
    </Card>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

export function QuickActionCard({ title, description, icon, href, onClick }: QuickActionCardProps) {
  const Component = href ? "a" : "button";
  
  return (
    <Component
      href={href}
      onClick={onClick}
      className="glass group flex items-center gap-4 rounded-xl p-4 text-left transition-all hover:shadow-glow-sm"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-shield-500/20 text-shield-400 transition-colors group-hover:bg-shield-500/30">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-400">{description}</p>
      </div>
      <svg className="h-5 w-5 text-zinc-500 transition-colors group-hover:text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Component>
  );
}

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  type: "booking" | "staff" | "assignment" | "message";
}

export function ActivityItem({ title, description, time, type }: ActivityItemProps) {
  const iconMap = {
    booking: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    staff: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    assignment: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    message: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  };

  const colorMap = {
    booking: "bg-blue-500/20 text-blue-400",
    staff: "bg-purple-500/20 text-purple-400",
    assignment: "bg-emerald-500/20 text-emerald-400",
    message: "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorMap[type]}`}>
        {iconMap[type]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
      </div>
      <time className="shrink-0 text-xs text-zinc-500">{time}</time>
    </div>
  );
}
