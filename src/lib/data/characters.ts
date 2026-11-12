import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";
import type { Character } from "./types";

const COLUMNS =
  "id, owner_id, name, classes, level, identity, theme, origin, fabula_points, notes, owner:profiles(display_name), bonds(id, target, emotions, created_at)";

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
  if (error) throw new Error(error.message);
  return data ? toCharacter(data as unknown as Row) : null;
}

/** Tutti i PG della campagna. Il database li restituisce tutti solo al Master. */
export async function listCharacters(campaignId: string): Promise<Character[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("characters").select(COLUMNS).eq("campaign_id", campaignId).order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toCharacter);
}

export type CharacterInput = {
  name: string;
  classes: string;
  level: number;
  identity: string;
  theme: string;
  origin: string;
  fabulaPoints: number;
  notes: string;
};

export async function saveMyCharacter(campaignId: string, input: CharacterInput) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("characters").upsert(
    {
      campaign_id: campaignId,
      owner_id: user.id,
      name: input.name,
      classes: input.classes,
      level: input.level,
      identity: input.identity,
      theme: input.theme,
      origin: input.origin,
      fabula_points: input.fabulaPoints,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "campaign_id,owner_id" },
  );
  if (error) throw new Error(error.message);
}

export async function addBond(characterId: string, target: string, emotions: string[]) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("bonds").insert({ character_id: characterId, target, emotions });
  if (error) throw new Error(error.message);
}

export async function deleteBond(bondId: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("bonds").delete().eq("id", bondId);
  if (error) throw new Error(error.message);
}
