import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";

export type Quote = {
  id: string;
  speaker: string;
  text: string;
  context: string;
  sessionNumber: number | null;
  date: string;
  authorId: string;
  authorName: string;
};

type Row = {
  id: string;
  speaker: string;
  text: string;
  context: string;
  session_number: number | null;
  quote_date: string;
  author_id: string;
  author: { display_name: string } | null;
};

const COLUMNS = "id, speaker, text, context, session_number, quote_date, author_id, author:profiles(display_name)";

const toQuote = (r: Row): Quote => ({
  id: r.id,
  speaker: r.speaker,
  text: r.text,
  context: r.context,
  sessionNumber: r.session_number,
  date: r.quote_date,
  authorId: r.author_id,
  authorName: r.author?.display_name ?? "—",
});

/** Le frasi memorabili della campagna: le vedono tutti i membri. */
export async function listQuotes(campaignId: string, limit?: number): Promise<Quote[]> {
  await getCurrentUser();
  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select(COLUMNS)
    .eq("campaign_id", campaignId)
    .order("session_number", { ascending: false, nullsFirst: false })
    .order("quote_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw dbError(error);
  return ((data ?? []) as unknown as Row[]).map(toQuote);
}

export type QuoteInput = { speaker: string; text: string; context: string; sessionNumber: number | null; date: string | null };

export async function addQuote(campaignId: string, input: QuoteInput) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").insert({
    campaign_id: campaignId,
    author_id: user.id,
    speaker: input.speaker,
    text: input.text,
    context: input.context,
    session_number: input.sessionNumber,
    ...(input.date ? { quote_date: input.date } : {}),
  });
  if (error) throw dbError(error);
}

export async function updateQuote(quoteId: string, input: QuoteInput) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      speaker: input.speaker,
      text: input.text,
      context: input.context,
      session_number: input.sessionNumber,
      ...(input.date ? { quote_date: input.date } : {}),
    })
    .eq("id", quoteId)
    .eq("author_id", user.id);
  if (error) throw dbError(error);
}

/** Chi l'ha trascritta può toglierla; anche il Master (lo decide il database). */
export async function deleteQuote(quoteId: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw dbError(error);
}
