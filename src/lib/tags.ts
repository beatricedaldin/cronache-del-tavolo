/**
 * Sintassi del diario:
 *   @Velia            personaggio (PNG o PG)
 *   @[Mastro Odo]     personaggio con nome di più parole
 *   #Portocielo       luogo o fazione
 *   #[Culto del Sole] luogo o fazione con nome di più parole
 *   ? testo           una riga che inizia con "?" diventa un filo in sospeso
 *   ! testo           una riga che inizia con "!" diventa un obiettivo
 *
 * I nomi in CamelCase vengono separati: #CultoDelSole -> "Culto Del Sole".
 */

export type TagKind = "npc" | "place";

export type Tag = { kind: TagKind; slug: string; name: string };

export type Segment = { type: "text"; text: string } | ({ type: "tag" } & Tag);

const TAG_RE = /(?<![\p{L}\p{N}_])([@#])(?:\[([^\]\n]{1,60})\]|(\p{L}[\p{L}\p{N}_']*))/gu;

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettify(raw: string): string {
  return raw.replace(/_/g, " ").replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2").trim();
}

/** Spezza una riga di testo in pezzi normali e tag. */
export function tokenize(line: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of line.matchAll(TAG_RE)) {
    const name = m[2] ? m[2].trim() : prettify(m[3]);
    const slug = slugify(name);
    if (!slug) continue;
    if (m.index > last) out.push({ type: "text", text: line.slice(last, m.index) });
    out.push({ type: "tag", kind: m[1] === "@" ? "npc" : "place", slug, name });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ type: "text", text: line.slice(last) });
  return out;
}

/** Tutti i tag distinti di un testo. */
export function extractTags(body: string): Tag[] {
  const seen = new Map<string, Tag>();
  for (const line of body.split("\n")) {
    for (const s of tokenize(line)) {
      if (s.type === "tag" && !seen.has(`${s.kind}:${s.slug}`)) {
        seen.set(`${s.kind}:${s.slug}`, { kind: s.kind, slug: s.slug, name: s.name });
      }
    }
  }
  return [...seen.values()];
}

function prefixedText(line: string, prefix: string): string | null {
  const t = line.trim();
  if (!t.startsWith(prefix)) return null;
  const text = t.slice(prefix.length).trim();
  return text.length > 0 ? text.slice(0, 300) : null;
}

export const threadText = (line: string) => prefixedText(line, "?");
export const goalText = (line: string) => prefixedText(line, "!");

const distinct = (xs: (string | null)[]) => [...new Set(xs.filter((t): t is string => t !== null))];

/** Le righe che iniziano con "?" (senza il "?"). */
export const extractThreads = (body: string) => distinct(body.split("\n").map(threadText));

/** Le righe che iniziano con "!" (senza il "!"). */
export const extractGoals = (body: string) => distinct(body.split("\n").map(goalText));

/** Come scrivere il tag di un'entità esistente nel composer. */
export function tagSyntax(kind: TagKind, name: string): string {
  const sym = kind === "npc" ? "@" : "#";
  return /^[\p{L}\p{N}_']+$/u.test(name) ? `${sym}${name}` : `${sym}[${name}]`;
}
