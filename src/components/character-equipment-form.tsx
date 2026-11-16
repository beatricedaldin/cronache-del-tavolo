"use client";

import { useActionState, useState, type ReactNode } from "react";
import { acquireCharacterEquipmentAction } from "@/app/actions/character";
import type { FormState } from "@/lib/form";
import {
  EQUIPMENT_ACQUISITIONS,
  EQUIPMENT_SLOTS,
} from "@/lib/fabula";
import { todayISO } from "@/lib/dates";
import { SubmitButton } from "./submit-button";

export function CharacterEquipmentForm({
  campaignId,
  characterId,
  defaultSession,
  personalZenit,
}: {
  campaignId: string;
  characterId: string;
  defaultSession: number;
  personalZenit: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    acquireCharacterEquipmentAction.bind(null, campaignId, characterId),
    {},
  );
  const [acquisition, setAcquisition] = useState("");

  return (
    <section className="panel flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">Nuovo oggetto</h2>
      <p className="text-sm text-muted">
        Registra a casa ciò che hai comprato, trovato o ricevuto. Gli acquisti vengono addebitati ai tuoi Zenit personali.
      </p>
      <p className="text-sm">
        Zenit personali: <b>{personalZenit.toLocaleString("it-IT")}</b>
      </p>
      <form key={state.at} action={action} className="flex flex-col gap-3">
        <Field label="Oggetto">
          <input name="name" required maxLength={80} className="field" placeholder="Es. Amuleto d'ambra" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tipo">
            <select name="slot" defaultValue="altro" className="field">
              {EQUIPMENT_SLOTS.map((slot) => <option key={slot.key} value={slot.key}>{slot.label}</option>)}
            </select>
          </Field>
          <Field label="Quantità">
            <input name="quantity" type="number" min={1} max={999} step={1} defaultValue={1} className="field" />
          </Field>
        </div>
        <Field label="Come lo hai ottenuto?">
          <select
            name="acquisition"
            value={acquisition}
            onChange={(event) => setAcquisition(event.target.value)}
            required
            className="field"
          >
            <option value="">Scegli</option>
            {EQUIPMENT_ACQUISITIONS.filter((item) => item.key !== "starting" && item.key !== "unknown").map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </Field>
        {acquisition === "purchase" && (
          <>
            <Field label="Costo totale in Zenit">
              <input name="cost" type="number" min={1} max={9_999_999} step={1} required className="field" />
            </Field>
            <input type="hidden" name="paymentSource" value="personal" />
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Sessione">
            <input name="session" type="number" min={1} max={999} defaultValue={defaultSession} className="field" />
          </Field>
          <Field label="Data">
            <input name="date" type="date" defaultValue={todayISO()} className="field" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumberField name="defense" label="Dif." />
          <NumberField name="magicDefense" label="D. Mag." />
          <NumberField name="initiative" label="Iniz." />
        </div>
        <Field label="Promemoria">
          <textarea name="summary" maxLength={2000} rows={2} className="field resize-y" placeholder="Origine, effetto o dettaglio da ricordare" />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className="btn-ghost">Registra oggetto</SubmitButton>
          {state.error && <p role="alert" className="text-sm font-bold text-danger">{state.error}</p>}
          {state.ok && <p role="status" className="text-sm font-bold text-place">{state.message}</p>}
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5"><span className="label">{label}</span>{children}</label>;
}

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <Field label={label}>
      <input name={name} type="number" min={-10} max={20} step={1} defaultValue={0} className="field" />
    </Field>
  );
}
