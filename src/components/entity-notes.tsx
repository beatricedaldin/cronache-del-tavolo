"use client";

import { useActionState, useState } from "react";
import { addNoteAction, deleteNoteAction, updateNoteAction } from "@/app/actions/compendium";
import type { FormState } from "@/lib/form";
import type { EntityNote } from "@/lib/data/types";
import type { TagKind } from "@/lib/tags";
import { VisibilityToggle } from "./composer";
import { EntryBody } from "./entry-body";
import { formatDay } from "@/lib/dates";
import { DateField } from "./date-field";
import { SubmitButton } from "./submit-button";
import { TagTextarea } from "./tag-textarea";
import { ConfirmForm } from "./confirm-form";

export function NoteForm({ campaignId, kind, slug, name }: { campaignId: string; kind: TagKind; slug: string; name: string }) {
  const [state, action] = useActionState<FormState, FormData>(addNoteAction.bind(null, campaignId, kind, slug, name), {});
  return (
    <form key={state.at} action={action} className="flex flex-col gap-3">
      <TagTextarea
        campaignId={campaignId}
        name="body"
        required
        rows={3}
        maxLength={5000}
        defaultValue={state.values?.body}
        className="field resize-y"
        placeholder={`Cosa sai o pensi di ${name}?`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DateField defaultValue={state.values?.date} />
          <VisibilityToggle defaultChecked={state.values?.public === "on"} />
        </div>
        <SubmitButton className="btn-ghost">Aggiungi nota</SubmitButton>
      </div>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}

export function NoteItem({
  campaignId,
  note,
  mine,
  showAuthor,
}: {
  campaignId: string;
  note: EntityNote;
  mine: boolean;
  showAuthor: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await updateNoteAction(campaignId, note.id, prev, fd);
    if (r.ok) setEditing(false);
    return r;
  }, {});

  return (
    <li className="flex flex-col gap-1.5 border-t border-dashed border-line py-3 first:border-t-0">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {(showAuthor || !mine) && <b className="text-sm text-ink">{mine ? "Tu" : note.ownerName}</b>}
        <span>{formatDay(note.date)}</span>
        <span className={`rounded-full px-2 font-bold ${note.isPublic ? "bg-place-bg text-place" : "bg-panel-2"}`}>
          {note.isPublic ? "🌍 pubblica" : "🔒 privata"}
        </span>
        {mine && !editing && (
          <span className="ml-auto flex gap-3">
            <button type="button" className="font-bold hover:text-accent" onClick={() => setEditing(true)}>
              Modifica
            </button>
            <ConfirmForm
              action={deleteNoteAction.bind(null, campaignId, note.id)}
              confirmMessage="Eliminare la nota?"
              className="font-bold hover:text-danger"
            >
              Elimina
            </ConfirmForm>
          </span>
        )}
      </p>
      {editing ? (
        <form action={action} className="flex flex-col gap-2">
          <TagTextarea
            campaignId={campaignId}
            name="body"
            required
            rows={3}
            maxLength={5000}
            defaultValue={note.body}
            className="field resize-y"
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-3">
            <DateField defaultValue={note.date} />
            <VisibilityToggle defaultChecked={note.isPublic} />
            <SubmitButton className="btn-ghost">Salva</SubmitButton>
            <button type="button" className="text-sm font-bold text-muted" onClick={() => setEditing(false)}>
              Annulla
            </button>
            {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
          </div>
        </form>
      ) : (
        <EntryBody body={note.body} campaignId={campaignId} markers={false} />
      )}
    </li>
  );
}
