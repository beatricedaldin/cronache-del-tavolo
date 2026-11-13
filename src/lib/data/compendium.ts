import "server-only";
import { createClient } from "@/lib/supabase/server";
import { slugify, type TagKind } from "@/lib/tags";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";
import { ENTRY_COLUMNS, toEntry, type EntryRow } from "./diary";
import { checkImage, randomName, removeImage, signedUrls, uploadImage } from "./storage";
import type { EntityCard, EntityDetail, EntityImage, EntityNote, EntityRelation, EntitySummary } from "./types";

type EntityRow = {
  kind: TagKind;
  slug: string;
  name: string;
  owner_id: string;
  entry_mentions: { entry: { session_number: number } | null }[];
};

const key = (kind: string, slug: string) => `${kind}:${slug}`;

/**
 * Il compendio: tutto quello che l'utente può vedere, raggruppato per nome.
 * - le entità citate nelle voci che può leggere (le sue, quelle pubbliche, tutte se è il Master)
 * - le schede pubbliche scritte dal Master
 * - le note del compendio che può leggere
 */
export async function listEntities(campaignId: string): Promise<EntitySummary[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const [entities, cards, notes, relations] = await Promise.all([
    supabase
      .from("entities")
      .select("kind, slug, name, owner_id, entry_mentions(entry:entries(session_number))")
      .eq("campaign_id", campaignId),
    supabase.from("entity_cards").select("kind, slug, name").eq("campaign_id", campaignId),
    supabase.from("entity_notes").select("kind, slug, name").eq("campaign_id", campaignId),
    supabase.from("entity_relations").select("from_kind, from_slug, from_name, to_kind, to_slug, to_name").eq("campaign_id", campaignId),
  ]);
  if (relations.error) throw dbError(relations.error);
  if (entities.error) throw dbError(entities.error);
  if (cards.error) throw dbError(cards.error);
  if (notes.error) throw dbError(notes.error);

  type Group = EntitySummary & { owners: Set<string> };
  const groups = new Map<string, Group>();
  const group = (kind: TagKind, slug: string, name: string) => {
    const k = key(kind, slug);
    let g = groups.get(k);
    if (!g) {
      g = { kind, slug, name, mentions: 0, firstSession: null, lastSession: null, authors: 0, hasCard: false, notes: 0, owners: new Set() };
      groups.set(k, g);
    }
    return g;
  };

  for (const e of (entities.data ?? []) as unknown as EntityRow[]) {
    const visible = e.entry_mentions.filter((m) => m.entry);
    if (visible.length === 0) continue;
    const g = group(e.kind, e.slug, e.name);
    g.owners.add(e.owner_id);
    for (const m of visible) {
      const s = m.entry!.session_number;
      g.mentions += 1;
      g.firstSession = g.firstSession === null ? s : Math.min(g.firstSession, s);
      g.lastSession = g.lastSession === null ? s : Math.max(g.lastSession, s);
    }
  }
  for (const c of cards.data ?? []) {
    const g = group(c.kind as TagKind, c.slug, c.name);
    g.name = c.name; // Il nome scritto dal Master ha la precedenza.
    g.hasCard = true;
  }
  for (const n of notes.data ?? []) group(n.kind as TagKind, n.slug, n.name).notes += 1;
  for (const r of relations.data ?? []) {
    group(r.from_kind as TagKind, r.from_slug, r.from_name);
    group(r.to_kind as TagKind, r.to_slug, r.to_name);
  }

  return [...groups.values()]
    .map(({ owners, ...g }) => ({ ...g, authors: owners.size }))
    .sort((a, b) => (b.lastSession ?? 0) - (a.lastSession ?? 0) || b.mentions - a.mentions || a.name.localeCompare(b.name, "it"));
}

type NoteRow = {
  id: string;
  owner_id: string;
  body: string;
  is_public: boolean;
  note_date: string;
  created_at: string;
  updated_at: string;
  name: string;
  owner: { display_name: string } | null;
};

