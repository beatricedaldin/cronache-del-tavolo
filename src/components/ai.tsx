"use client";

import { useActionState, useState } from "react";
import { askAboutAction, generateRecapAction, type AskState, type RecapState } from "@/app/ai-actions";
import type { Recap } from "@/lib/data/ai";
import type { TagKind } from "@/lib/tags";
import { EntryBody } from "./entry-body";

function Disclaimer() {
  return <p className="text-xs text-muted">✨ Scritto da Gemini a partire da quello che puoi leggere tu. Può sbagliare: il diario resta la fonte.</p>;
}

/** «La scorsa volta…»: riassunto personale dell'ultima sessione, da leggere a casa prima di giocare. */
export function RecapCard({ campaignId, session, initial }: { campaignId: string; session: number; initial: Recap | null }) {
  const [state, action, pending] = useActionState<RecapState>(generateRecapAction.bind(null, campaignId), { recap: initial ?? undefined });
  const recap = state.recap && state.recap.sessionNumber === session ? state.recap : null;
  // Aperto all'inizio solo se non c'è ancora un riassunto; poi lo decide chi legge
  // (se dipendesse da `recap`, si richiuderebbe proprio appena il riassunto arriva).
  const [startOpen] = useState(!initial);

  return (
    <details className="panel group border-gold" open={startOpen}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xl font-bold">✨ La scorsa volta… <span className="session align-middle">S{session}</span></span>
        <span className="text-sm text-muted group-open:hidden">{recap ? "Apri il riassunto" : ""}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {recap ? (
          <>
            <EntryBody body={recap.content} campaignId={campaignId} markers={false} />
            <Disclaimer />
          </>
        ) : (
          <p className="text-sm text-muted">
            Prima della prossima sessione, fatti raccontare cosa è successo nella sessione {session}: un riassunto scritto apposta per te dalle note che puoi
            leggere.
          </p>
        )}
        <form action={action} className="flex flex-wrap items-center gap-3">
          <button type="submit" className={recap ? "btn-ghost" : "btn"} disabled={pending}>
            {pending ? "Sto scrivendo…" : recap ? "Rigenera" : "Scrivi il riassunto"}
          </button>
          {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
        </form>
      </div>
    </details>
  );
}

/** «Cosa so di Velia?»: riepilogo di tutto quello che l'utente può leggere su un personaggio o luogo. */
export function AskAbout({ campaignId, kind, slug, name }: { campaignId: string; kind: TagKind; slug: string; name: string }) {
  const [state, action, pending] = useActionState<AskState>(() => askAboutAction(campaignId, kind, slug), {});
  return (
    <section className="panel flex flex-col gap-3">
      <form action={action}>
        <button type="submit" className="btn w-full" disabled={pending}>
          {pending ? "Raccolgo le note…" : `✨ Cosa so di ${name}?`}
        </button>
      </form>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
      {state.text && (
        <>
          <EntryBody body={state.text} campaignId={campaignId} markers={false} />
          <Disclaimer />
        </>
      )}
    </section>
  );
}
