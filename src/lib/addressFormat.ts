/** Append UK-style postcode to an address line if it's present and not already included. */
export function appendPostcodeIfMissing(
  address: string,
  postcode: string | null | undefined
): string {
  const pc = postcode?.trim();
  if (!pc) return address.trim();
  const base = address.trim();
  const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();
  const nAddr = norm(base);
  const nPc = norm(pc);
  if (!nPc) return base;
  if (nAddr.includes(nPc)) return base;
  return base ? `${base}, ${pc}` : pc;
}