/** Tutto quello che l'utente può leggere su un personaggio o un luogo. */
export async function getEntity(campaignId: string, kind: TagKind, slug: string): Promise<EntityDetail | null> {
  await getCurrentUser();
  const supabase = await createClient();
  // Lo slug finisce in un filtro "or" di PostgREST: deve contenere solo lettere, numeri e trattini.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const [entities, card, notes, relationRows, imageRow] = await Promise.all([
    supabase
      .from("entities")
      .select(`name, entry_mentions(entry:entries(${ENTRY_COLUMNS}))`)
      .eq("campaign_id", campaignId)
      .eq("kind", kind)
      .eq("slug", slug),
    supabase
      .from("entity_cards")
      .select("name, description")
      .eq("campaign_id", campaignId)
      .eq("kind", kind)
      .eq("slug", slug)
      .maybeSingle(),
    supabase
      .from("entity_notes")
      .select("id, owner_id, body, is_public, note_date, created_at, updated_at, name, owner:profiles(display_name)")
      .eq("campaign_id", campaignId)
      .eq("kind", kind)
      .eq("slug", slug)
      .order("note_date")
      .order("created_at"),
    supabase
      .from("entity_relations")
      .select("id, owner_id, from_kind, from_slug, from_name, label, to_kind, to_slug, to_name, is_public, owner:profiles(display_name)")
      .eq("campaign_id", campaignId)
      .or(`and(from_kind.eq.${kind},from_slug.eq.${slug}),and(to_kind.eq.${kind},to_slug.eq.${slug})`)
      .order("created_at"),
    supabase
      .from("entity_images")
      .select("image_path, uploaded_by, uploader:profiles(display_name)")
      .eq("campaign_id", campaignId)
      .eq("kind", kind)
      .eq("slug", slug)
      .maybeSingle(),
  ]);
  if (imageRow.error) throw dbError(imageRow.error);
  if (entities.error) throw dbError(entities.error);
  if (card.error) throw dbError(card.error);
  if (notes.error) throw dbError(notes.error);
  if (relationRows.error) throw dbError(relationRows.error);

  const rows = (entities.data ?? []) as unknown as { name: string; entry_mentions: { entry: EntryRow | null }[] }[];
  const byId = new Map<string, EntryRow>();
  for (const r of rows) for (const m of r.entry_mentions) if (m.entry) byId.set(m.entry.id, m.entry);
  const entries = [...byId.values()]
    .map(toEntry)
    .sort((a, b) => a.sessionNumber - b.sessionNumber || a.createdAt.localeCompare(b.createdAt));

  const noteRows = (notes.data ?? []) as unknown as NoteRow[];
  type RelationRow = {
    id: string;
    owner_id: string;
    from_kind: TagKind;
    from_slug: string;
    from_name: string;
    label: string;
    to_kind: TagKind;
    to_slug: string;
    to_name: string;
    is_public: boolean;
    owner: { display_name: string } | null;
  };
  const relRows = (relationRows.data ?? []) as unknown as RelationRow[];
  const relations: EntityRelation[] = relRows.map((r) => {
    const out = r.from_kind === kind && r.from_slug === slug;
    return {
      id: r.id,
      ownerId: r.owner_id,
      ownerName: r.owner?.display_name ?? "—",
      label: r.label,
      direction: out ? "out" : "in",
      other: out ? { kind: r.to_kind, slug: r.to_slug, name: r.to_name } : { kind: r.from_kind, slug: r.from_slug, name: r.from_name },
      isPublic: r.is_public,
    };
  });

  if (entries.length === 0 && !card.data && noteRows.length === 0 && relRows.length === 0 && !imageRow.data) return null;

  const entityCard: EntityCard | null = card.data ? { name: card.data.name, description: card.data.description } : null;
  let image: EntityImage | null = null;
  if (imageRow.data) {
    const urls = await signedUrls("compendio", [imageRow.data.image_path]);
    image = {
      path: imageRow.data.image_path,
      url: urls.get(imageRow.data.image_path) ?? null,
      uploadedBy: imageRow.data.uploaded_by,
      uploaderName: (imageRow.data.uploader as unknown as { display_name: string } | null)?.display_name ?? "—",
    };
  }

  const fromRelation = relRows.map((r) => (r.from_kind === kind && r.from_slug === slug ? r.from_name : r.to_name))[0];
  const name =
    entityCard?.name ?? rows.find((r) => r.entry_mentions.some((m) => m.entry))?.name ?? rows[0]?.name ?? noteRows[0]?.name ?? fromRelation;
  const entityNotes: EntityNote[] = noteRows.map((n) => ({
    id: n.id,
    ownerId: n.owner_id,
    ownerName: n.owner?.display_name ?? "—",
    body: n.body,
    isPublic: n.is_public,
    date: n.note_date,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  return { kind, slug, name, entries, card: entityCard, image, notes: entityNotes, relations };
}

/** Nomi già usati dall'utente, per i suggerimenti nel composer. */
export async function listEntityNames(campaignId: string): Promise<{ kind: TagKind; name: string }[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("entities")
    .select("kind, name")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as { kind: TagKind; name: string }[];
}

// --- Scheda pubblica (solo Master) ------------------------------------------

/** Crea o aggiorna la scheda pubblica. Restituisce lo slug (utile quando il Master crea una voce nuova). */
export async function saveCard(campaignId: string, kind: TagKind, name: string, description: string, slug?: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const finalSlug = slug ?? slugify(name);
  if (!finalSlug) throw new Error("Serve un nome.");
  const { error } = await supabase
    .from("entity_cards")
    .upsert(
      { campaign_id: campaignId, kind, slug: finalSlug, name, description, updated_at: new Date().toISOString() },
      { onConflict: "campaign_id,kind,slug" },
    );
  if (error) throw dbError(error);
  return finalSlug;
}

// --- Immagine (chiunque nella campagna) ---------------------------------------

async function currentImage(campaignId: string, kind: TagKind, slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_images")
    .select("image_path")
    .eq("campaign_id", campaignId)
    .eq("kind", kind)
    .eq("slug", slug)
    .maybeSingle();
  return data?.image_path ?? null;
}

/** Carica o sostituisce l'immagine di un PNG o luogo. Chi la carica ne diventa l'autore. */
export async function setEntityImage(campaignId: string, kind: TagKind, slug: string, name: string, file: unknown) {
  const user = await getCurrentUser();
  const { file: image, ext } = checkImage(file);
  const before = await currentImage(campaignId, kind, slug);

  const path = `${campaignId}/${kind}/${slug}-${randomName(ext)}`;
  await uploadImage("compendio", path, image);
  const supabase = await createClient();
  const { error } = await supabase.from("entity_images").upsert(
    { campaign_id: campaignId, kind, slug, name, image_path: path, uploaded_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "campaign_id,kind,slug" },
  );
  if (error) {
    await removeImage("compendio", path);
    throw dbError(error);
  }
  await removeImage("compendio", before);
}

/** Toglie l'immagine: può farlo chi l'ha caricata oppure il Master (lo decide il database). */
export async function removeEntityImage(campaignId: string, kind: TagKind, slug: string) {
  await getCurrentUser();
  const before = await currentImage(campaignId, kind, slug);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entity_images")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("kind", kind)
    .eq("slug", slug)
    .select("image_path");
  if (error) throw dbError(error);
  if (!data || data.length === 0) throw new Error("Può togliere l'immagine solo chi l'ha caricata o il Master.");
  await removeImage("compendio", before);
}

// --- Note dei giocatori (e del Master) --------------------------------------

export async function addNote(campaignId: string, kind: TagKind, slug: string, name: string, body: string, isPublic: boolean, date: string | null) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("entity_notes")
    .insert({ campaign_id: campaignId, owner_id: user.id, kind, slug, name, body, is_public: isPublic, ...(date ? { note_date: date } : {}) });
  if (error) throw dbError(error);
}

export async function updateNote(noteId: string, body: string, isPublic: boolean, date: string | null) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("entity_notes")
    .update({ body, is_public: isPublic, ...(date ? { note_date: date } : {}), updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("owner_id", user.id);
  if (error) throw dbError(error);
}

export async function deleteNote(noteId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("entity_notes").delete().eq("id", noteId).eq("owner_id", user.id);
  if (error) throw dbError(error);
}

/** Tutti i nomi che l'utente può vedere (suoi, pubblici, schede del Master), per i suggerimenti mentre scrive. */
export async function listTagNames(campaignId: string): Promise<{ kind: TagKind; name: string }[]> {
  const entities = await listEntities(campaignId);
  return entities.map((e) => ({ kind: e.kind, name: e.name }));
}

// --- Relazioni ("Velia → sorella di → Mastro Odo") ---------------------------

export type RelationInput = {
  from: { kind: TagKind; slug: string; name: string };
  label: string;
  to: { kind: TagKind; name: string };
  isPublic: boolean;
};

export async function addRelation(campaignId: string, input: RelationInput) {
  const user = await getCurrentUser();
  const toSlug = slugify(input.to.name);
  if (!toSlug) throw new Error("Con chi o cosa è la relazione?");
  if (toSlug === input.from.slug && input.to.kind === input.from.kind) throw new Error("Una relazione deve collegare due voci diverse.");
  const supabase = await createClient();
  const { error } = await supabase.from("entity_relations").insert({
    campaign_id: campaignId,
    owner_id: user.id,
    from_kind: input.from.kind,
    from_slug: input.from.slug,
    from_name: input.from.name,
    label: input.label,
    to_kind: input.to.kind,
    to_slug: toSlug,
    to_name: input.to.name,
    is_public: input.isPublic,
  });
  if (error) throw dbError(error);
  return toSlug;
}

export async function deleteRelation(relationId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("entity_relations").delete().eq("id", relationId).eq("owner_id", user.id);
  if (error) throw dbError(error);
}
