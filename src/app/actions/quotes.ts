"use server";

import { addQuote, deleteQuote, updateQuote, type QuoteInput } from "@/lib/data/quotes";
import { dateOf, errorMessage, int, mutate, revalidateCampaign, str, type FormState } from "@/lib/form";

function quoteFrom(fd: FormData): QuoteInput | string {
  const speaker = str(fd, "speaker").slice(0, 80);
  const text = str(fd, "text").slice(0, 1000);
  if (!text) return "Scrivi la frase.";
  if (!speaker) return "Chi l'ha detta?";
  const session = int(fd, "session", 0);
  return { speaker, text, context: str(fd, "context").slice(0, 300), sessionNumber: session > 0 ? session : null, date: dateOf(fd) };
}

export async function addQuoteAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const input = quoteFrom(fd);
  const at = Date.now();
  const keep = { speaker: str(fd, "speaker"), text: str(fd, "text"), context: str(fd, "context"), session: str(fd, "session"), date: str(fd, "date") };
  if (typeof input === "string") return { error: input, values: keep, at };
  try {
    await addQuote(campaignId, input);
  } catch (e) {
    return { error: errorMessage(e), values: keep, at };
  }
  revalidateCampaign(campaignId);
  return { ok: true, values: { session: keep.session, date: keep.date }, at };
}

export async function updateQuoteAction(campaignId: string, quoteId: string, _: FormState, fd: FormData): Promise<FormState> {
  const input = quoteFrom(fd);
  if (typeof input === "string") return { error: input };
  try {
    await updateQuote(quoteId, input);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateCampaign(campaignId);
  return { ok: true, at: Date.now() };
}

export async function deleteQuoteAction(campaignId: string, quoteId: string): Promise<FormState> {
  return mutate(campaignId, () => deleteQuote(quoteId));
}
