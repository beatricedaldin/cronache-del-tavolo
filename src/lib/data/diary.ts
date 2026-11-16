import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "./errors";
import { extractGoals, extractTags, extractThreads } from "@/lib/tags";
import { getCurrentUser } from "./auth";
import type { Entry } from "./types";

export type EntryRow = {
  id: string;
  session_number: number;
  body: string;
  created_at: string;
  author_id: string;
  is_public: boolean;
  updated_at: string | null;
  entry_date: string;
  author: { display_name: string } | null;
};

export const ENTRY_COLUMNS =
  "id, session_number, body, created_at, author_id, is_public, updated_at, entry_date, author:profiles!author_id(display_name)";

export function toEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    sessionNumber: r.session_number,
    body: r.body,
    createdAt: r.created_at,
    authorId: r.author_id,
    authorName: r.author?.display_name ?? "—",
    isPublic: r.is_public,
    updatedAt: r.updated_at,
    date: r.entry_date,
  };
}

/**
 * Le voci di diario che l'utente può leggere: le proprie, quelle pubbliche degli altri, oppure tutte se è il Master.
 * Dalla più recente. Con `limit` si leggono solo le prime N (utile quando basta il contesto recente).
 */
export async function listEntries(campaignId: string, opts: { limit?: number } = {}): Promise<Entry[]> {
  await getCurrentUser();
  const supabase = await createClient();
  let query = supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("campaign_id", campaignId)
    .order("session_number", { ascending: false })
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw dbError(error);
  return ((data ?? []) as unknown as EntryRow[]).map(toEntry);
}

/** Una pagina del diario: le `limit` voci più recenti e se ce ne sono altre più vecchie. */
export async function listEntriesPage(campaignId: string, limit: number): Promise<{ entries: Entry[]; hasMore: boolean }> {
  const entries = await listEntries(campaignId, { limit: limit + 1 });
  return { entries: entries.slice(0, limit), hasMore: entries.length > limit };
}

export async function latestSessionNumber(campaignId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("session_number")
    .eq("campaign_id", campaignId)
    .order("session_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.session_number ?? 1;
}

const links = (body: string) => ({
  p_tags: extractTags(body),
  p_threads: extractThreads(body),
  p_goals: extractGoals(body),
});

/** Salva una voce: crea le entità citate, i fili e gli obiettivi nella stessa transazione. */
export async function createEntry(campaignId: string, sessionNumber: number, body: string, isPublic: boolean, date: string | null) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_entry", {
    p_campaign: campaignId,
    p_session: sessionNumber,
    p_body: body,
    p_public: isPublic,
    p_date: date,
    ...links(body),
  });
  if (error) throw dbError(error);
}

/** Modifica una propria voce. Citazioni, fili e obiettivi vengono riallineati al nuovo testo. */
export async function updateEntry(entryId: string, sessionNumber: number, body: string, isPublic: boolean, date: string | null) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_entry", {
    p_entry: entryId,
    p_session: sessionNumber,
    p_body: body,
    p_public: isPublic,
    p_date: date,
    ...links(body),
  });
  if (error) throw dbError(error);
}

export async function deleteEntry(entryId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", entryId).eq("author_id", user.id);
  if (error) throw dbError(error);
}
