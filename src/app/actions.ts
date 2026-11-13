"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  changePassword,
  normalizeUsername,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  USERNAME_PATTERN,
} from "@/lib/data/auth";
import { createCampaign, joinCampaign } from "@/lib/data/campaigns";
import { createEntry, deleteEntry, updateEntry } from "@/lib/data/diary";
import { addThread, deleteThread, setThreadResolved } from "@/lib/data/threads";
import {
  addBond,
  acquireCharacterEquipment,
  deleteBond,
  createMyCharacter,
  removeMyPortrait,
  saveMyCharacter,
  setMyPortrait,
  updateBond,
} from "@/lib/data/characters";
import {
  addNote,
  addRelation,
  deleteNote,
  deleteRelation,
  listTagNames,
  removeEntityImage,
  saveCard,
  setEntityImage,
  updateNote,
} from "@/lib/data/compendium";
import { addQuote, deleteQuote, updateQuote, type QuoteInput } from "@/lib/data/quotes";
import type { TagKind } from "@/lib/tags";
import {
  EQUIPMENT_SLOTS,
  normalizeSheet,
  RULES,
  type EquipmentAcquisition,
  type EquipmentSlot,
} from "@/lib/fabula";
import { todayISO } from "@/lib/dates";

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
/** Una data AAAA-MM-GG valida, altrimenti null (il database usa oggi). */
const dateOf = (fd: FormData, key = "date") => {
  const v = str(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
};
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Qualcosa è andato storto. Riprova.");

// --- Accesso -----------------------------------------------------------------

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const mode = str(fd, "mode") === "signup" ? "signup" : "signin";
  const username = normalizeUsername(str(fd, "username"));
  const password = String(fd.get("password") ?? "");
  const name = str(fd, "name");
  const at = Date.now();
  const keep = { username, name, mode };

  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: "Il nome utente va da 3 a 30 caratteri: lettere minuscole, numeri, punto, trattino o trattino basso.",
      values: keep,
      at,
    };
  }
  if (password.length < 6) return { error: "La password deve avere almeno 6 caratteri.", values: keep, at };

  try {
    if (mode === "signup") await signUpWithPassword(username, password, name || undefined);
    else await signInWithPassword(username, password);
  } catch (e) {
    return { error: errorMessage(e), values: keep, at };
  }
  redirect("/");
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
  revalidatePath(`/c/${campaignId}`, "layout");
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
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, at: Date.now() };
}

export async function deleteEntryAction(campaignId: string, entryId: string) {
  await deleteEntry(entryId);
  revalidatePath(`/c/${campaignId}`, "layout");
}

export async function toggleThreadAction(campaignId: string, threadId: string, resolveInSession: number | null) {
  await setThreadResolved(threadId, resolveInSession);
  revalidatePath(`/c/${campaignId}`, "layout");
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
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, at };
}

export async function deleteThreadAction(campaignId: string, threadId: string) {
  await deleteThread(threadId);
  revalidatePath(`/c/${campaignId}`, "layout");
}

// --- Compendio ---------------------------------------------------------------

/** I nomi per i suggerimenti di @ e # mentre si scrive. */
export async function tagNamesAction(campaignId: string): Promise<{ kind: TagKind; name: string }[]> {
  try {
    return await listTagNames(campaignId);
  } catch {
    return [];
  }
}

const kindOf = (fd: FormData): TagKind => (str(fd, "kind") === "place" ? "place" : "npc");
const compendiumPath = (campaignId: string, kind: TagKind, slug: string) => `/c/${campaignId}/compendio/${kind}/${slug}`;

/** Il Master scrive o aggiorna la scheda pubblica (nome e descrizione). */
export async function saveCardAction(campaignId: string, kind: TagKind, slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name").slice(0, 80);
  if (!name) return { error: "Serve un nome." };
  try {
    await saveCard(campaignId, kind, name, str(fd, "description").slice(0, 5000), slug);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, message: "Salvato. Ora lo vedono tutti.", at: Date.now() };
}

/** Il Master aggiunge al compendio qualcosa che nessuno ha ancora citato. */
export async function createCardAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name").slice(0, 80);
  const kind = kindOf(fd);
  if (!name) return { error: "Serve un nome." };
  let slug: string;
  try {
    slug = await saveCard(campaignId, kind, name, "");
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  redirect(compendiumPath(campaignId, kind, slug));
}

export async function setEntityImageAction(campaignId: string, kind: TagKind, slug: string, name: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await setEntityImage(campaignId, kind, slug, name, fd.get("image"));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, at: Date.now() };
}

export async function removeEntityImageAction(campaignId: string, kind: TagKind, slug: string) {
  await removeEntityImage(campaignId, kind, slug);
  revalidatePath(`/c/${campaignId}`, "layout");
}

