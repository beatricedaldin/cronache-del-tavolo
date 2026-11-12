import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";
import type { Thread, ThreadKind } from "./types";

/** Fili in sospeso e obiettivi visibili all'utente: i propri, oppure tutti se è il Master. */
export async function listThreads(campaignId: string): Promise<Thread[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("threads")
    .select("id, kind, text, opened_session, resolved_session, owner_id, owner:profiles(display_name)")
    .eq("campaign_id", campaignId)
    .order("opened_session", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw dbError(error);

  return (data ?? []).map((t) => ({
    id: t.id,
    kind: (t.kind === "goal" ? "goal" : "question") as ThreadKind,
    text: t.text,
    openedSession: t.opened_session,
    resolvedSession: t.resolved_session,
    ownerId: t.owner_id,
    ownerName: (t.owner as unknown as { display_name: string } | null)?.display_name ?? "—",
  }));
}

/** Segna un filo o un obiettivo come chiuso in una sessione, oppure lo riapre (session = null). */
export async function setThreadResolved(threadId: string, session: number | null) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("threads")
    .update({ resolved_session: session })
    .eq("id", threadId)
    .eq("owner_id", user.id);
  if (error) throw dbError(error);
}

/** Aggiunge un filo o un obiettivo a mano, senza scriverlo nel diario. */
export async function addThread(campaignId: string, kind: ThreadKind, text: string, session: number) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("threads")
    .insert({ campaign_id: campaignId, owner_id: user.id, kind, text, opened_session: session });
  if (error) throw dbError(error);
}

export async function deleteThread(threadId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("threads").delete().eq("id", threadId).eq("owner_id", user.id);
  if (error) throw dbError(error);
}
