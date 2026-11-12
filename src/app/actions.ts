"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signInWithMagicLink, signOut } from "@/lib/data/auth";
import { createCampaign, joinCampaign } from "@/lib/data/campaigns";
import { createEntry, deleteEntry } from "@/lib/data/diary";
import { setThreadResolved } from "@/lib/data/threads";
import { addBond, deleteBond, saveMyCharacter } from "@/lib/data/characters";

export type FormState = {
  error?: string;
  ok?: boolean;
  message?: string;
  /** Valori da rimettere nel form (React lo svuota dopo ogni invio). */
  values?: Record<string, string>;
  /** Cambia a ogni invio: serve a rimontare i campi con i nuovi valori. */
  at?: number;
};

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const int = (fd: FormData, key: string, fallback: number) => {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
};
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Qualcosa è andato storto. Riprova.");

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// --- Accesso -----------------------------------------------------------------

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  const name = str(fd, "name");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Inserisci un indirizzo email valido." };
  try {
    await signInWithMagicLink(email, `${await siteOrigin()}/auth/callback`, name || undefined);
    return { ok: true, message: `Ti abbiamo mandato un link d'accesso a ${email}. Aprilo da questo dispositivo.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

// --- Campagne ----------------------------------------------------------------

export async function createCampaignAction(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: "Dai un nome alla campagna." };
  let id: string;
  try {
    id = await createCampaign(name);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/c/${id}`);
}

export async function joinCampaignAction(_: FormState, fd: FormData): Promise<FormState> {
  const code = str(fd, "code");
  if (!code) return { error: "Inserisci il codice che ti ha dato il Master." };
  let id: string;
  try {
    id = await joinCampaign(code);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/c/${id}/scheda`);
}

// --- Diario ------------------------------------------------------------------

export async function createEntryAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const body = str(fd, "body");
  const session = int(fd, "session", 1);
  const at = Date.now();
  const keep = { body, session: String(session) };
  if (!body) return { error: "Scrivi qualcosa prima di salvare.", values: keep, at };
  if (session < 1) return { error: "Il numero di sessione deve essere almeno 1.", values: keep, at };
  try {
    await createEntry(campaignId, session, body);
  } catch (e) {
    return { error: errorMessage(e), values: keep, at };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, values: { body: "", session: String(session) }, at };
}

export async function deleteEntryAction(campaignId: string, entryId: string) {
  await deleteEntry(entryId);
  revalidatePath(`/c/${campaignId}`, "layout");
}

export async function toggleThreadAction(campaignId: string, threadId: string, resolveInSession: number | null) {
  await setThreadResolved(threadId, resolveInSession);
  revalidatePath(`/c/${campaignId}`, "layout");
}

// --- Scheda PG ---------------------------------------------------------------

export async function saveCharacterAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: "Il personaggio ha bisogno di un nome." };
  try {
    await saveMyCharacter(campaignId, {
      name,
      classes: str(fd, "classes"),
      level: Math.min(60, Math.max(1, int(fd, "level", 5))),
      identity: str(fd, "identity"),
      theme: str(fd, "theme"),
      origin: str(fd, "origin"),
      fabulaPoints: Math.max(0, int(fd, "fabulaPoints", 3)),
      notes: str(fd, "notes"),
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, message: "Scheda salvata." };
}

export async function addBondAction(campaignId: string, characterId: string, fd: FormData) {
  const target = str(fd, "target");
  const emotions = fd.getAll("emotions").map(String).filter(Boolean);
  if (!target || emotions.length === 0) return;
  await addBond(characterId, target, emotions);
  revalidatePath(`/c/${campaignId}`, "layout");
}

export async function deleteBondAction(campaignId: string, bondId: string) {
  await deleteBond(bondId);
  revalidatePath(`/c/${campaignId}`, "layout");
}
