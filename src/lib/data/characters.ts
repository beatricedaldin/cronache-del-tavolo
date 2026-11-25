import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";
import { checkImage, randomName, removeImage, signedUrls, uploadImage } from "./storage";
import { todayISO } from "@/lib/dates";
import {
  characterCreationErrors,
  characterLevel,
  classesLabel,
  type EquipmentAcquisition,
  type EquipmentPaymentSource,
  type EquipmentSlot,
  normalizeEmotions,
  normalizeSheet,
  RULES,
  type Sheet,
} from "@/lib/fabula";
import type { Character } from "./types";

const COLUMNS =
  "id, owner_id, name, classes, level, identity, theme, origin, fabula_points, notes, sheet, portrait_path, updated_at, owner:profiles!owner_id(display_name), bonds(id, target, emotions, created_at)";

type Row = {
  id: string;
  owner_id: string;
  name: string;
  classes: string;
  level: number;
  identity: string;
  theme: string;
  origin: string;
  fabula_points: number;
  notes: string;
  sheet: unknown;
  portrait_path: string | null;
  updated_at: string;
  owner: { display_name: string } | null;
  bonds: { id: string; target: string; emotions: string[]; created_at: string }[];
};

function toCharacter(r: Row): Character {
  return {
    id: r.id,
    ownerId: r.owner_id,
    ownerName: r.owner?.display_name ?? "—",
    name: r.name,
    classes: r.classes,
    level: r.level,
    identity: r.identity,
    theme: r.theme,
    origin: r.origin,
    fabulaPoints: r.fabula_points,
    notes: r.notes,
    sheet: normalizeSheet(r.sheet),
    portraitPath: r.portrait_path,
    portraitUrl: null,
    updatedAt: r.updated_at,
    bonds: [...r.bonds]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id, target, emotions }) => ({ id, target, emotions })),
  };
}

export async function getMyCharacter(campaignId: string): Promise<Character | null> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select(COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) return null;
  const [character] = await withPortraits([toCharacter(data as unknown as Row)]);
  return character;
}

/** Tutti i PG della campagna. Il database li restituisce tutti solo al Master. */
export async function listCharacters(campaignId: string): Promise<Character[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("characters").select(COLUMNS).eq("campaign_id", campaignId).order("name");
  if (error) throw dbError(error);
  return withPortraits(((data ?? []) as unknown as Row[]).map(toCharacter));
}

async function withPortraits(characters: Character[]): Promise<Character[]> {
  const urls = await signedUrls("ritratti", characters.map((c) => c.portraitPath));
  return characters.map((c) => ({ ...c, portraitUrl: c.portraitPath ? (urls.get(c.portraitPath) ?? null) : null }));
}

export type CharacterInput = {
  name: string;
  identity: string;
  theme: string;
  origin: string;
  fabulaPoints: number;
  notes: string;
  sheet: Sheet;
};

export type AdvancementInput = { sessionNumber: number | null; summary: string };
export type CharacterEquipmentAcquisitionInput = {
  name: string;
  slot: EquipmentSlot;
  quantity: number;
  cost: number;
  acquisition: Exclude<EquipmentAcquisition, "starting" | "unknown">;
  paymentSource: EquipmentPaymentSource | null;
  sessionNumber: number | null;
  acquiredOn: string;
  defense: number;
  magicDefense: number;
  initiative: number;
  summary: string;
};

export const STALE_SHEET_MESSAGE =
  "Nel frattempo la scheda è cambiata (per esempio un acquisto nell'inventario). Ricarica la pagina e rifai le modifiche: così non si perde niente.";

/**
 * Aggiorna la scheda del proprio PG. Non la crea: per quello c'è createMyCharacter, che controlla le regole.
 * `version` è l'updatedAt della scheda che l'editor ha caricato: se nel frattempo è cambiata
 * (un acquisto, un'altra scheda del browser), il salvataggio si ferma invece di sovrascriverla.
 */
