import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TagKind } from "@/lib/tags";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";
import { ENTRY_COLUMNS, toEntry, type EntryRow } from "./diary";
import type { Entry, ThreadKind } from "./types";

export type SearchResults = {
  entries: Entry[];
  entities: { kind: TagKind; slug: string; name: string; description: string | null }[];
  notes: { id: string; kind: TagKind; slug: string; name: string; body: string; ownerName: string; isPublic: boolean }[];
  threads: { id: string; kind: ThreadKind; text: string; openedSession: number; resolvedSession: number | null }[];
  quotes: { id: string; speaker: string; text: string; sessionNumber: number | null }[];
};

const LIMIT = 30;
/** Chi contiene la frase esatta (o un pezzo di nome, "Vel") va sempre prima dei risultati per parole. */
const EXACT = 1000;

type Source = "entry" | "note" | "card" | "thread" | "quote";
type Ranked = { source: Source; key: string; rank: number };

const NOTE_COLUMNS = "id, kind, slug, name, body, is_public, owner:profiles!owner_id(display_name)";
const CARD_COLUMNS = "kind, slug, name, description";
const THREAD_COLUMNS = "id, kind, text, opened_session, resolved_session";
const QUOTE_COLUMNS = "id, speaker, text, session_number";

type NoteRow = { id: string; kind: string; slug: string; name: string; body: string; is_public: boolean; owner: unknown };
type CardRow = { kind: string; slug: string; name: string; description: string | null };
type ThreadRow = { id: string; kind: string; text: string; opened_session: number; resolved_session: number | null };
type QuoteRow = { id: string; speaker: string; text: string; session_number: number | null };
const rows = <T>(data: unknown) => (data ?? []) as T[];

/**
 * Cerca in diario, compendio, note, fili e frasi. Due ricerche insieme:
 *  - la frase esatta, anche dentro una parola (come prima: "Vel" trova Velia);
 *  - le singole parole in italiano, con le varianti (rubato/rubare) e per pertinenza (migrazione 0020).
 * Le regole di visibilità le applica il database a entrambe.
 */
