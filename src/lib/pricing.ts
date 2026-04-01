export type PricingRole = {
  label: string;
  count: number;
  rateGBP: number;
};

export type BookingPricingInput = {
  start_time?: string | null;
  end_time?: string | null;
  estimated_total?: number | null;
  final_total?: number | null;
  staff_requirements?: any;
};

export function getHoursFromTimeRange(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMinutes = sh * 60 + (sm || 0);
  let endMinutes = eh * 60 + (em || 0);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return (endMinutes - startMinutes) / 60;
}

function toRateGBP(row: any): number {
  const rateRaw = Number(row?.rate_pence ?? row?.rate ?? row?.hourly_rate ?? 0);
  if (!Number.isFinite(rateRaw) || rateRaw <= 0) return 0;
  return row?.rate_pence != null ? rateRaw / 100 : rateRaw >= 100 ? rateRaw / 100 : rateRaw;
}

function toCount(row: any): number {
  const count = Number(row?.count ?? row?.quantity ?? row?.staff_count ?? row?.guards_count ?? 1);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

export function normalizeRoleLabel(role: string): string {
  if (!role) return "Security";
  return role
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeRoleId(role: string): string {
  const lower = (role || "").trim().toLowerCase();
  if (lower === "door supervisor") return "door_supervisor";
  if (lower === "security guard") return "security_guard";
  if (lower === "cctv operator") return "cctv_operator";
  return lower.replace(/\s+/g, "_");
}

export function toCanonicalStaffRequirements(
  requirements: Array<{ role: string; quantity?: number; count?: number; rate: number }>
): Array<{ role: string; count: number; rate_pence: number }> {
  return requirements.map((req) => ({
    role: normalizeRoleId(req.role),
    count: Number(req.count ?? req.quantity ?? 1),
    rate_pence: Math.round(Number(req.rate || 0) * 100),
  }));
}

export function getPricingBreakdown(input: BookingPricingInput): {
  totalGBP: number;
  staffCount: number;
  hours: number;
  roles: PricingRole[];
} {
  const hours = getHoursFromTimeRange(input.start_time, input.end_time);
  const sr = input.staff_requirements;

  const roles: PricingRole[] = [];
  if (Array.isArray(sr)) {
    for (const row of sr) {
      roles.push({
        label: normalizeRoleLabel(String(row?.security_type || row?.role || "Security")),
        count: toCount(row),
        rateGBP: toRateGBP(row),
      });
    }
  } else if (sr && typeof sr === "object") {
    roles.push({
      label: normalizeRoleLabel(String(sr.security_type || sr.role || "Security")),
      count: toCount(sr),
      rateGBP: toRateGBP(sr),
    });
  }

  const staffCount = roles.reduce((sum, r) => sum + r.count, 0) || 1;
  if (roles.length > 0 && hours > 0) {
    return {
      totalGBP: roles.reduce((sum, r) => sum + r.count * r.rateGBP * hours, 0),
      staffCount,
      hours,
      roles,
    };
  }

  const raw = Math.abs(Number(input.final_total ?? input.estimated_total ?? 0));
  return {
    totalGBP: raw > 0 ? raw / 100 : 0,
    staffCount,
    hours,
    roles,
  };
}
