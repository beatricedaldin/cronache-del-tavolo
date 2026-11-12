"use client";

import { useActionState } from "react";
import { addBondAction, deleteBondAction, updateBondAction, type FormState } from "@/app/actions";
import type { Bond } from "@/lib/data/types";
import { bondStrength, EMOTION_PAIRS, RULES } from "@/lib/fabula";
import { SubmitButton } from "./submit-button";

export function BondEditor({ campaignId, characterId, bonds }: { campaignId: string; characterId: string; bonds: Bond[] }) {
  return (
    <section className="panel flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-bold">Legami</h2>
        <p className="text-sm text-muted">
          Al massimo {RULES.maxBonds}. Un&apos;emozione per coppia: la forza del Legame è il numero di emozioni.
        </p>
      </div>
      {bonds.length === 0 && <p className="text-sm italic text-muted">Nessun legame ancora.</p>}
      {bonds.map((b) => (
        <EditBond key={`${b.id}-${b.emotions.join()}`} campaignId={campaignId} bond={b} />
      ))}
      {bonds.length < RULES.maxBonds ? (
        <AddBond campaignId={campaignId} characterId={characterId} />
      ) : (
        <p className="text-sm text-muted">Hai già {RULES.maxBonds} Legami: per crearne uno nuovo devi rinunciare a uno esistente.</p>
      )}
    </section>
  );
}

function EditBond({ campaignId, bond }: { campaignId: string; bond: Bond }) {
  const [state, action] = useActionState<FormState, FormData>(updateBondAction.bind(null, campaignId, bond.id), {});
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <b className="text-lg">{bond.target}</b>
        <span className="label">Forza {bondStrength(bond.emotions)}</span>
      </div>
      <EmotionPicker selected={bond.emotions} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn-ghost">Aggiorna emozioni</SubmitButton>
        <button
          type="submit"
          formAction={deleteBondAction.bind(null, campaignId, bond.id)}
          className="text-sm font-bold text-muted hover:text-danger"
          onClick={(e) => {
            if (!confirm(`Rimuovere il legame con ${bond.target}?`)) e.preventDefault();
          }}
        >
          Rimuovi
        </button>
        {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

function AddBond({ campaignId, characterId }: { campaignId: string; characterId: string }) {
  const [state, action] = useActionState<FormState, FormData>(addBondAction.bind(null, campaignId, characterId), {});
  return (
    <form key={state.at} action={action} className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="label">Nuovo legame</h3>
      <input
        name="target"
        required
        defaultValue={state.values?.target}
        className="field"
        placeholder="Verso chi o cosa? Es. Velia, il Culto del Sole"
        aria-label="Verso chi"
      />
      <EmotionPicker selected={[]} />
      <SubmitButton className="btn-ghost self-start">Aggiungi legame</SubmitButton>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}

/** Tre coppie di emozioni: per ciascuna "nessuna" oppure una delle due. */
function EmotionPicker({ selected }: { selected: string[] }) {
  return (
    <fieldset className="grid gap-1.5 text-sm sm:grid-cols-3">
      <legend className="sr-only">Emozioni</legend>
      {EMOTION_PAIRS.map((pair, i) => {
        const current = pair.find((e) => selected.includes(e)) ?? "";
        return (
          <div key={i} className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-dashed border-line px-2 py-1.5">
            {pair.map((e) => (
              <label key={e} className="flex items-center gap-1.5">
                <input type="radio" name={`pair${i}`} value={e} defaultChecked={current === e} className="accent-accent" />
                {e}
              </label>
            ))}
            <label className="flex items-center gap-1.5 text-muted">
              <input type="radio" name={`pair${i}`} value="" defaultChecked={current === ""} className="accent-accent" />
              —
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
