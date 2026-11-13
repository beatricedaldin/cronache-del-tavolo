"use client";

import { useState, useTransition } from "react";
import { proseAction, suggestTagsAction } from "@/app/ai-actions";
import type { TagSuggestions } from "@/lib/data/ai";
import { tagSyntax } from "@/lib/tags";
import { EntryBody } from "./entry-body";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Trasforma le occorrenze "nude" di un nome in tag (non tocca quelle già con @ o #). */
function applyTag(text: string, name: string, kind: "npc" | "place") {
  const re = new RegExp(`(?<![@#\\[\\p{L}\\p{N}_])${escapeRe(name)}(?![\\p{L}\\p{N}_\\]])`, "gu");
  return text.replace(re, tagSyntax(kind, name));
}

/**
 * Strumenti AI del diario, lavorano sul testo che stai scrivendo:
 * - "In prosa": dagli appunti a una pagina scorrevole nella voce del tuo PG
 * - "Suggerisci tag": propone @ # ? ! da aggiungere
 * Niente viene salvato finché non premi "Salva nel diario".
 */
export function AiWritingTools({ campaignId, textRef }: { campaignId: string; textRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"prose" | "tags" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prose, setProse] = useState<string | null>(null);
  const [tags, setTags] = useState<TagSuggestions | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const current = () => textRef.current?.value ?? "";
  function replaceText(next: string) {
    const ta = textRef.current;
    if (!ta) return;
    ta.value = next;
    ta.focus();
  }

  function runProse() {
    setError(null);
    setTags(null);
    setBusy("prose");
    start(async () => {
      const r = await proseAction(campaignId, current());
      setBusy(null);
      if (r.error) setError(r.error);
      else setProse(r.text ?? null);
    });
  }

  function runTags() {
    setError(null);
    setProse(null);
    setBusy("tags");
    start(async () => {
      const r = await suggestTagsAction(campaignId, current());
      setBusy(null);
      if (r.error) return setError(r.error);
      const s = r.suggestions!;
      if (s.tags.length + s.threads.length + s.goals.length === 0) return setError("Nessun suggerimento: il testo sembra già a posto.");
      setTags(s);
      setChosen(new Set([...s.tags.map((t) => `t:${t.name}`), ...s.threads.map((t) => `q:${t}`), ...s.goals.map((g) => `g:${g}`)]));
    });
  }

  function toggle(key: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyTags() {
    if (!tags) return;
    let text = current();
    for (const t of tags.tags) if (chosen.has(`t:${t.name}`)) text = applyTag(text, t.name, t.kind);
    const extra = [
      ...tags.threads.filter((t) => chosen.has(`q:${t}`)).map((t) => `? ${t}`),
      ...tags.goals.filter((g) => chosen.has(`g:${g}`)).map((g) => `! ${g}`),
    ];
    if (extra.length) text = `${text.trimEnd()}\n${extra.join("\n")}`;
    replaceText(text);
    setTags(null);
  }

  const check = (key: string, label: React.ReactNode) => (
    <label key={key} className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={chosen.has(key)} onChange={() => toggle(key)} className="accent-accent" />
      {label}
    </label>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" onClick={runProse} disabled={pending}>
          {busy === "prose" ? "Scrivo…" : "✨ In prosa"}
        </button>
        <button type="button" className="btn-ghost" onClick={runTags} disabled={pending}>
          {busy === "tags" ? "Leggo…" : "✨ Suggerisci tag"}
        </button>
        {error && <span className="text-sm font-bold text-danger">{error}</span>}
      </div>

      {prose && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gold bg-panel-2 p-3">
          <p className="label text-gold">✨ Proposta in prosa: rileggila prima di usarla</p>
          <EntryBody body={prose} campaignId={campaignId} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => (replaceText(prose), setProse(null))}>
              Sostituisci i miei appunti
            </button>
            <button type="button" className="btn-ghost" onClick={() => (replaceText(`${current().trimEnd()}\n\n${prose}`), setProse(null))}>
              Aggiungi sotto
            </button>
            <button type="button" className="btn-ghost" onClick={() => setProse(null)}>
              Lascia stare
            </button>
          </div>
        </div>
      )}

      {tags && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gold bg-panel-2 p-3">
          <p className="label text-gold">✨ Suggerimenti: togli la spunta a quelli che non vuoi</p>
          {tags.tags.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="label">Nomi da collegare al compendio</span>
              {tags.tags.map((t) =>
                check(
                  `t:${t.name}`,
                  <span className={`rounded-md px-1.5 font-bold ${t.kind === "npc" ? "bg-npc-bg text-npc" : "bg-place-bg text-place"}`}>
                    {tagSyntax(t.kind, t.name)}
                  </span>,
                ),
              )}
            </div>
          )}
          {tags.threads.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="label">Fili in sospeso da aggiungere</span>
              {tags.threads.map((t) => check(`q:${t}`, <span className="font-bold text-thread">? {t}</span>))}
            </div>
          )}
          {tags.goals.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="label">Obiettivi da aggiungere</span>
              {tags.goals.map((g) => check(`g:${g}`, <span className="font-bold text-goal">! {g}</span>))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={applyTags} disabled={chosen.size === 0}>
              Applica al testo
            </button>
            <button type="button" className="btn-ghost" onClick={() => setTags(null)}>
              Lascia stare
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
