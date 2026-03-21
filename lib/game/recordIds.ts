export function cleanRecordIdToken(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^\[?\s*기록\s*/i, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .trim();

  if (!cleaned) return null;

  if (/^\d+$/.test(cleaned)) {
    return String(Number.parseInt(cleaned, 10));
  }

  const evidenceMatch = cleaned.match(/^e_(\d+)$/i);
  if (evidenceMatch) {
    return `e_${String(Number.parseInt(evidenceMatch[1], 10))}`;
  }

  if (/^[A-Za-z0-9_]+$/.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  return null;
}

export function expandRecordIdAliases(raw: string): string[] {
  const cleaned = cleanRecordIdToken(raw);
  if (!cleaned) return [];

  if (/^\d+$/.test(cleaned)) {
    return [...new Set([cleaned, cleaned.padStart(3, "0")])];
  }

  const evidenceMatch = cleaned.match(/^e_(\d+)$/);
  if (evidenceMatch) {
    const numeric = evidenceMatch[1];
    return [...new Set([`e_${numeric}`, `e_${numeric.padStart(2, "0")}`])];
  }

  return [cleaned];
}

export function resolveRecordIdsAgainstRecords<T extends { id: string }>(
  requestedIds: string[],
  records: T[]
): string[] {
  if (requestedIds.length === 0 || records.length === 0) return [];

  const resolved: string[] = [];
  for (const record of records) {
    const recordAliases = new Set(expandRecordIdAliases(record.id));
    if (requestedIds.some((requestedId) => expandRecordIdAliases(requestedId).some((alias) => recordAliases.has(alias)))) {
      resolved.push(record.id);
    }
  }

  return [...new Set(resolved)];
}
