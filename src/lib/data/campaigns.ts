import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "./errors";
import { signedUrls } from "./storage";
import { getCurrentUser } from "./auth";
import type { Campaign, CampaignSummary, Member, Role } from "./types";

export async function listMyCampaigns(): Promise<CampaignSummary[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_members")
    .select("role, campaign:campaigns(id, name)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });
  if (error) throw dbError(error);

  return (data ?? []).flatMap((row) => {
    const c = row.campaign as unknown as { id: string; name: string } | null;
    return c ? [{ id: c.id, name: c.name, role: row.role as Role }] : [];
  });
}

/** La campagna e il ruolo dell'utente collegato. 404 se non ne fa parte. */
export const getCampaign = cache(async (campaignId: string): Promise<Campaign> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_members")
    .select("role, campaign:campaigns(id, name, gm_id, invite_code)")
    .eq("user_id", user.id)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const c = data?.campaign as unknown as
    | { id: string; name: string; gm_id: string; invite_code: string }
    | null
    | undefined;
  if (!data || !c) notFound();

  const role = data.role as Role;
  return {
    id: c.id,
    name: c.name,
    role,
    gmId: c.gm_id,
    // Il codice invito lo vede solo il Master.
    inviteCode: role === "gm" ? c.invite_code : null,
  };
});

export async function createCampaign(name: string): Promise<string> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_campaign", { p_name: name });
  if (error) throw dbError(error);
  return data as string;
}

export async function joinCampaign(code: string): Promise<string> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_campaign", { p_code: code });
  if (error) throw error.message.includes("non valido") ? new Error("Codice invito non valido") : dbError(error);
  return data as string;
}

/** Membri della campagna. Il database restituisce l'elenco completo solo al Master. */
export async function listMembers(campaignId: string): Promise<Member[]> {
  const supabase = await createClient();
  const [{ data: members, error }, { data: chars }] = await Promise.all([
    supabase
      .from("campaign_members")
      .select("user_id, role, profile:profiles(display_name)")
      .eq("campaign_id", campaignId)
      .order("joined_at"),
    supabase.from("characters").select("owner_id, name").eq("campaign_id", campaignId),
  ]);
  if (error) throw dbError(error);

  const byOwner = new Map((chars ?? []).map((c) => [c.owner_id as string, c.name as string]));
  return (members ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role as Role,
    displayName: (m.profile as unknown as { display_name: string } | null)?.display_name ?? "—",
    characterName: byOwner.get(m.user_id) ?? null,
  }));
}

export type PartyMember = { userId: string; displayName: string; characterName: string | null; portraitUrl: string | null };

/** Il gruppo: giocatori, nome del PG e ritratto. Lo vedono tutti i membri (il resto della scheda resta privato). */
export const listParty = cache(async (campaignId: string): Promise<PartyMember[]> => {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("campaign_party", { p_campaign: campaignId });
  if (error) throw dbError(error);
  const rows = (data ?? []) as { user_id: string; display_name: string; character_name: string | null; portrait_path: string | null }[];
  const urls = await signedUrls("ritratti", rows.map((r) => r.portrait_path));
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    characterName: r.character_name,
    portraitUrl: r.portrait_path ? (urls.get(r.portrait_path) ?? null) : null,
  }));
});
