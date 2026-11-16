"use client";

import { useActionState } from "react";
import { addThreadAction } from "@/app/actions/diary";
import type { FormState } from "@/lib/form";
import type { ThreadKind } from "@/lib/data/types";
import { SubmitButton } from "./submit-button";

/** Aggiungere a mano un filo o un obiettivo, senza passare dal diario. */
export function ThreadForm({ campaignId, kind, session }: { campaignId: string; kind: ThreadKind; session: number }) {
  const [state, action] = useActionState<FormState, FormData>(addThreadAction.bind(null, campaignId), {});
  const goal = kind === "goal";
  return (
    <form key={state.at} action={action} className="flex flex-col gap-2 border-b border-line pb-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="session" value={session} />
      <div className="flex gap-2">
        <input
          name="text"
          required
          maxLength={300}
          defaultValue={state.values?.text}
          className="field"
          placeholder={goal ? "Es. Ritrovare la bussola di @Velia" : "Es. Chi ha rubato la bussola?"}
          aria-label={goal ? "Nuovo obiettivo" : "Nuovo filo in sospeso"}
        />
        <SubmitButton className="btn-ghost shrink-0">Aggiungi</SubmitButton>
      </div>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}
