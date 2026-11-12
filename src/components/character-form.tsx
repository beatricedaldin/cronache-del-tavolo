"use client";

import { useActionState } from "react";
import { saveCharacterAction, type FormState } from "@/app/actions";
import type { Character } from "@/lib/data/types";
import { SubmitButton } from "./submit-button";

export function CharacterForm({ campaignId, character }: { campaignId: string; character: Character | null }) {
  const [state, action] = useActionState<FormState, FormData>(saveCharacterAction.bind(null, campaignId), {});
  const c = character;

  const text = (name: keyof Character, label: string, placeholder: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <input name={name} defaultValue={(c?.[name] as string) ?? ""} className="field" placeholder={placeholder} />
    </label>
  );

  return (
    <form action={action} className="panel flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold">{c ? "La tua scheda" : "Crea il tuo personaggio"}</h2>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1.5">
          <span className="label">Nome del PG</span>
          <input name="name" required defaultValue={c?.name ?? ""} className="field" placeholder="Es. Kael Senzaterra" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="label">Livello</span>
            <input name="level" type="number" min={1} max={60} defaultValue={c?.level ?? 5} className="field" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Punti Fabula</span>
            <input name="fabulaPoints" type="number" min={0} defaultValue={c?.fabulaPoints ?? 3} className="field" />
          </label>
        </div>
      </div>
      {text("classes", "Classi", "Es. Furia 5 · Arcanista 3")}
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="label mb-2">Tratti</legend>
        {text("identity", "Identità", "Es. Mercenario in cerca di riscatto")}
        {text("theme", "Tema", "Es. Vendetta")}
        {text("origin", "Origine", "Es. Le Terre Cineree")}
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="label">Note (equipaggiamento, incantesimi, storia…)</span>
        <textarea name="notes" rows={6} defaultValue={c?.notes ?? ""} className="field resize-y" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Salva scheda</SubmitButton>
        {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
        {state.ok && <p className="text-sm font-bold text-place">{state.message}</p>}
      </div>
    </form>
  );
}
