import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ATTRIBUTES, bondStrength, derive, EQUIPMENT_SLOTS } from "@/lib/fabula";
import { formatDay } from "@/lib/dates";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";
import { getCampaign } from "./campaigns";
import { getMyCharacter, listCharacters } from "./characters";
import { listEntries } from "./diary";
import { listEntities } from "./compendium";
import { listQuotes } from "./quotes";
import { listThreads } from "./threads";
import type { Character } from "./types";

/** Tutta la campagna, per come la vede l'utente, in un unico file Markdown. */
export async function exportCampaignMarkdown(campaignId: string): Promise<{ filename: string; markdown: string }> {
  const user = await getCurrentUser();
  const campaign = await getCampaign(campaignId);
  const isGm = campaign.role === "gm";
  const supabase = await createClient();

  const [entries, threads, entities, characters, cards, notes, quotes, relations] = await Promise.all([
    listEntries(campaignId),
    listThreads(campaignId),
    listEntities(campaignId),
    isGm ? listCharacters(campaignId) : getMyCharacter(campaignId).then((c) => (c ? [c] : [])),
    supabase.from("entity_cards").select("kind, slug, description").eq("campaign_id", campaignId),
    supabase
      .from("entity_notes")
      .select("kind, slug, body, is_public, note_date, owner:profiles(display_name)")
      .eq("campaign_id", campaignId)
      .order("note_date"),
    listQuotes(campaignId),
    supabase
      .from("entity_relations")
      .select("from_kind, from_slug, from_name, label, to_name, is_public")
      .eq("campaign_id", campaignId)
      .order("created_at"),
  ]);
  if (relations.error) throw dbError(relations.error);
  if (cards.error) throw dbError(cards.error);
  if (notes.error) throw dbError(notes.error);

  const date = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const out: string[] = [
    `# ${campaign.name}`,
    "",
    `Esportato da ${user.displayName} il ${date}${isGm ? " (Master: contiene le note di tutti)" : ""}.`,
    "",
  ];

  // Personaggi ---------------------------------------------------------------
  out.push(isGm ? "## Personaggi" : "## Il mio personaggio", "");
  if (characters.length === 0) out.push("_Nessun personaggio._", "");
  for (const c of characters) out.push(...characterMarkdown(c, isGm), "");

  // Diario -------------------------------------------------------------------
  out.push("## Diario", "");
  const bySession = new Map<number, typeof entries>();
  for (const e of [...entries].reverse()) bySession.set(e.sessionNumber, [...(bySession.get(e.sessionNumber) ?? []), e]);
  if (bySession.size === 0) out.push("_Il diario è vuoto._", "");
  for (const [n, list] of [...bySession].sort((a, b) => a[0] - b[0])) {
    out.push(`### Sessione ${n}`, "");
    for (const e of list) {
      const who = e.authorId === user.id ? "Io" : e.authorName;
      out.push(`**${who}** · ${formatDay(e.date, "long")} · ${e.isPublic ? "pubblica" : "privata"}`, "", e.body.trim(), "");
    }
  }

  // Frasi memorabili ---------------------------------------------------------
  if (quotes.length > 0) {
    out.push("## Frasi memorabili", "");
    for (const q of [...quotes].reverse()) {
      out.push(`> «${q.text.trim()}»`, `> — **${q.speaker}**${q.sessionNumber ? `, sessione ${q.sessionNumber}` : ""}${q.context ? ` _(${q.context})_` : ""}`, "");
    }
  }

  // Fili e obiettivi ---------------------------------------------------------
  out.push("## Fili in sospeso e obiettivi", "");
  if (threads.length === 0) out.push("_Nessuno._", "");
  for (const kind of ["goal", "question"] as const) {
    const list = threads.filter((t) => t.kind === kind);
    if (list.length === 0) continue;
    out.push(`### ${kind === "goal" ? "Obiettivi" : "Fili in sospeso"}`, "");
    for (const t of list) {
      const done = t.resolvedSession !== null;
      const who = isGm ? ` (${t.ownerName})` : "";
      out.push(`- [${done ? "x" : " "}] ${t.text}${who} — aperto in S${t.openedSession}${done ? `, chiuso in S${t.resolvedSession}` : ""}`);
    }
    out.push("");
  }

  // Compendio ----------------------------------------------------------------
  out.push("## Compendio", "");
  if (entities.length === 0) out.push("_Il compendio è vuoto._", "");
  const descriptions = new Map((cards.data ?? []).map((c) => [`${c.kind}:${c.slug}`, c.description]));
  for (const e of entities) {
    const k = `${e.kind}:${e.slug}`;
    out.push(`### ${e.name}`, "", `_${e.kind === "npc" ? "Personaggio" : "Luogo o fazione"}_` + (e.firstSession ? ` · prima apparizione S${e.firstSession}` : ""), "");
    const description = descriptions.get(k);
    if (description) out.push(description.trim(), "");
    const rels = (relations.data ?? []).filter((r) => `${r.from_kind}:${r.from_slug}` === k);
    if (rels.length) out.push(...rels.map((r) => `- ${r.from_name} → ${r.label} → ${r.to_name}${r.is_public ? "" : " _(privata)_"}`), "");
    for (const n of (notes.data ?? []).filter((x) => `${x.kind}:${x.slug}` === k)) {
      const owner = (n.owner as unknown as { display_name: string } | null)?.display_name ?? "—";
      out.push(`> **${owner}**, ${formatDay(n.note_date, "long")} (${n.is_public ? "pubblica" : "privata"}): ${n.body.trim().replace(/\n/g, "\n> ")}`, "");
    }
  }

  const slug = campaign.name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { filename: `${slug || "campagna"}-${new Date().toISOString().slice(0, 10)}.md`, markdown: out.join("\n") };
}

