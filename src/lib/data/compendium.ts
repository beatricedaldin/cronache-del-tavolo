import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TagKind } from "@/lib/tags";
import { getCurrentUser } from "./auth";
import { ENTRY_COLUMNS, toEntry, type EntryRow } from "./diary";
import type { EntityDetail, EntitySummary } from "./types";

type EntityRow = {
  id: string;
  kind: TagKind;
  slug: string;
  name: string;
  owner_id: string;
  entry_mentions: { entry: { session_number: number } | null }[];
};

/**
 * Il compendio. Un giocatore vede solo le entità che ha citato lui;
 * il Master vede quelle di tutti, raggruppate per nome.
 */
export async function listEntities(campaignId: string): Promise<EntitySummary[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .select("id, kind, slug, name, owner_id, entry_mentions(entry:entries(session_number))")
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);

  const groups = new Map<string, EntitySummary & { owners: Set<string> }>();
  for (const e of (data ?? []) as unknown as EntityRow[]) {
    const key = `${e.kind}:${e.slug}`;
    const g = groups.get(key) ?? {
      kind: e.kind,
      slug: e.slug,
      name: e.name,
      mentions: 0,
      firstSession: null,
      lastSession: null,
      authors: 0,
      owners: new Set<string>(),
    };
    g.owners.add(e.owner_id);
    for (const m of e.entry_mentions) {
      if (!m.entry) continue;
      g.mentions += 1;
      const s = m.entry.session_number;
      g.firstSession = g.firstSession === null ? s : Math.min(g.firstSession, s);
      g.lastSession = g.lastSession === null ? s : Math.max(g.lastSession, s);
    }
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter((g) => g.mentions > 0)
    .map(({ owners, ...g }) => ({ ...g, authors: owners.size }))
    .sort((a, b) => (b.lastSession ?? 0) - (a.lastSession ?? 0) || b.mentions - a.mentions);
}

/** Tutto quello che l'utente può leggere su un'entità, in ordine di sessione. */
export async function getEntity(campaignId: string, kind: TagKind, slug: string): Promise<EntityDetail | null> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .select(`name, entry_mentions(entry:entries(${ENTRY_COLUMNS}))`)
    .eq("campaign_id", campaignId)
    .eq("kind", kind)
    .eq("slug", slug);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  const rows = data as unknown as { name: string; entry_mentions: { entry: EntryRow | null }[] }[];
  const byId = new Map<string, EntryRow>();
  for (const r of rows) for (const m of r.entry_mentions) if (m.entry) byId.set(m.entry.id, m.entry);

  const entries = [...byId.values()]
    .map(toEntry)
    .sort((a, b) => a.sessionNumber - b.sessionNumber || a.createdAt.localeCompare(b.createdAt));

  return { kind, slug, name: rows[0].name, entries };
}

/** Nomi già usati dall'utente, per i suggerimenti nel composer. */
export async function listEntityNames(campaignId: string): Promise<{ kind: TagKind; name: string }[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("entities")
    .select("kind, name")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as { kind: TagKind; name: string }[];
}
