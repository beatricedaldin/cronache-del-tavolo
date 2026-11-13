import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";

export type LedgerEntry = {
  id: string;
  amount: number;
  reason: string;
  sessionNumber: number | null;
  date: string;
  authorId: string;
  authorName: string;
};

export type PartyItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  holder: string;
  gone: boolean;
  goneNote: string;
  addedBy: string;
  addedByName: string;
  updatedAt: string;
};

export type Party = { balance: number; ledger: LedgerEntry[]; items: PartyItem[] };

/** Cassa e inventario del gruppo: li vedono tutti i membri della campagna. */
export async function getParty(campaignId: string): Promise<Party> {
  await getCurrentUser();
  const supabase = await createClient();
  const [ledger, items] = await Promise.all([
    supabase
      .from("party_ledger")
      .select("id, amount, reason, session_number, entry_date, author_id, author:profiles(display_name)")
      .eq("campaign_id", campaignId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("party_items")
      .select("id, name, description, quantity, holder, gone, gone_note, added_by, updated_at, adder:profiles(display_name)")
      .eq("campaign_id", campaignId)
      .order("gone")
      .order("name"),
  ]);
  if (ledger.error) throw dbError(ledger.error);
  if (items.error) throw dbError(items.error);

  const entries: LedgerEntry[] = (ledger.data ?? []).map((r) => ({
    id: r.id,
    amount: r.amount,
    reason: r.reason,
    sessionNumber: r.session_number,
    date: r.entry_date,
    authorId: r.author_id,
    authorName: (r.author as unknown as { display_name: string } | null)?.display_name ?? "—",
  }));

  return {
    balance: entries.reduce((sum, e) => sum + e.amount, 0),
    ledger: entries,
    items: (items.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      quantity: r.quantity,
      holder: r.holder,
      gone: r.gone,
      goneNote: r.gone_note,
      addedBy: r.added_by,
      addedByName: (r.adder as unknown as { display_name: string } | null)?.display_name ?? "—",
      updatedAt: r.updated_at,
    })),
  };
}

export async function addLedgerEntry(
  campaignId: string,
  input: { amount: number; reason: string; sessionNumber: number | null; date: string | null },
) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("party_ledger").insert({
    campaign_id: campaignId,
    author_id: user.id,
    amount: input.amount,
    reason: input.reason,
    session_number: input.sessionNumber,
    ...(input.date ? { entry_date: input.date } : {}),
  });
  if (error) throw dbError(error);
}

/** Chi l'ha inserito o il Master (lo decide il database). */
export async function deleteLedgerEntry(id: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("party_ledger").delete().eq("id", id);
  if (error) throw dbError(error);
}

export type ItemInput = { name: string; description: string; quantity: number; holder: string; gone: boolean; goneNote: string };

export async function addItem(campaignId: string, input: ItemInput) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("party_items").insert({
    campaign_id: campaignId,
    added_by: user.id,
    name: input.name,
    description: input.description,
    quantity: input.quantity,
    holder: input.holder,
    gone: input.gone,
    gone_note: input.goneNote,
  });
  if (error) throw dbError(error);
}

/** L'inventario è di tutti: chiunque nel gruppo può aggiornarlo. */
export async function updateItem(id: string, input: ItemInput) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("party_items")
    .update({
      name: input.name,
      description: input.description,
      quantity: input.quantity,
      holder: input.holder,
      gone: input.gone,
      gone_note: input.goneNote,
    })
    .eq("id", id);
  if (error) throw dbError(error);
}

export async function deleteItem(id: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("party_items").delete().eq("id", id);
  if (error) throw dbError(error);
}
