/** Contact passed to AI expense parsing for name resolution */
export interface AiContact {
  key: string;
  displayName: string;
  aliases: string[];
  isSelf?: boolean;
  isCustom?: boolean;
}

const SELF_PATTERN = /^(me|ผม|ฉัน|ตัวเอง|myself|i|เอง)$/i;

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Extract name variants from strings like "เบล(ชื่อในเว็บคือ Bnyapn Ay)" */
function nameCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const out = new Set<string>([trimmed]);
  const paren = trimmed.match(/^(.+?)\s*\((?:ชื่อใน(?:เว็บ|ระบบ)คือ\s*)?([^)]+)\)\s*$/);
  if (paren) {
    out.add(paren[1].trim());
    out.add(paren[2].trim());
  }
  return [...out];
}

function contactCanonicalName(c: AiContact): string {
  return c.isSelf ? 'Me' : c.displayName;
}

function matchContact(candidate: string, contacts: AiContact[]): AiContact | null {
  const lower = normalizeForMatch(candidate);
  if (!lower) return null;
  if (SELF_PATTERN.test(lower)) {
    return contacts.find((c) => c.isSelf) ?? null;
  }

  for (const c of contacts) {
    if (normalizeForMatch(c.displayName) === lower) return c;
  }
  for (const c of contacts) {
    if (c.aliases.some((a) => normalizeForMatch(a) === lower)) return c;
  }
  for (const c of contacts) {
    const dn = normalizeForMatch(c.displayName);
    if (dn.includes(lower) || lower.includes(dn)) return c;
  }
  for (const c of contacts) {
    for (const alias of c.aliases) {
      const al = normalizeForMatch(alias);
      if (al.includes(lower) || lower.includes(al)) return c;
    }
  }
  return null;
}

/** Resolve a free-text person name to canonical displayName (or "Me") */
export function resolveContactName(rawName: string, contacts: AiContact[]): string {
  for (const candidate of nameCandidates(rawName)) {
    if (SELF_PATTERN.test(normalizeForMatch(candidate))) return 'Me';
    const hit = matchContact(candidate, contacts);
    if (hit) return contactCanonicalName(hit);
  }
  return rawName.trim();
}

export function buildContactsPromptHint(contacts: AiContact[]): string {
  if (!contacts.length) return '';
  const lines = contacts.map((c) => {
    const label = c.isSelf ? 'Me (self)' : c.displayName;
    const aliasPart =
      c.aliases.length > 0 ? ` — nicknames/aliases: ${c.aliases.join(', ')}` : '';
    return `- ${label}${aliasPart}`;
  });
  return (
    `\n\nKnown contacts (use exact displayName in payers/shares JSON when a person matches; use "Me" for self):\n` +
    lines.join('\n')
  );
}

interface SplitPerson {
  name: string;
  amount: number;
}

/** Post-process AI payers/shares names against the user's contact list */
export function resolveSplitPeople(
  people: SplitPerson[] | undefined,
  contacts: AiContact[]
): SplitPerson[] | undefined {
  if (!people?.length) return people;
  return people.map((p) => ({
    ...p,
    name: resolveContactName(p.name, contacts),
  }));
}
