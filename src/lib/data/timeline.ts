import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TagKind } from "@/lib/tags";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";
import { ENTRY_COLUMNS, toEntry, type EntryRow } from "./diary";
import { listThreads } from "./threads";
import type { Entry, Thread } from "./types";

export type TimelineEntity = { kind: TagKind; slug: string; name: string };

export type TimelineSession = {
  number: number;
  entries: Entry[];
  /** Personaggi e luoghi che compaiono per la prima volta in questa sessione. */
  firstAppearances: TimelineEntity[];
  /** Tutti quelli citati in questa sessione. */
  mentioned: TimelineEntity[];
  opened: Thread[];
  closed: Thread[];
};

type Row = EntryRow & { entry_mentions: { entity: TimelineEntity | null }[] };

/** La campagna sessione per sessione, con quello che l'utente può vedere. */
export async function getTimeline(campaignId: string): Promise<TimelineSession[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const [{ data, error }, threads] = await Promise.all([
    supabase
      .from("entries")
      .select(`${ENTRY_COLUMNS}, entry_mentions(entity:entities(kind, slug, name))`)
      .eq("campaign_id", campaignId)
      .order("session_number")
      .order("entry_date")
      .order("created_at"),
    listThreads(campaignId),
  ]);
  if (error) throw dbError(error);

  const sessions = new Map<number, TimelineSession>();
  const session = (n: number) => {
    let s = sessions.get(n);
    if (!s) {
      s = { number: n, entries: [], firstAppearances: [], mentioned: [], opened: [], closed: [] };
      sessions.set(n, s);
    }
    return s;
  };

  const seen = new Set<string>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const s = session(row.session_number);
    s.entries.push(toEntry(row));
    for (const { entity } of row.entry_mentions) {
      if (!entity) continue;
      const k = `${entity.kind}:${entity.slug}`;
      if (!s.mentioned.some((e) => `${e.kind}:${e.slug}` === k)) s.mentioned.push(entity);
      if (!seen.has(k)) {
        seen.add(k);
        s.firstAppearances.push(entity);
      }
    }
  }
  for (const t of threads) {
    session(t.openedSession).opened.push(t);
    if (t.resolvedSession !== null) session(t.resolvedSession).closed.push(t);
  }

  return [...sessions.values()].sort((a, b) => b.number - a.number);
}
