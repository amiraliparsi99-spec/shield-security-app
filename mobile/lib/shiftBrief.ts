/** Guard-facing brief helpers — mirrors web `src/lib/booking/brief.ts`. */

const ATTIRE_RE = /Attire requirement:\s*(.+)/i;
const ACCESS_RE = /Access \/ entry:\s*(.+)/im;
const CONTACT_RE = /Contact on site:\s*(.+)/im;

export function extractAttireRequirement(briefNotes?: string | null): string | null {
  return briefNotes?.match(ATTIRE_RE)?.[1]?.trim() ?? null;
}

export function briefBodyForGuard(briefNotes?: string | null): string | null {
  if (!briefNotes?.trim()) return null;

  let remainder = briefNotes.trim();
  remainder = remainder.replace(ATTIRE_RE, "").trim();

  const accessMatch = remainder.match(ACCESS_RE);
  const accessNotes = accessMatch?.[1]?.trim() || "";
  remainder = remainder.replace(ACCESS_RE, "").trim();

  const contactMatch = remainder.match(CONTACT_RE);
  const contactNotes = contactMatch?.[1]?.trim() || "";
  remainder = remainder.replace(CONTACT_RE, "").trim();

  const lines: string[] = [];
  if (remainder.trim()) lines.push(remainder.trim());
  if (accessNotes) lines.push(`Access / entry: ${accessNotes}`);
  if (contactNotes) lines.push(`Contact on site: ${contactNotes}`);
  return lines.length > 0 ? lines.join("\n\n") : null;
}

export function briefPreview(briefNotes?: string | null, maxLen = 120): string | null {
  const body = briefBodyForGuard(briefNotes);
  const attire = extractAttireRequirement(briefNotes);
  const combined = [body, attire ? `Attire: ${attire}` : null].filter(Boolean).join(" · ");
  if (!combined) return null;
  if (combined.length <= maxLen) return combined;
  return `${combined.slice(0, maxLen - 1).trim()}…`;
}
