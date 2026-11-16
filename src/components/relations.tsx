"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addRelationAction, deleteRelationAction } from "@/app/actions/compendium";
import type { FormState } from "@/lib/form";
import type { EntityRelation } from "@/lib/data/types";
import type { TagKind } from "@/lib/tags";
import { VisibilityToggle } from "./composer";
import { SubmitButton } from "./submit-button";
import { ConfirmForm } from "./confirm-form";

const LABELS = [
  "sorella di", "fratello di", "figlia di", "figlio di", "madre di", "padre di",
  "alleato di", "nemico di", "rivale di", "amico di", "innamorato di", "maestro di", "allievo di",
  "lavora per", "comanda", "membro di", "fondatore di", "vive a", "viene da", "nasconde qualcosa a", "debitore di",
];

function EntityChip({ campaignId, kind, slug, name }: { campaignId: string; kind: TagKind; slug: string; name: string }) {
  return (
    <Link
      href={`/c/${campaignId}/compendio/${kind}/${slug}`}
      className={`rounded-md px-1.5 font-bold hover:underline ${kind === "npc" ? "bg-npc-bg text-npc" : "bg-place-bg text-place"}`}
    >
      {kind === "place" ? "⌖ " : ""}
      {name}
    </Link>
  );
}

export function RelationList({
  campaignId,
  self,
  relations,
  currentUserId,
  showAuthor,
}: {
  campaignId: string;
  self: { kind: TagKind; slug: string; name: string };
  relations: EntityRelation[];
  currentUserId: string;
  showAuthor: boolean;
}) {
  if (relations.length === 0) return <p className="text-sm italic text-muted">Nessuna relazione ancora.</p>;
  return (
    <ul className="flex flex-col">
      {relations.map((r) => {
        const mine = r.ownerId === currentUserId;
        const me = <b>{self.name}</b>;
        const other = <EntityChip campaignId={campaignId} {...r.other} />;
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dashed border-line py-2 text-sm first:border-t-0">
            <span className="flex flex-wrap items-center gap-1.5">
              {r.direction === "out" ? me : other}
              <span className="text-muted">→ {r.label} →</span>
              {r.direction === "out" ? other : me}
            </span>
            <span className="ml-auto flex items-center gap-2 text-xs text-muted">
              {(showAuthor || !mine) && <span>{mine ? "tu" : r.ownerName}</span>}
              <span title={r.isPublic ? "La vedono tutti" : "La vedete solo tu e il Master"}>{r.isPublic ? "🌍" : "🔒"}</span>
              {mine && (
                <ConfirmForm
                  action={deleteRelationAction.bind(null, campaignId, r.id)}
                  confirmMessage="Togliere questa relazione?"
                  className="font-bold hover:text-danger"
                  label="Togli relazione"
                >
                  ✕
                </ConfirmForm>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function RelationForm({
  campaignId,
  self,
  names,
}: {
  campaignId: string;
  self: { kind: TagKind; slug: string; name: string };
  names: { kind: TagKind; name: string }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(addRelationAction.bind(null, campaignId, self.kind, self.slug, self.name), {});
  const v = state.values ?? {};
  const others = names.filter((n) => n.name.toLocaleLowerCase("it") !== self.name.toLocaleLowerCase("it"));
  const listId = `rel-names-${self.kind}-${self.slug}`;

  return (
    <form key={state.at} action={action} className="flex flex-col gap-2 border-t border-line pt-3">
      <h4 className="label">Nuova relazione</h4>
      <datalist id={`${listId}-labels`}>
        {LABELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <datalist id={listId}>
        {others.map((n) => (
          <option key={`${n.kind}:${n.name}`} value={n.name}>
            {n.kind === "npc" ? "Personaggio" : "Luogo"}
          </option>
        ))}
      </datalist>
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        <span className="self-center text-sm font-bold">{self.name} →</span>
        <input name="label" required maxLength={60} defaultValue={v.label} list={`${listId}-labels`} className="field" placeholder="sorella di, lavora per, vive a…" aria-label="Relazione" />
        <select name="toKind" defaultValue={v.toKind ?? "npc"} className="field" aria-label="Tipo">
          <option value="npc">Personaggio</option>
          <option value="place">Luogo / fazione</option>
        </select>
        <input name="toName" required maxLength={80} defaultValue={v.toName} list={listId} className="field" placeholder="Es. Mastro Odo" aria-label="Con chi o cosa" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VisibilityToggle defaultChecked={v.public === "on"} />
        <SubmitButton className="btn-ghost">Aggiungi relazione</SubmitButton>
      </div>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}
