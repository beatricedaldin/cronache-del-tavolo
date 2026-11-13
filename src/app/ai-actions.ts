"use server";

import { revalidatePath } from "next/cache";
import {
  askAboutEntity,
  generateMyRecap,
  suggestTags,
  writeChapter,
  writeProse,
  type Chapter,
  type Recap,
  type TagSuggestions,
} from "@/lib/data/ai";
import type { TagKind } from "@/lib/tags";

const message = (e: unknown) => (e instanceof Error ? e.message : "Qualcosa è andato storto. Riprova.");

export type RecapState = { recap?: Recap; error?: string };

export async function generateRecapAction(campaignId: string, prev: RecapState): Promise<RecapState> {
  try {
    const recap = await generateMyRecap(campaignId);
    revalidatePath(`/c/${campaignId}`);
    return { recap };
  } catch (e) {
    return { ...prev, error: message(e) };
  }
}

export type AskState = { text?: string; error?: string };

export async function askAboutAction(campaignId: string, kind: TagKind, slug: string): Promise<AskState> {
  try {
    return { text: await askAboutEntity(campaignId, kind, slug) };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function proseAction(campaignId: string, notes: string): Promise<{ text?: string; error?: string }> {
  try {
    return { text: await writeProse(campaignId, notes) };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function suggestTagsAction(campaignId: string, text: string): Promise<{ suggestions?: TagSuggestions; error?: string }> {
  try {
    return { suggestions: await suggestTags(campaignId, text) };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function writeChapterAction(campaignId: string, session: number): Promise<{ chapter?: Chapter; error?: string }> {
  try {
    const chapter = await writeChapter(campaignId, session);
    revalidatePath(`/c/${campaignId}/libro`);
    return { chapter };
  } catch (e) {
    return { error: message(e) };
  }
}
