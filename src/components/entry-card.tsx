"use client";

import { useActionState, useState } from "react";
import { deleteEntryAction, updateEntryAction, type FormState } from "@/app/actions";
import type { Entry } from "@/lib/data/types";
import { VisibilityToggle } from "./composer";
import { formatDay } from "@/lib/dates";
import { DateField } from "./date-field";
import { EntryBody } from "./entry-body";
import { SubmitButton } from "./submit-button";
import { TagTextarea } from "./tag-textarea";

export function EntryCard({
  entry,
  campaignId,
  currentUserId,
  showAuthor,
}: {
  entry: Entry;
  campaignId: string;
  currentUserId: string;
  /** Il Master vede sempre l'autore; un giocatore lo vede sulle voci pubbliche degli altri. */
  showAuthor: boolean;
}) {
  const mine = entry.authorId === currentUserId;
  const [editing, setEditing] = useState(false);
  const date = formatDay(entry.date);

  return (
    <article className="flex flex-col gap-2 border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="session">S{entry.sessionNumber}</span>
        {(showAuthor || !mine) && <span className="font-extrabold text-ink">{mine ? "Tu" : entry.authorName}</span>}
        <span>{date}</span>
        <span
          className={`rounded-full px-2 text-xs font-bold ${entry.isPublic ? "bg-place-bg text-place" : "bg-panel-2 text-muted"}`}
          title={entry.isPublic ? "La vedono tutti i membri della campagna" : "La vedete solo tu e il Master"}
        >
          {entry.isPublic ? "🌍 pubblica" : "🔒 privata"}
        </span>
        {entry.updatedAt && <span className="text-xs italic">modificata</span>}
        {mine && !editing && (
          <span className="ml-auto flex gap-3">
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold hover:text-accent">
              Modifica
            </button>
            <form
              action={deleteEntryAction.bind(null, campaignId, entry.id)}
              onSubmit={(e) => {
                if (!confirm("Eliminare questa voce? I suoi fili e obiettivi restano nella pagina dei fili.")) e.preventDefault();
              }}
            >
              <button className="text-xs font-bold hover:text-danger" type="submit">
                Elimina
              </button>
            </form>
          </span>
        )}
      </div>
      {editing ? (
        <EditEntry campaignId={campaignId} entry={entry} onDone={() => setEditing(false)} />
      ) : (
        <EntryBody body={entry.body} campaignId={campaignId} />
      )}
    </article>
  );
}

function EditEntry({ campaignId, entry, onDone }: { campaignId: string; entry: Entry; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await updateEntryAction(campaignId, entry.id, prev, fd);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <TagTextarea
        campaignId={campaignId}
        name="body"
        required
        rows={6}
        defaultValue={entry.body}
        className="field min-h-36 resize-y leading-relaxed"
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Sessione
          <input name="session" type="number" min={1} defaultValue={entry.sessionNumber} className="field w-20 py-1.5" />
        </label>
        <DateField defaultValue={entry.date} />
        <VisibilityToggle defaultChecked={entry.isPublic} />
      </div>
      <p className="text-xs text-muted">
        Citazioni, fili e obiettivi si aggiornano col testo. I fili e gli obiettivi già chiusi restano dove sono.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Salva modifiche</SubmitButton>
        <button type="button" onClick={onDone} className="btn-ghost">
          Annulla
        </button>
        {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
