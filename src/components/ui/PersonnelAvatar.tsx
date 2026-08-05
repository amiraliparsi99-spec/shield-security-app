"use client";

type PersonnelAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  xs: "h-8 w-8 text-xs rounded-lg",
  sm: "h-10 w-10 text-xs rounded-lg",
  md: "h-12 w-12 text-sm rounded-xl",
  lg: "h-16 w-16 text-lg rounded-2xl",
  xl: "h-24 w-24 text-2xl rounded-2xl",
};

export function PersonnelAvatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
}: PersonnelAvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizing = sizeClasses[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`shrink-0 object-cover ring-1 ring-white/10 ${sizing} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-shield-500 to-cyan-600 font-semibold text-white ring-1 ring-white/10 ${sizing} ${className}`}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}