export async function saveMyCharacter(
  campaignId: string,
  input: CharacterInput,
  version: string,
  advancement?: AdvancementInput,
) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("characters")
    .select("id, sheet, updated_at")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (currentError) throw dbError(currentError);
  if (!current) throw new Error("Non hai ancora un personaggio: crealo con la procedura guidata.");
  if (Date.parse(current.updated_at) !== Date.parse(version)) throw new Error(STALE_SHEET_MESSAGE);

  const sheet = normalizeSheet(input.sheet);
  const previous = normalizeSheet(current?.sheet);
  sheet.advancements = previous.advancements;
  if (advancement) {
    sheet.advancements = [
      ...previous.advancements.slice(-199),
      {
        date: todayISO(),
        sessionNumber: advancement.sessionNumber,
        level: characterLevel(sheet, RULES.startingLevel),
        classes: classesLabel(sheet),
        summary: advancement.summary.trim().slice(0, 1500),
      },
    ];
  }
  // Il filtro su updated_at rende il controllo atomico: se un acquisto arriva tra la lettura
  // e la scrittura, non si aggiorna nessuna riga.
  const { data: saved, error } = await supabase
    .from("characters")
    .update({
      name: input.name,
      // Livello e classi sono ricavati dalla scheda, così restano coerenti.
      classes: classesLabel(sheet),
      level: Math.max(1, characterLevel(sheet, 5)),
      identity: input.identity,
      theme: input.theme,
      origin: input.origin,
      fabula_points: input.fabulaPoints,
      notes: input.notes,
      sheet,
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .eq("updated_at", current.updated_at)
    .select("id");
  if (error) throw dbError(error);
  if (!saved?.length) throw new Error(STALE_SHEET_MESSAGE);
}

export async function acquireCharacterEquipment(characterId: string, input: CharacterEquipmentAcquisitionInput) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_character_equipment", {
    p_character_id: characterId,
    p_name: input.name,
    p_slot: input.slot,
    p_quantity: input.quantity,
    p_cost: input.cost,
    p_acquisition: input.acquisition,
    p_payment_source: input.paymentSource,
    p_session_number: input.sessionNumber,
    p_acquired_on: input.acquiredOn,
    p_defense: input.defense,
    p_magic_defense: input.magicDefense,
    p_initiative: input.initiative,
    p_summary: input.summary,
  });
  if (error) throw dbError(error);
}

/** Crea il primo personaggio dopo aver verificato le regole della creazione guidata. */
export async function createMyCharacter(campaignId: string, input: CharacterInput, savingsRoll: number) {
  const user = await getCurrentUser();
  const name = input.name.trim();
  const identity = input.identity.trim();
  const theme = input.theme.trim();
  const origin = input.origin.trim();
  if (!name || !identity || !theme || !origin) {
    throw new Error("Completa nome, Identità, Tema e Origine.");
  }
  if (!Number.isInteger(savingsRoll) || savingsRoll < 2 || savingsRoll > 12) {
    throw new Error("Il tiro dei risparmi iniziali deve essere compreso tra 2 e 12.");
  }

  const sheet = normalizeSheet(input.sheet);
  const errors = characterCreationErrors(sheet);
  if (errors.length > 0) throw new Error(errors[0]);
  sheet.zenit = RULES.equipmentBudget - sheet.equipment.reduce((sum, item) => sum + item.cost, 0) + savingsRoll * 10;

  const supabase = await createClient();
  const { error } = await supabase.from("characters").insert({
    campaign_id: campaignId,
    owner_id: user.id,
    name,
    classes: classesLabel(sheet),
    level: characterLevel(sheet, RULES.startingLevel),
    identity,
    theme,
    origin,
    fabula_points: input.fabulaPoints,
    notes: input.notes,
    sheet,
  });
  if (error) throw dbError(error);
}

export async function addBond(characterId: string, target: string, emotions: string[]) {
  await getCurrentUser();
  const supabase = await createClient();
  const clean = normalizeEmotions(emotions);
  if (clean.length === 0) throw new Error("Scegli almeno un'emozione.");
  const { count } = await supabase
    .from("bonds")
    .select("id", { count: "exact", head: true })
    .eq("character_id", characterId);
  if ((count ?? 0) >= RULES.maxBonds) throw new Error(`Puoi avere al massimo ${RULES.maxBonds} Legami.`);
  const { error } = await supabase.from("bonds").insert({ character_id: characterId, target, emotions: clean });
  if (error) throw dbError(error);
}

export async function deleteBond(bondId: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("bonds").delete().eq("id", bondId);
  if (error) throw dbError(error);
}

/** Cambia le emozioni di un Legame (succede spesso a fine sessione). */
export async function updateBond(bondId: string, emotions: string[]) {
  await getCurrentUser();
  const supabase = await createClient();
  const clean = normalizeEmotions(emotions);
  if (clean.length === 0) throw new Error("Scegli almeno un'emozione.");
  const { error } = await supabase.from("bonds").update({ emotions: clean }).eq("id", bondId);
  if (error) throw dbError(error);
}

/** Carica il ritratto del proprio PG, sostituendo quello vecchio. */
export async function setMyPortrait(campaignId: string, file: unknown) {
  const user = await getCurrentUser();
  const { file: image, ext } = checkImage(file);
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("characters")
    .select("portrait_path")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!current) throw new Error("Salva prima la scheda, poi aggiungi il ritratto.");

  const path = `${campaignId}/${user.id}/${randomName(ext)}`;
  await uploadImage("ritratti", path, image);
  const { error } = await supabase
    .from("characters")
    .update({ portrait_path: path })
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id);
  if (error) {
    await removeImage("ritratti", path);
    throw dbError(error);
  }
  await removeImage("ritratti", current.portrait_path);
}

export async function removeMyPortrait(campaignId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("characters")
    .select("portrait_path")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .maybeSingle();
  const { error } = await supabase
    .from("characters")
    .update({ portrait_path: null })
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id);
  if (error) throw dbError(error);
  await removeImage("ritratti", current?.portrait_path ?? null);
}
