"use server";

import { createEntry, deleteEntry, updateEntry } from "@/lib/data/diary";
import { addThread, deleteThread, setThreadResolved } from "@/lib/data/threads";
import { dateOf, errorMessage, int, mutate, revalidateCampaign, str, type FormState } from "@/lib/form";

export async function createEntryAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const body = str(fd, "body");
  const session = int(fd, "session", 1);
  const at = Date.now();
  const isPublic = fd.get("public") === "on";
  const date = dateOf(fd);
  const keep = { body, session: String(session), public: isPublic ? "on" : "", date: date ?? "" };
  if (!body) return { error: "Scrivi qualcosa prima di salvare.", values: keep, at };
  if (session < 1) return { error: "Il numero di sessione deve essere almeno 1.", values: keep, at };
  try {
    await createEntry(campaignId, session, body, isPublic, date);
  } catch (e) {
    return { error: errorMessage(e), values: keep, at };
  }
  revalidateCampaign(campaignId);
  return { ok: true, values: { body: "", session: String(session), public: keep.public, date: keep.date }, at };
}

export async function updateEntryAction(campaignId: string, entryId: string, _: FormState, fd: FormData): Promise<FormState> {
  const body = str(fd, "body");
  const session = int(fd, "session", 1);
  if (!body) return { error: "La voce non può essere vuota: se vuoi toglierla, eliminala." };
  if (session < 1) return { error: "Il numero di sessione deve essere almeno 1." };
  try {
    await updateEntry(entryId, session, body, fd.get("public") === "on", dateOf(fd));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateCampaign(campaignId);
  return { ok: true, at: Date.now() };
}

export async function deleteEntryAction(campaignId: string, entryId: string): Promise<FormState> {
  return mutate(campaignId, () => deleteEntry(entryId));
}

export async function toggleThreadAction(campaignId: string, threadId: string, resolveInSession: number | null): Promise<FormState> {
  return mutate(campaignId, () => setThreadResolved(threadId, resolveInSession));
}

export async function addThreadAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const text = str(fd, "text").slice(0, 300);
  const kind = str(fd, "kind") === "goal" ? "goal" : "question";
  const at = Date.now();
  if (!text) return { error: kind === "goal" ? "Scrivi l'obiettivo." : "Scrivi la domanda.", at };
  try {
    await addThread(campaignId, kind, text, Math.max(1, int(fd, "session", 1)));
  } catch (e) {
    return { error: errorMessage(e), values: { text }, at };
  }
  revalidateCampaign(campaignId);
  return { ok: true, at };
}

export async function deleteThreadAction(campaignId: string, threadId: string): Promise<FormState> {
  return mutate(campaignId, () => deleteThread(threadId));
}