export async function addNoteAction(campaignId: string, kind: TagKind, slug: string, name: string, _: FormState, fd: FormData): Promise<FormState> {
  const body = str(fd, "body").slice(0, 5000);
  const isPublic = fd.get("public") === "on";
  const at = Date.now();
  if (!body) return { error: "Scrivi qualcosa nella nota.", at };
  try {
    await addNote(campaignId, kind, slug, name, body, isPublic, dateOf(fd));
  } catch (e) {
    return { error: errorMessage(e), values: { body, public: isPublic ? "on" : "", date: str(fd, "date") }, at };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, values: { public: isPublic ? "on" : "", date: str(fd, "date") }, at };
}

export async function updateNoteAction(campaignId: string, noteId: string, _: FormState, fd: FormData): Promise<FormState> {
  const body = str(fd, "body").slice(0, 5000);
  if (!body) return { error: "La nota non può essere vuota: se vuoi toglierla, eliminala." };
  try {
    await updateNote(noteId, body, fd.get("public") === "on", dateOf(fd));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, at: Date.now() };
}

export async function deleteNoteAction(campaignId: string, noteId: string) {
  await deleteNote(noteId);
  revalidatePath(`/c/${campaignId}`, "layout");
}

// --- Scheda PG ---------------------------------------------------------------

export async function saveCharacterAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: "Il personaggio ha bisogno di un nome." };
  const advancementSummary = str(fd, "advancementSummary");
  const sessionText = str(fd, "advancementSession");
  const sessionNumber = sessionText ? Number(sessionText) : null;
  if (advancementSummary.length > 1500) return { error: "La nota sui progressi non può superare 1500 caratteri." };
  if (sessionText && (!Number.isInteger(sessionNumber) || (sessionNumber ?? 0) < 1 || (sessionNumber ?? 0) > 999)) {
    return { error: "Il numero della sessione deve essere compreso tra 1 e 999." };
  }
  if (sessionText && !advancementSummary) {
    return { error: "Descrivi l'avanzamento da registrare per questa sessione." };
  }
  let sheet: unknown;
  try {
    sheet = JSON.parse(String(fd.get("sheet") ?? "{}"));
  } catch {
    return { error: "La scheda non è leggibile. Ricarica la pagina e riprova." };
  }
  try {
    await saveMyCharacter(campaignId, {
      name,
      identity: str(fd, "identity"),
      theme: str(fd, "theme"),
      origin: str(fd, "origin"),
      fabulaPoints: Math.max(0, int(fd, "fabulaPoints", 3)),
      notes: str(fd, "notes"),
      sheet: normalizeSheet(sheet),
    }, advancementSummary ? { sessionNumber, summary: advancementSummary } : undefined);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, message: "Scheda salvata.", at: Date.now() };
}

export async function createCharacterAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: "Il personaggio ha bisogno di un nome." };
  let sheet: unknown;
  try {
    sheet = JSON.parse(String(fd.get("sheet") ?? "{}"));
  } catch {
    return { error: "La scheda non è leggibile. Ricarica la pagina e riprova." };
  }
  const savingsRoll = Number(str(fd, "savingsRoll"));
  if (!Number.isInteger(savingsRoll) || savingsRoll < 2 || savingsRoll > 12) {
    return { error: "Inserisci il risultato del tiro 2d6 per i risparmi iniziali." };
  }
  try {
    await createMyCharacter(campaignId, {
      name,
      identity: str(fd, "identity"),
      theme: str(fd, "theme"),
      origin: str(fd, "origin"),
      fabulaPoints: RULES.startingFabulaPoints,
      notes: str(fd, "notes"),
      sheet: normalizeSheet(sheet),
    }, savingsRoll);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, message: "Personaggio creato. Ora puoi aggiungere i Legami.", at: Date.now() };
}