function characterMarkdown(c: Character, withOwner: boolean): string[] {
  const s = c.sheet;
  const d = derive(s, c.level);
  const lines = [
    `### ${c.name}${withOwner ? ` (${c.ownerName})` : ""}`,
    "",
    `Livello ${d.level}${c.classes ? ` · ${c.classes}` : ""} · ${c.fabulaPoints} Punti Fabula`,
    "",
  ];
  if (c.identity || c.theme || c.origin) {
    lines.push(`- **Identità:** ${c.identity || "—"}`, `- **Tema:** ${c.theme || "—"}`, `- **Origine:** ${c.origin || "—"}`, "");
  }
  lines.push(
    ATTRIBUTES.map((a) => `${a.short} d${s.attributes[a.key]}`).join(" · "),
    "",
    `PV ${s.current.hp ?? d.maxHp}/${d.maxHp} · PM ${s.current.mp ?? d.maxMp}/${d.maxMp} · PI ${s.current.ip ?? d.maxIp}/${d.maxIp} · Difesa ${d.defense} · Difesa Magica ${d.magicDefense} · Iniziativa ${d.initiative}`,
    "",
    `PE ${s.xp} · Zenit ${s.zenit}`,
    "",
  );
  if (c.bonds.length) {
    lines.push("**Legami**", "", ...c.bonds.map((b) => `- ${b.target}: ${b.emotions.join(", ")} (forza ${bondStrength(b.emotions)})`), "");
  }
  if (s.skills.length) {
    lines.push("**Abilità**", "", ...s.skills.map((k) => `- **${k.name}**${k.heroic ? " (Eroica)" : k.source ? ` (${k.source}${k.level > 1 ? `, LA ${k.level}` : ""})` : ""}${k.summary ? `: ${k.summary}` : ""}`), "");
  }
  if (s.spells.length) {
    lines.push("**Incantesimi**", "", ...s.spells.map((x) => `- **${x.name}**${x.mp ? ` · ${x.mp} PM` : ""}${x.target ? ` · ${x.target}` : ""}${x.duration ? ` · ${x.duration}` : ""}${x.summary ? `: ${x.summary}` : ""}`), "");
  }
  if (s.equipment.length) {
    lines.push("**Equipaggiamento**", "", ...s.equipment.map((e) => `- ${EQUIPMENT_SLOTS.find((x) => x.key === e.slot)?.label}: **${e.name}**${e.summary ? ` — ${e.summary}` : ""}`), "");
  }
  if (c.notes) lines.push("**Note**", "", c.notes.trim(), "");
  return lines;
}