export async function search(campaignId: string, query: string): Promise<SearchResults> {
  await getCurrentUser();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return { entries: [], entities: [], notes: [], threads: [], quotes: [] };

  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const supabase = await createClient();
  const [ranked, entries, entities, cardsByName, cardsByText, notes, threads, quotesByText, quotesBySpeaker] = await Promise.all([
    supabase.rpc("search_ranked", { p_campaign: campaignId, p_query: q }),
    supabase.from("entries").select(ENTRY_COLUMNS).eq("campaign_id", campaignId).ilike("body", pattern).limit(LIMIT),
    supabase.from("entities").select("kind, slug, name").eq("campaign_id", campaignId).ilike("name", pattern).limit(LIMIT),
    supabase.from("entity_cards").select(CARD_COLUMNS).eq("campaign_id", campaignId).ilike("name", pattern).limit(LIMIT),
    supabase.from("entity_cards").select(CARD_COLUMNS).eq("campaign_id", campaignId).ilike("description", pattern).limit(LIMIT),
    supabase.from("entity_notes").select(NOTE_COLUMNS).eq("campaign_id", campaignId).ilike("body", pattern).limit(LIMIT),
    supabase.from("threads").select(THREAD_COLUMNS).eq("campaign_id", campaignId).ilike("text", pattern).limit(LIMIT),
    supabase.from("quotes").select(QUOTE_COLUMNS).eq("campaign_id", campaignId).ilike("text", pattern).limit(LIMIT),
    supabase.from("quotes").select(QUOTE_COLUMNS).eq("campaign_id", campaignId).ilike("speaker", pattern).limit(LIMIT),
  ]);
  for (const r of [ranked, entries, entities, cardsByName, cardsByText, notes, threads, quotesByText, quotesBySpeaker]) {
    if (r.error) throw dbError(r.error);
  }

  // Punteggio di ogni risultato: frase esatta prima, poi pertinenza delle parole.
  const score = new Map<string, number>();
  const bump = (source: Source, key: string, value: number) => {
    const k = `${source}|${key}`;
    score.set(k, Math.max(score.get(k) ?? 0, value));
  };
  const scoreOf = (source: Source, key: string) => score.get(`${source}|${key}`) ?? 0;
  const byWords = (ranked.data ?? []) as Ranked[];
  for (const r of byWords) bump(r.source, r.key, r.rank);

  const entryRows = new Map(rows<EntryRow>(entries.data).map((r) => [r.id, r]));
  const noteRows = new Map(rows<NoteRow>(notes.data).map((r) => [r.id, r]));
  const cardRows = new Map([...rows<CardRow>(cardsByName.data), ...rows<CardRow>(cardsByText.data)].map((c) => [`${c.kind}:${c.slug}`, c]));
  const threadRows = new Map(rows<ThreadRow>(threads.data).map((r) => [r.id, r]));
  const quoteRows = new Map([...rows<QuoteRow>(quotesByText.data), ...rows<QuoteRow>(quotesBySpeaker.data)].map((r) => [r.id, r]));
  for (const id of entryRows.keys()) bump("entry", id, EXACT);
  for (const id of noteRows.keys()) bump("note", id, EXACT);
  for (const key of cardRows.keys()) bump("card", key, EXACT);
  for (const id of threadRows.keys()) bump("thread", id, EXACT);
  for (const id of quoteRows.keys()) bump("quote", id, EXACT);

  // Quello che ha trovato solo la ricerca per parole va letto: stesse colonne, stesse regole.
  const missing = (source: Source, have: Map<string, unknown>) =>
    byWords.filter((r) => r.source === source && !have.has(r.key)).map((r) => r.key);
  const missingCards = missing("card", cardRows).map((key) => key.split(":") as [string, string]);
  const [moreEntries, moreNotes, moreCards, moreThreads, moreQuotes] = await Promise.all([
    fetchIds("entries", ENTRY_COLUMNS, missing("entry", entryRows)),
    fetchIds("entity_notes", NOTE_COLUMNS, missing("note", noteRows)),
    // Per slug e poi per tipo qui sotto: niente filtri composti a mano con testo che arriva dal database.
    missingCards.length
      ? supabase
          .from("entity_cards")
          .select(CARD_COLUMNS)
          .eq("campaign_id", campaignId)
          .in("slug", [...new Set(missingCards.map(([, slug]) => slug))])
      : Promise.resolve({ data: [], error: null }),
    fetchIds("threads", THREAD_COLUMNS, missing("thread", threadRows)),
    fetchIds("quotes", QUOTE_COLUMNS, missing("quote", quoteRows)),
  ]);
  for (const r of [moreEntries, moreNotes, moreCards, moreThreads, moreQuotes]) if (r.error) throw dbError(r.error);
  for (const r of rows<EntryRow>(moreEntries.data)) entryRows.set(r.id, r);
  for (const r of rows<NoteRow>(moreNotes.data)) noteRows.set(r.id, r);
  const wantedCards = new Set(missing("card", cardRows));
  for (const c of rows<CardRow>(moreCards.data)) if (wantedCards.has(`${c.kind}:${c.slug}`)) cardRows.set(`${c.kind}:${c.slug}`, c);
  for (const r of rows<ThreadRow>(moreThreads.data)) threadRows.set(r.id, r);
  for (const r of rows<QuoteRow>(moreQuotes.data)) quoteRows.set(r.id, r);

  const best = <T>(rows: Iterable<[string, T]>, source: Source, tie: (a: T, b: T) => number = () => 0) =>
    [...rows]
      .sort(([ka, a], [kb, b]) => scoreOf(source, kb) - scoreOf(source, ka) || tie(a, b))
      .slice(0, LIMIT)
      .map(([, row]) => row);

  // Personaggi e luoghi: uno solo per nome, con la descrizione del Master se c'è.
  const found = new Map<string, SearchResults["entities"][number]>();
  for (const c of best(cardRows, "card")) {
    found.set(`${c.kind}:${c.slug}`, { kind: c.kind as TagKind, slug: c.slug, name: c.name, description: c.description || null });
  }
  for (const e of rows<CardRow>(entities.data)) {
    const k = `${e.kind}:${e.slug}`;
    if (!found.has(k)) found.set(k, { kind: e.kind as TagKind, slug: e.slug, name: e.name, description: null });
  }

  return {
    entries: best(entryRows, "entry", (a, b) => b.session_number - a.session_number).map(toEntry),
    entities: [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "it")),
    notes: best(noteRows, "note").map((n) => ({
      id: n.id,
      kind: n.kind as TagKind,
      slug: n.slug,
      name: n.name,
      body: n.body,
      isPublic: n.is_public,
      ownerName: (n.owner as unknown as { display_name: string } | null)?.display_name ?? "—",
    })),
    threads: best(threadRows, "thread").map((t) => ({
      id: t.id,
      kind: (t.kind === "goal" ? "goal" : "question") as ThreadKind,
      text: t.text,
      openedSession: t.opened_session,
      resolvedSession: t.resolved_session,
    })),
    quotes: best(quoteRows, "quote").map((x) => ({ id: x.id, speaker: x.speaker, text: x.text, sessionNumber: x.session_number })),
  };

  function fetchIds(table: "entries" | "entity_notes" | "threads" | "quotes", columns: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve({ data: [] as unknown[], error: null });
    return supabase.from(table).select(columns).eq("campaign_id", campaignId).in("id", ids);
  }
}
