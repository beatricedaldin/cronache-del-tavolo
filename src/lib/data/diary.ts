import "server-only";
import { createClient } from "@/lib/supabase/server";
import { extractTags, extractThreads } from "@/lib/tags";
import { getCurrentUser } from "./auth";
import type { Entry } from "./types";

export type EntryRow = {
  id: string;
  session_number: number;
  body: string;
  created_at: string;
  author_id: string;
  author: { display_name: string } | null;
};

export const ENTRY_COLUMNS = "id, session_number, body, created_at, author_id, author:profiles(display_name)";

export function toEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    sessionNumber: r.session_number,
    body: r.body,
    createdAt: r.created_at,
    authorId: r.author_id,
    authorName: r.author?.display_name ?? "—",
  };
}

/** Le voci di diario che l'utente può leggere: le proprie, oppure tutte se è il Master. */
export async function listEntries(campaignId: string): Promise<Entry[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("campaign_id", campaignId)
    .order("session_number", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as EntryRow[]).map(toEntry);
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

/** Salva una voce: crea le entità citate e i fili in sospeso nella stessa transazione. */
export async function createEntry(campaignId: string, sessionNumber: number, body: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_entry", {
    p_campaign: campaignId,
    p_session: sessionNumber,
    p_body: body,
    p_tags: extractTags(body),
    p_threads: extractThreads(body),
  });
  if (error) throw new Error(error.message);
}

export async function deleteEntry(entryId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", entryId).eq("author_id", user.id);
  if (error) throw new Error(error.message);
}
