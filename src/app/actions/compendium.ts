"use server";

import { redirect } from "next/navigation";
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
import type { TagKind } from "@/lib/tags";
import { dateOf, errorMessage, mutate, revalidateCampaign, str, type FormState } from "@/lib/form";

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
  revalidateCampaign(campaignId);
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
  revalidateCampaign(campaignId);
  redirect(compendiumPath(campaignId, kind, slug));
}

export async function setEntityImageAction(campaignId: string, kind: TagKind, slug: string, name: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await setEntityImage(campaignId, kind, slug, name, fd.get("image"));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateCampaign(campaignId);
  return { ok: true, at: Date.now() };
}

export async function removeEntityImageAction(campaignId: string, kind: TagKind, slug: string) {
  await removeEntityImage(campaignId, kind, slug);
  revalidateCampaign(campaignId);
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
  revalidateCampaign(campaignId);
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
  revalidateCampaign(campaignId);
  return { ok: true, at: Date.now() };
}

export async function deleteNoteAction(campaignId: string, noteId: string): Promise<FormState> {
  return mutate(campaignId, () => deleteNote(noteId));
}

// --- Relazioni ---------------------------------------------------------------

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
  revalidateCampaign(campaignId);
  return { ok: true, values: { public: keep.public, toKind }, at };
}

export async function deleteRelationAction(campaignId: string, relationId: string): Promise<FormState> {
  return mutate(campaignId, () => deleteRelation(relationId));
}
