"use client";

import { useActionState, useState } from "react";
import {
  addItemAction,
  addLedgerAction,
  deleteItemAction,
  deleteLedgerAction,
  updateItemAction,
  type FormState,
} from "@/app/actions";
import type { LedgerEntry, PartyItem } from "@/lib/data/party";
import { formatDay } from "@/lib/dates";
import { DateField } from "./date-field";
import { RichInline } from "./entry-body";
import { SubmitButton } from "./submit-button";

const zenit = (n: number) => n.toLocaleString("it-IT");

// --- Cassa ----------------------------------------------------------------------

export function LedgerForm({ campaignId, defaultSession }: { campaignId: string; defaultSession: number }) {
  const [state, action] = useActionState<FormState, FormData>(addLedgerAction.bind(null, campaignId), {});
  const v = state.values ?? {};
  return (
    <form key={state.at} action={action} className="flex flex-col gap-2 border-b border-line pb-4">
      <div className="flex flex-wrap gap-2">
        <select name="direction" defaultValue={v.direction || "in"} className="field w-auto" aria-label="Entrata o uscita">
          <option value="in">+ Entrata</option>
          <option value="out">− Uscita</option>
        </select>
        <input
          name="amount"
          type="number"
          min={1}
          required
          defaultValue={v.amount}
          inputMode="numeric"
          className="field w-32"
          placeholder="Zenit"
          aria-label="Zenit"
        />
        <input name="reason" required maxLength={200} defaultValue={v.reason} className="field min-w-48 flex-1" placeholder="Motivo: ricompensa, pozioni, locanda…" aria-label="Motivo" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Sessione
          <input name="session" type="number" min={1} defaultValue={v.session || String(defaultSession)} className="field w-20 py-1.5" />
        </label>
        <DateField defaultValue={v.date} />
        <SubmitButton className="btn-ghost">Registra</SubmitButton>
      </div>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}

export function LedgerRow({ campaignId, entry, canDelete }: { campaignId: string; entry: LedgerEntry; canDelete: boolean }) {
  return (
    <li className="flex items-baseline gap-3 border-t border-dashed border-line py-2 first:border-t-0">
      <span className={`w-24 shrink-0 text-right font-mono font-bold ${entry.amount > 0 ? "text-place" : "text-danger"}`}>
        {entry.amount > 0 ? "+" : "−"}
        {zenit(Math.abs(entry.amount))}
      </span>
      <span className="min-w-0 flex-1">
        {entry.reason}
        <span className="block text-xs text-muted">
          {entry.sessionNumber && <span className="session mr-1">S{entry.sessionNumber}</span>}
          {formatDay(entry.date)} · {entry.authorName}
        </span>
      </span>
      {canDelete && (
        <form
          action={deleteLedgerAction.bind(null, campaignId, entry.id)}
          onSubmit={(e) => {
            if (!confirm("Togliere questo movimento?")) e.preventDefault();
          }}
        >
          <button type="submit" className="text-xs font-bold text-muted hover:text-danger" aria-label="Togli movimento">
            ✕
          </button>
        </form>
      )}
    </li>
  );
}

// --- Inventario -------------------------------------------------------------------

function ItemFields({ item }: { item?: PartyItem }) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_90px_minmax(0,1fr)]">
        <input name="name" required maxLength={100} defaultValue={item?.name} className="field" placeholder="Es. Bussola d'ottone" aria-label="Oggetto" />
        <input name="quantity" type="number" min={0} defaultValue={item?.quantity ?? 1} className="field" aria-label="Quantità" title="Quantità" />
        <input name="holder" maxLength={80} defaultValue={item?.holder} className="field" placeholder="Chi lo porta?" aria-label="Chi lo porta" />
      </div>
      <textarea
        name="description"
        rows={2}
        maxLength={1000}
        defaultValue={item?.description}
        className="field resize-y text-sm"
        placeholder="Cos'è, da dove viene, a cosa serve (facoltativo)"
      />
    </>
  );
}

export function ItemForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState<FormState, FormData>(addItemAction.bind(null, campaignId), {});
  return (
    <form key={state.at} action={action} className="flex flex-col gap-2 border-b border-line pb-4">
      <ItemFields />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn-ghost">Aggiungi all&apos;inventario</SubmitButton>
        {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

export function ItemCard({ campaignId, item, canDelete }: { campaignId: string; item: PartyItem; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await updateItemAction(campaignId, item.id, prev, fd);
    if (r.ok) setEditing(false);
    return r;
  }, {});

  if (editing) {
    return (
      <li className="rounded-xl border border-line bg-panel-2 p-3">
        <form action={action} className="flex flex-col gap-2">
          <ItemFields item={item} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="gone" defaultChecked={item.gone} className="accent-accent" />
            Non c&apos;è più (perso, usato, venduto…)
          </label>
          <input name="goneNote" maxLength={200} defaultValue={item.goneNote} className="field text-sm" placeholder="Com'è andata? (facoltativo)" />
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className="btn-ghost">Salva</SubmitButton>
            <button type="button" className="text-sm font-bold text-muted" onClick={() => setEditing(false)}>
              Annulla
            </button>
            {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`flex flex-col gap-1 border-t border-dashed border-line py-3 first:border-t-0 ${item.gone ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <b className={item.gone ? "line-through" : ""}>{item.name}</b>
        {item.quantity !== 1 && <span className="session">×{item.quantity}</span>}
        {item.holder && <span className="text-sm text-muted">· lo porta {item.holder}</span>}
        <span className="ml-auto flex gap-3 text-xs font-bold text-muted">
          <button type="button" className="hover:text-accent" onClick={() => setEditing(true)}>
            Modifica
          </button>
          {canDelete && (
            <form
              action={deleteItemAction.bind(null, campaignId, item.id)}
              onSubmit={(e) => {
                if (!confirm(`Togliere «${item.name}» dall'inventario? Se è stato perso o usato, meglio segnarlo come «non c'è più».`)) e.preventDefault();
              }}
            >
              <button type="submit" className="hover:text-danger">
                Elimina
              </button>
            </form>
          )}
        </span>
      </div>
      {item.description && (
        <p className="text-sm text-muted">
          <RichInline text={item.description} campaignId={campaignId} />
        </p>
      )}
      {item.gone && item.goneNote && <p className="text-xs italic text-muted">{item.goneNote}</p>}
    </li>
  );
}
