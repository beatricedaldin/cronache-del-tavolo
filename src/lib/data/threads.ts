import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";
import type { Thread } from "./types";

export async function listThreads(campaignId: string): Promise<Thread[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("threads")
    .select("id, text, opened_session, resolved_session, owner_id, owner:profiles(display_name)")
    .eq("campaign_id", campaignId)
    .order("opened_session", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((t) => ({
    id: t.id,
    text: t.text,
    openedSession: t.opened_session,
    resolvedSession: t.resolved_session,
    ownerId: t.owner_id,
    ownerName: (t.owner as unknown as { display_name: string } | null)?.display_name ?? "—",
  }));
}

/** Segna un filo come risolto in una sessione, oppure lo riapre (session = null). */
export async function setThreadResolved(threadId: string, session: number | null) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("threads")
    .update({ resolved_session: session })
    .eq("id", threadId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
}
