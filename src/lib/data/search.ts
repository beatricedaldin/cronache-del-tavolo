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

/** Cerca in diario, compendio, note, fili e obiettivi. Le regole di visibilità le applica il database. */
export async function search(campaignId: string, query: string): Promise<SearchResults> {
  await getCurrentUser();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return { entries: [], entities: [], notes: [], threads: [], quotes: [] };

  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const supabase = await createClient();
  const [entries, entities, cardsByName, cardsByText, notes, threads, quotesByText, quotesBySpeaker] = await Promise.all([
    supabase
      .from("entries")
      .select(ENTRY_COLUMNS)
      .eq("campaign_id", campaignId)
      .ilike("body", pattern)
      .order("session_number", { ascending: false })
      .limit(LIMIT),
    supabase.from("entities").select("kind, slug, name").eq("campaign_id", campaignId).ilike("name", pattern).limit(LIMIT),
    supabase.from("entity_cards").select("kind, slug, name, description").eq("campaign_id", campaignId).ilike("name", pattern).limit(LIMIT),
    supabase.from("entity_cards").select("kind, slug, name, description").eq("campaign_id", campaignId).ilike("description", pattern).limit(LIMIT),
    supabase
      .from("entity_notes")
      .select("id, kind, slug, name, body, is_public, owner:profiles(display_name)")
      .eq("campaign_id", campaignId)
      .ilike("body", pattern)
      .limit(LIMIT),
    supabase
      .from("threads")
      .select("id, kind, text, opened_session, resolved_session")
      .eq("campaign_id", campaignId)
      .ilike("text", pattern)
      .limit(LIMIT),
    supabase.from("quotes").select("id, speaker, text, session_number").eq("campaign_id", campaignId).ilike("text", pattern).limit(LIMIT),
    supabase.from("quotes").select("id, speaker, text, session_number").eq("campaign_id", campaignId).ilike("speaker", pattern).limit(LIMIT),
  ]);
  for (const r of [entries, entities, cardsByName, cardsByText, notes, threads, quotesByText, quotesBySpeaker]) if (r.error) throw dbError(r.error);
  const quotes = new Map<string, SearchResults["quotes"][number]>();
  for (const x of [...(quotesByText.data ?? []), ...(quotesBySpeaker.data ?? [])]) {
    quotes.set(x.id, { id: x.id, speaker: x.speaker, text: x.text, sessionNumber: x.session_number });
  }

  // Personaggi e luoghi: uno solo per nome, con la descrizione del Master se c'è.
  const found = new Map<string, SearchResults["entities"][number]>();
  for (const c of [...(cardsByName.data ?? []), ...(cardsByText.data ?? [])]) {
    found.set(`${c.kind}:${c.slug}`, { kind: c.kind as TagKind, slug: c.slug, name: c.name, description: c.description || null });
  }
  for (const e of entities.data ?? []) {
    const k = `${e.kind}:${e.slug}`;
    if (!found.has(k)) found.set(k, { kind: e.kind as TagKind, slug: e.slug, name: e.name, description: null });
  }

  return {
    entries: ((entries.data ?? []) as unknown as EntryRow[]).map(toEntry),
    entities: [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "it")),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind as TagKind,
      slug: n.slug,
      name: n.name,
      body: n.body,
      isPublic: n.is_public,
      ownerName: (n.owner as unknown as { display_name: string } | null)?.display_name ?? "—",
    })),
    threads: (threads.data ?? []).map((t) => ({
      id: t.id,
      kind: (t.kind === "goal" ? "goal" : "question") as ThreadKind,
      text: t.text,
      openedSession: t.opened_session,
      resolvedSession: t.resolved_session,
    })),
    quotes: [...quotes.values()],
  };
}
