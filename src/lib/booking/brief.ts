/** Shared shift brief format — stored in `bookings.brief_notes`. */

export const ATTIRE_OPTIONS = [
  { value: "Smart black uniform", note: "Black shirt/trousers, polished footwear, SIA displayed." },
  { value: "Formal suit", note: "Suit and tie or business formal presentation." },
  { value: "Venue branded uniform", note: "Venue-issued branded uniform." },
  { value: "Hi-vis / stewarding", note: "High-visibility for crowd and perimeter control." },
  { value: "Tactical / PPE", note: "Boots, utility belt, and role-appropriate PPE." },
  { value: "Smart casual", note: "Clean smart-casual attire as agreed by venue." },
] as const;

export type BriefFields = {
  duties: string;
  attire: string;
  accessNotes: string;
  contactNotes: string;
};

export const BRIEF_TEMPLATES: { id: string; label: string; duties: string }[] = [
  {
    id: "door",
    label: "Door & entrance",
    duties:
      "Manage guest entry and exit. Check tickets or guest lists, deter unauthorised access, and maintain a visible presence at the main entrance. Report incidents to the site contact immediately.",
  },
  {
    id: "event",
    label: "Event security",
    duties:
      "Crowd monitoring, perimeter checks, and responding to disturbances. Work with venue staff on capacity and safe egress. Brief with the event manager on arrival.",
  },
  {
    id: "corporate",
    label: "Corporate / reception",
    duties:
      "Reception cover, visitor sign-in, and access control for staff-only areas. Professional presentation; greet visitors and verify appointments.",
  },
  {
    id: "retail",
    label: "Retail / loss prevention",
    duties:
      "Visible deterrence, floor walks, and observing suspicious behaviour. Follow venue policy on stops and detentions — observe and report unless explicitly authorised otherwise.",
  },
  {
    id: "patrol",
    label: "Mobile patrol",
    duties:
      "Scheduled patrols of agreed routes and checkpoints. Log any defects, unsecured doors, or hazards. Complete checkpoint scans where configured in the app.",
  },
];

const ATTIRE_RE = /Attire requirement:\s*(.+)/i;
const ACCESS_RE = /Access \/ entry:\s*(.+)/im;
const CONTACT_RE = /Contact on site:\s*(.+)/im;

export function parseBriefNotes(raw: string | null | undefined): BriefFields {
  if (!raw?.trim()) {
    return {
      duties: "",
      attire: ATTIRE_OPTIONS[0].value,
      accessNotes: "",
      contactNotes: "",
    };
  }

  let remainder = raw.trim();
  const attireMatch = remainder.match(ATTIRE_RE);
  const attire = attireMatch?.[1]?.trim() || ATTIRE_OPTIONS[0].value;
  remainder = remainder.replace(ATTIRE_RE, "").trim();

  const accessMatch = remainder.match(ACCESS_RE);
  const accessNotes = accessMatch?.[1]?.trim() || "";
  remainder = remainder.replace(ACCESS_RE, "").trim();

  const contactMatch = remainder.match(CONTACT_RE);
  const contactNotes = contactMatch?.[1]?.trim() || "";
  remainder = remainder.replace(CONTACT_RE, "").trim();

  return {
    duties: remainder,
    attire,
    accessNotes,
    contactNotes,
  };
}

export function buildBriefNotes(fields: BriefFields): string | null {
  const parts: string[] = [];
  if (fields.duties.trim()) parts.push(fields.duties.trim());
  if (fields.attire.trim()) parts.push(`Attire requirement: ${fields.attire.trim()}`);
  if (fields.accessNotes.trim()) parts.push(`Access / entry: ${fields.accessNotes.trim()}`);
  if (fields.contactNotes.trim()) parts.push(`Contact on site: ${fields.contactNotes.trim()}`);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

export function extractAttireRequirement(briefNotes: string | null | undefined): string | null {
  return briefNotes?.match(ATTIRE_RE)?.[1]?.trim() ?? null;
}

/** Guard-facing body text without the attire line (shown separately on mobile). */
export function briefBodyForGuard(briefNotes: string | null | undefined): string | null {
  const parsed = parseBriefNotes(briefNotes);
  const lines: string[] = [];
  if (parsed.duties.trim()) lines.push(parsed.duties.trim());
  if (parsed.accessNotes.trim()) lines.push(`Access / entry: ${parsed.accessNotes.trim()}`);
  if (parsed.contactNotes.trim()) lines.push(`Contact on site: ${parsed.contactNotes.trim()}`);
  return lines.length > 0 ? lines.join("\n\n") : null;
}

export function briefPreview(briefNotes: string | null | undefined, maxLen = 120): string | null {
  const body = briefBodyForGuard(briefNotes);
  const attire = extractAttireRequirement(briefNotes);
  const combined = [body, attire ? `Attire: ${attire}` : null].filter(Boolean).join(" · ");
  if (!combined) return null;
  if (combined.length <= maxLen) return combined;
  return `${combined.slice(0, maxLen - 1).trim()}…`;
}

export function hasBriefContent(briefNotes: string | null | undefined): boolean {
  return Boolean(briefPreview(briefNotes, 9999));
}
