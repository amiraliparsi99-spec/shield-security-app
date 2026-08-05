import Image from "next/image";
import Link from "next/link";

const SIZES = {
  sm: 32,
  md: 40,
  lg: 52,
} as const;

type ShieldLogoProps = {
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
};

export function ShieldLogo({ size = "md", className = "", priority = false }: ShieldLogoProps) {
  const height = SIZES[size];

  return (
    <Image
      src="/shield-hq-logo-sm.png"
      alt="Shield HQ"
      width={height * 2}
      height={height}
      priority={priority}
      unoptimized
      className={`object-contain ${className}`}
      style={{ height, width: "auto", maxWidth: height * 2.2 }}
    />
  );
}

type AuthBrandLinkProps = {
  size?: keyof typeof SIZES;
  className?: string;
};

export function AuthBrandLink({ size = "md", className = "" }: AuthBrandLinkProps) {
  return (
    <Link href="/" className={`inline-flex items-center transition-opacity hover:opacity-90 ${className}`}>
      <ShieldLogo size={size} priority />
    </Link>
  );
}
