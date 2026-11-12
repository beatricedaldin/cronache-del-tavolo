import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";
import { checkImage, randomName, removeImage, signedUrls, uploadImage } from "./storage";
import { characterLevel, classesLabel, normalizeEmotions, normalizeSheet, RULES, type Sheet } from "@/lib/fabula";
import type { Character } from "./types";

const COLUMNS =
  "id, owner_id, name, classes, level, identity, theme, origin, fabula_points, notes, sheet, portrait_path, owner:profiles(display_name), bonds(id, target, emotions, created_at)";

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

export async function saveMyCharacter(campaignId: string, input: CharacterInput) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const sheet = normalizeSheet(input.sheet);
  const { error } = await supabase.from("characters").upsert(
    {
      campaign_id: campaignId,
      owner_id: user.id,
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
    },
    { onConflict: "campaign_id,owner_id" },
  );
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