export async function acquireCharacterEquipmentAction(
  campaignId: string,
  characterId: string,
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const name = str(fd, "name");
  const slot = equipmentSlotFrom(str(fd, "slot"));
  const acquisition = equipmentAcquisitionFrom(str(fd, "acquisition"));
  const payment = str(fd, "paymentSource");
  const quantity = Number(str(fd, "quantity"));
  const cost = Number(str(fd, "cost"));
  const sessionText = str(fd, "session");
  const sessionNumber = sessionText ? Number(sessionText) : null;
  const dateText = str(fd, "date");
  const date = dateOf(fd, "date");
  const acquiredOn = date ?? todayISO();
  const paymentSource: "personal" | null = payment === "personal" ? "personal" : null;
  const numericField = (key: string) => {
    const value = str(fd, key);
    return value ? Number(value) : 0;
  };
  const defense = numericField("defense");
  const magicDefense = numericField("magicDefense");
  const initiative = numericField("initiative");
  const summary = str(fd, "summary");

  if (!name || name.length > 80) return { error: "Inserisci un nome valido per l'oggetto (massimo 80 caratteri)." };
  if (!slot) return { error: "Scegli un tipo di equipaggiamento valido." };
  if (!acquisition) return { error: "Scegli come è stato ottenuto l'oggetto." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: "La quantità deve essere compresa tra 1 e 999." };
  if (acquisition === "purchase") {
    if (!Number.isInteger(cost) || cost < 1 || cost > 9_999_999) return { error: "Inserisci un costo valido per l'acquisto." };
    if (!paymentSource) return { error: "L'acquisto può essere addebitato solo ai tuoi Zenit personali." };
  }
  if (dateText && !date) return { error: "La data dell'oggetto non è valida." };
  if (sessionText && (!Number.isInteger(sessionNumber) || (sessionNumber ?? 0) < 1 || (sessionNumber ?? 0) > 999)) {
    return { error: "Il numero della sessione deve essere compreso tra 1 e 999." };
  }
  if (summary.length > 2000) return { error: "Il promemoria non può superare 2000 caratteri." };
  if ([defense, magicDefense, initiative].some((value) => !Number.isInteger(value) || value < -10 || value > 20)) {
    return { error: "I bonus devono essere numeri interi tra -10 e 20." };
  }

  try {
    await acquireCharacterEquipment(characterId, {
      name,
      slot,
      quantity,
      cost: acquisition === "purchase" ? cost : 0,
      acquisition,
      paymentSource: acquisition === "purchase" ? paymentSource : null,
      sessionNumber,
      acquiredOn,
      defense,
      magicDefense,
      initiative,
      summary,
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, message: "Oggetto registrato nella scheda e nei saldi pertinenti.", at: Date.now() };
}

function equipmentSlotFrom(value: string): EquipmentSlot | null {
  return EQUIPMENT_SLOTS.find((entry) => entry.key === value)?.key ?? null;
}

function equipmentAcquisitionFrom(value: string): Exclude<EquipmentAcquisition, "starting" | "unknown"> | null {
  switch (value) {
    case "purchase":
    case "found":
    case "reward":
    case "gift":
      return value;
    default:
      return null;
  }
}

/** Le emozioni scelte: un campo radio per ciascuna coppia ("pair0", "pair1", "pair2"). */
const emotionsFrom = (fd: FormData) => [0, 1, 2].map((i) => str(fd, `pair${i}`)).filter(Boolean);

export async function addBondAction(campaignId: string, characterId: string, _: FormState, fd: FormData): Promise<FormState> {
  const target = str(fd, "target");
  const at = Date.now();
  if (!target) return { error: "Verso chi è il Legame?", at };
  try {
    await addBond(characterId, target, emotionsFrom(fd));
  } catch (e) {
    return { error: errorMessage(e), values: { target }, at };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, at };
}

export async function updateBondAction(campaignId: string, bondId: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await updateBond(bondId, emotionsFrom(fd));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, message: "Aggiornato." };
}

export async function deleteBondAction(campaignId: string, bondId: string) {
  await deleteBond(bondId);
  revalidatePath(`/c/${campaignId}`, "layout");
}

export async function setPortraitAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await setMyPortrait(campaignId, fd.get("image"));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, at: Date.now() };
}

export async function removePortraitAction(campaignId: string) {
  await removeMyPortrait(campaignId);
  revalidatePath(`/c/${campaignId}`, "layout");
}

// --- Account -----------------------------------------------------------------

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const at = Date.now();
  if (next.length < 6) return { error: "La nuova password deve avere almeno 6 caratteri.", at };
  if (next !== confirm) return { error: "Le due nuove password non coincidono.", at };
  try {
    await changePassword(current, next);
  } catch (e) {
    return { error: errorMessage(e), at };
  }
  return { ok: true, message: "Password cambiata.", at };
}

// --- Frasi memorabili --------------------------------------------------------

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
  revalidatePath(`/c/${campaignId}`, "layout");
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
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, at: Date.now() };
}

export async function deleteQuoteAction(campaignId: string, quoteId: string) {
  await deleteQuote(quoteId);
  revalidatePath(`/c/${campaignId}`, "layout");
}

// --- Relazioni del compendio -------------------------------------------------

export async function addRelationAction(
  campaignId: string,
  fromKind: TagKind,
  fromSlug: string,
  fromName: string,
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const label = str(fd, "label").slice(0, 60);
  const toName = str(fd, "toName").replace(/^[@#]\[?|\]$/g, "").trim().slice(0, 80);
  const toKind: TagKind = str(fd, "toKind") === "place" ? "place" : "npc";
  const isPublic = fd.get("public") === "on";
  const at = Date.now();
  const keep = { label, toName, toKind, public: isPublic ? "on" : "" };
  if (!label) return { error: "Che relazione è? Es. «sorella di».", values: keep, at };
  if (!toName) return { error: "Con chi o cosa?", values: keep, at };
  try {
    await addRelation(campaignId, { from: { kind: fromKind, slug: fromSlug, name: fromName }, label, to: { kind: toKind, name: toName }, isPublic });
  } catch (e) {
    return { error: errorMessage(e), values: keep, at };
  }
  revalidatePath(`/c/${campaignId}`, "layout");
  return { ok: true, values: { public: keep.public, toKind }, at };
}

export async function deleteRelationAction(campaignId: string, relationId: string) {
  await deleteRelation(relationId);
  revalidatePath(`/c/${campaignId}`, "layout");
}
