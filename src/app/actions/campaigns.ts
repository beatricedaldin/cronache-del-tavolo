"use server";

import { redirect } from "next/navigation";
import { createCampaign, joinCampaign, openCampaign, transferGm } from "@/lib/data/campaigns";
import { errorMessage, mutate, str, type FormState } from "@/lib/form";

export async function createCampaignAction(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const personal = str(fd, "personal") === "1";
  if (!name) return { error: personal ? "Dai un nome alla campagna del tuo PG." : "Dai un nome alla campagna." };
  let id: string;
  try {
    id = await createCampaign(name, personal);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  // In una campagna personale la prima cosa da fare è la scheda del PG.
  redirect(personal ? `/c/${id}/scheda/modifica` : `/c/${id}`);
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

export async function openCampaignAction(campaignId: string): Promise<FormState> {
  return mutate(campaignId, () => openCampaign(campaignId));
}

export async function transferGmAction(campaignId: string, userId: string): Promise<FormState> {
  return mutate(campaignId, () => transferGm(campaignId, userId));
}
