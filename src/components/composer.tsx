"use client";

import { useActionState, useRef } from "react";
import { createEntryAction, type FormState } from "@/app/actions";
import { tagSyntax, type TagKind } from "@/lib/tags";
import { DateField } from "./date-field";
import { SubmitButton } from "./submit-button";

export function Composer({
  campaignId,
  defaultSession,
  suggestions,
}: {
  campaignId: string;
  defaultSession: number;
  suggestions: { kind: TagKind; name: string }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(createEntryAction.bind(null, campaignId), {});
  const textRef = useRef<HTMLTextAreaElement>(null);

  function insert(kind: TagKind, name: string) {
    const ta = textRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, pos);
    const token = `${before && !/\s$/.test(before) ? " " : ""}${tagSyntax(kind, name)} `;
    ta.value = before + token + ta.value.slice(pos);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = pos + token.length;
  }

  return (
    <form action={action} className="panel flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Diario di fine sessione</h2>
        <div className="flex flex-wrap items-center gap-3">
        <DateField key={`d${state.at ?? 0}`} defaultValue={state.values?.date} />
        <label className="flex items-center gap-2 text-sm text-muted">
          Sessione
          <input
            name="session"
            type="number"
            min={1}
            key={`s${state.at ?? 0}`}
            defaultValue={state.values?.session ?? defaultSession}
            className="field w-20 py-1.5"
            aria-label="Numero di sessione"
          />
        </label>
        </div>
      </div>

      <textarea
        ref={textRef}
        key={`b${state.at ?? 0}`}
        defaultValue={state.values?.body ?? ""}
        name="body"
        rows={6}
        required
        className="field min-h-36 resize-y leading-relaxed"
        placeholder={"Cosa è successo stasera? Es.\n@Velia ci ha portati a #[Isola di Brina].\n? Chi ha rubato la bussola?\n! Ritrovare la bussola prima della luna nuova"}
      />

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={`${s.kind}:${s.name}`}
              type="button"
              onClick={() => insert(s.kind, s.name)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-0.5 text-sm font-bold hover:border-accent"
            >
              <span className={`size-2 rounded-full ${s.kind === "npc" ? "bg-npc" : "bg-place"}`} />
              {s.name}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-muted lg:hidden">
        <code className="font-mono text-xs">@Nome</code> personaggio · <code className="font-mono text-xs">#Luogo</code> luogo ·{" "}
        <code className="font-mono text-xs">@[Due parole]</code> nomi lunghi · riga con <code className="font-mono text-xs">?</code>{" "}
        filo · riga con <code className="font-mono text-xs">!</code> obiettivo
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <VisibilityToggle key={`p${state.at ?? 0}`} defaultChecked={state.values?.public === "on"} />
        <SubmitButton>Salva nel diario</SubmitButton>
      </div>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}

/** Privata (default) o pubblica. Usato da diario e note del compendio. */
export function VisibilityToggle({ defaultChecked = false, name = "public" }: { defaultChecked?: boolean; name?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer size-4 accent-accent" />
      <span className="peer-checked:hidden">
        🔒 <b>Privata</b> <span className="text-muted">· la vedete tu e il Master</span>
      </span>
      <span className="hidden peer-checked:inline">
        🌍 <b>Pubblica</b> <span className="text-muted">· la vedono tutti</span>
      </span>
    </label>
  );
}
