"use client";

import { useActionState } from "react";
import { createCardAction, type FormState } from "@/app/actions";
import { SubmitButton } from "./submit-button";

/** Il Master aggiunge al compendio un personaggio o un luogo che nessuno ha ancora citato. */
export function NewCardForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState<FormState, FormData>(createCardAction.bind(null, campaignId), {});
  return (
    <form action={action} className="panel flex flex-col gap-3 border-dashed border-gold">
      <h2 className="label text-gold">👑 Aggiungi al compendio</h2>
      <div className="flex flex-wrap gap-2">
        <select name="kind" className="field w-auto" aria-label="Tipo">
          <option value="npc">Personaggio</option>
          <option value="place">Luogo / fazione</option>
        </select>
        <input name="name" required maxLength={80} className="field min-w-48 flex-1" placeholder="Nome" aria-label="Nome" />
        <SubmitButton className="btn-ghost">Crea</SubmitButton>
      </div>
      <p className="text-xs text-muted">Lo vedranno tutti. Poi potrai aggiungere descrizione e immagine.</p>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}
