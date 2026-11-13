"use client";

import { useActionState } from "react";
import { saveCardAction, type FormState } from "@/app/actions";
import type { EntityCard } from "@/lib/data/types";
import type { TagKind } from "@/lib/tags";
import { SubmitButton } from "./submit-button";
import { TagTextarea } from "./tag-textarea";

/** Solo per il Master: la scheda pubblica di un personaggio o luogo, che vedono tutti. */
export function CardEditor({
  campaignId,
  kind,
  slug,
  name,
  card,
}: {
  campaignId: string;
  kind: TagKind;
  slug: string;
  name: string;
  card: EntityCard | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCardAction.bind(null, campaignId, kind, slug), {});
  return (
    <details className="rounded-xl border border-dashed border-gold p-4" open={!card}>
      <summary className="label cursor-pointer text-gold">👑 {card ? "Modifica la scheda pubblica" : "Scrivi la scheda pubblica"}</summary>
      <p className="mt-2 text-sm text-muted">Nome e descrizione li vedono tutti i giocatori della campagna. L&apos;immagine la può caricare chiunque.</p>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label">Nome</span>
          <input name="name" required maxLength={80} defaultValue={card?.name ?? name} className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Descrizione</span>
          <TagTextarea
            campaignId={campaignId}
            name="description"
            rows={5}
            maxLength={5000}
            defaultValue={card?.description ?? ""}
            className="field resize-y"
            placeholder="Quello che i giocatori sanno (o possono sapere)…"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>Salva e mostra a tutti</SubmitButton>
          {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
          {state.ok && <span className="text-sm font-bold text-place">{state.message}</span>}
        </div>
      </form>
    </details>
  );
}
