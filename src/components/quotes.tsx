"use client";

import { useActionState, useState } from "react";
import { addQuoteAction, deleteQuoteAction, updateQuoteAction, type FormState } from "@/app/actions";
import type { Quote } from "@/lib/data/quotes";
import { formatDay } from "@/lib/dates";
import { DateField } from "./date-field";
import { RichInline } from "./entry-body";
import { SubmitButton } from "./submit-button";
import { TagTextarea } from "./tag-textarea";
import { ConfirmForm } from "./confirm-form";

type Values = Partial<Record<"speaker" | "text" | "context" | "session" | "date", string>>;

function QuoteFields({ campaignId, values, defaultSession }: { campaignId: string; values: Values; defaultSession: number }) {
  return (
    <>
      <TagTextarea
        campaignId={campaignId}
        name="text"
        required
        rows={2}
        maxLength={1000}
        defaultValue={values.text}
        className="field resize-y font-display text-lg italic"
        placeholder="«Non toccate la bussola!»"
        aria-label="La frase"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          name="speaker"
          required
          maxLength={80}
          defaultValue={values.speaker}
          className="field"
          placeholder="Chi l'ha detta? Es. @[Mastro Odo] o Kael"
          aria-label="Chi l'ha detta"
        />
        <input
          name="context"
          maxLength={300}
          defaultValue={values.context}
          className="field"
          placeholder="Contesto (facoltativo)"
          aria-label="Contesto"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Sessione
          <input
            name="session"
            type="number"
            min={1}
            defaultValue={values.session ?? String(defaultSession)}
            className="field w-20 py-1.5"
          />
        </label>
        <DateField defaultValue={values.date} />
      </div>
    </>
  );
}

export function QuoteForm({ campaignId, defaultSession }: { campaignId: string; defaultSession: number }) {
  const [state, action] = useActionState<FormState, FormData>(addQuoteAction.bind(null, campaignId), {});
  return (
    <form key={state.at} action={action} className="panel flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">Trascrivi una frase</h2>
      <QuoteFields campaignId={campaignId} values={state.values ?? {}} defaultSession={defaultSession} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Salva la frase</SubmitButton>
        <span className="text-xs text-muted">🌍 Le frasi memorabili le vedono tutti al tavolo.</span>
      </div>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}

export function QuoteCard({
  campaignId,
  quote,
  mine,
  canDelete,
}: {
  campaignId: string;
  quote: Quote;
  mine: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await updateQuoteAction(campaignId, quote.id, prev, fd);
    if (r.ok) setEditing(false);
    return r;
  }, {});

  if (editing) {
    return (
      <form action={action} className="panel flex flex-col gap-3">
        <QuoteFields
          campaignId={campaignId}
          values={{
            speaker: quote.speaker,
            text: quote.text,
            context: quote.context,
            session: quote.sessionNumber ? String(quote.sessionNumber) : "",
            date: quote.date,
          }}
          defaultSession={quote.sessionNumber ?? 1}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className="btn-ghost">Salva</SubmitButton>
          <button type="button" className="text-sm font-bold text-muted" onClick={() => setEditing(false)}>
            Annulla
          </button>
          {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
        </div>
      </form>
    );
  }

  return (
    <figure className="panel flex flex-col gap-3">
      <blockquote className="font-display text-xl leading-snug">
        «<RichInline text={quote.text} campaignId={campaignId} />»
      </blockquote>
      <figcaption className="flex flex-col gap-0.5 text-sm">
        <span className="font-bold">
          — <RichInline text={quote.speaker} campaignId={campaignId} />
          {quote.sessionNumber && <span className="session ml-2">S{quote.sessionNumber}</span>}
        </span>
        {quote.context && <span className="italic text-muted">{quote.context}</span>}
        <span className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            Trascritta da {mine ? "te" : quote.authorName} · {formatDay(quote.date)}
          </span>
          {mine && (
            <button type="button" className="font-bold hover:text-accent" onClick={() => setEditing(true)}>
              Modifica
            </button>
          )}
          {canDelete && (
            <ConfirmForm
              action={deleteQuoteAction.bind(null, campaignId, quote.id)}
              confirmMessage="Togliere questa frase?"
              className="font-bold hover:text-danger"
            >
              Elimina
            </ConfirmForm>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
