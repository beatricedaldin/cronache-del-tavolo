"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { createCharacterAction, type FormState } from "@/app/actions";
import type { CatalogEntry } from "@/lib/fabula-catalog";
import {
  ATTRIBUTES,
  characterCreationErrors,
  DICE,
  derive,
  emptySheet,
  emptyTechnologyOptions,
  EQUIPMENT_SLOTS,
  RULES,
  STARTING_DISTRIBUTIONS,
  type ClassEntry,
  type EquipmentEntry,
  type RitualEntry,
  type Sheet,
  type SkillEntry,
  type SpellEntry,
} from "@/lib/fabula";
import { ManualCatalogPicker } from "./manual-catalog-picker";
import { SubmitButton } from "./submit-button";
import { TechnologyOptionsEditor } from "./technology-options-editor";

type Basics = { name: string; identity: string; theme: string; origin: string; notes: string };
const STEP_NAMES = ["Concept", "Classi", "Caratteristiche", "Abilità e magia", "Equipaggiamento"];

function initialSheet(): Sheet {
  const sheet = emptySheet();
  sheet.classes = [
    { name: "", level: 3, hp: 0, mp: 0, ip: 0 },
    { name: "", level: 2, hp: 0, mp: 0, ip: 0 },
  ];
  return sheet;
}

export function CharacterCreationWizard({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState<FormState, FormData>(createCharacterAction.bind(null, campaignId), {});
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [basics, setBasics] = useState<Basics>({ name: "", identity: "", theme: "", origin: "", notes: "" });
  const [sheet, setSheetState] = useState<Sheet>(initialSheet);
  const [savingsRoll, setSavingsRoll] = useState("");
  const derived = derive(sheet, RULES.startingLevel);
  const spent = sheet.equipment.reduce((sum, item) => sum + item.cost, 0);
  const startingZenit = savingsRoll ? RULES.equipmentBudget - spent + Number(savingsRoll) * 10 : null;

  const setBasic = <K extends keyof Basics>(key: K, value: Basics[K]) =>
    setBasics((current) => ({ ...current, [key]: value }));
  const set = <K extends keyof Sheet>(key: K, value?: Sheet[K]) => {
    if (value === undefined) {
      return (next: Sheet[K]) => setSheetState((current) => ({ ...current, [key]: next }));
    }
    setSheetState((current) => ({ ...current, [key]: value }));
  };
  const addCatalogEntry = (entry: CatalogEntry) => {
    const reference = [entry.summary, `Requisito: ${entry.requirement}`, `Rif.: ${entry.source}, p. ${entry.page}`]
      .filter(Boolean)
      .join(" ");
    if (entry.kind === "skill" || entry.kind === "heroic") {
      set("skills", [...sheet.skills, {
        name: entry.name,
        source: entry.kind === "heroic" ? "Abilità Eroiche" : entry.className,
        level: 1,
        maxRank: entry.kind === "skill" ? entry.maxRank ?? 1 : null,
        heroic: entry.kind === "heroic",
        summary: reference,
        technologyOptions: entry.name.trim().toLocaleLowerCase("it") === "tecnologie"
          ? emptyTechnologyOptions()
          : undefined,
      }]);
    } else {
      set("spells", [...sheet.spells, {
        name: entry.name,
        mp: entry.mp ?? "",
        target: entry.target ?? "",
        duration: entry.duration ?? "",
        offensive: entry.offensive ?? false,
        summary: reference,
      }]);
    }
  };

  function next() {
    setError("");
    if (step === 0) {
      if (![basics.name, basics.identity, basics.theme, basics.origin].every((value) => value.trim())) {
        setError("Completa nome, Identità, Tema e Origine per proseguire.");
        return;
      }
    } else if (step === 1) {
      const classErrors = characterCreationErrors({ ...sheet, equipment: [] }).filter((message) =>
        /Class/i.test(message),
      );
      if (classErrors.length) {
        setError(classErrors[0]);
        return;
      }
    } else if (step === 2) {
      const attributeError = characterCreationErrors({ ...sheet, equipment: [] }).find((message) =>
        message.includes("Caratteristiche"),
      );
      if (attributeError) {
        setError("Assegna una distribuzione iniziale valida di dadi alle Caratteristiche.");
        return;
      }
    } else if (step === 4) {
      const equipmentError = characterCreationErrors(sheet).find((message) => message.includes("equipaggiamento"));
      if (equipmentError) {
        setError(equipmentError);
        return;
      }
      if (!savingsRoll) {
        setError("Inserisci il risultato del tiro 2d6 per i risparmi iniziali.");
        return;
      }
      return;
    }

    setStep((current) => current + 1);
  }

  if (state.ok) {
    return (
      <section className="panel flex flex-col items-start gap-3">
        <h2 className="font-display text-2xl font-bold">Personaggio creato</h2>
        <p className="text-muted">{state.message}</p>
        <Link href={`/c/${campaignId}/scheda`} className="btn">
          Vai alla scheda
        </Link>
      </section>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="name" value={basics.name} />
      <input type="hidden" name="identity" value={basics.identity} />
      <input type="hidden" name="theme" value={basics.theme} />
      <input type="hidden" name="origin" value={basics.origin} />
      <input type="hidden" name="sheet" value={JSON.stringify(sheet)} />
      <input type="hidden" name="savingsRoll" value={savingsRoll} />
      <section className="panel flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Creazione guidata · Livello {RULES.startingLevel}</p>
            <h2 className="font-display text-2xl font-bold">{STEP_NAMES[step]}</h2>
          </div>
          <span className="text-sm font-bold text-muted">Passo {step + 1} di {STEP_NAMES.length}</span>
        </div>
        <ol className="grid grid-cols-5 gap-1" aria-label="Passaggi della creazione">
          {STEP_NAMES.map((name, index) => (
            <li
              key={name}
              aria-current={index === step ? "step" : undefined}
              className={`h-1.5 rounded-full ${index <= step ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </ol>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Parti da chi è il personaggio: questi dettagli ti aiuteranno a interpretarlo e a legarlo al mondo.</p>
            <Field label="Nome del personaggio">
              <input autoFocus aria-label="Nome del PG" value={basics.name} onChange={(event) => setBasic("name", event.target.value)} className="field" placeholder="Es. Kael Senzaterra" />
            </Field>
            <Field label="Identità">
              <input aria-label="Identità" value={basics.identity} onChange={(event) => setBasic("identity", event.target.value)} className="field" placeholder="Come si vede oggi? Es. Mercenario in cerca di riscatto" />
            </Field>
            <Field label="Tema">
              <input aria-label="Tema" value={basics.theme} onChange={(event) => setBasic("theme", event.target.value)} className="field" placeholder="La sua convinzione o conflitto centrale. Es. Speranza" />
            </Field>
            <Field label="Origine">
              <input aria-label="Origine" value={basics.origin} onChange={(event) => setBasic("origin", event.target.value)} className="field" placeholder="Il luogo o la comunità da cui proviene" />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Scegli due o tre Classi e distribuisci tra loro esattamente cinque livelli. Inserisci anche i bonus ai PV, PM e PI che ogni Classe dà al primo livello.
              Usa i nomi e le Abilità del manuale o dell&apos;Atlante scelto.
            </p>
            {sheet.classes.map((entry, index) => (
              <div key={index} className="rounded-xl border border-line bg-panel-2 p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
                  <Field label={`Classe ${index + 1}`}>
                    <input
                      aria-label={`Classe ${index + 1}`}
                      value={entry.name}
                      onChange={(event) => updateAt<ClassEntry>(sheet.classes, set("classes"), index, { name: event.target.value })}
                      className="field"
                      placeholder="Es. Furia"
                    />
                  </Field>
                  <NumberField label="Livelli" value={entry.level} min={1} max={RULES.startingLevel} onChange={(level) => updateAt(sheet.classes, set("classes"), index, { level })} />
                  <NumberField label="+ PV" value={entry.hp} min={0} onChange={(hp) => updateAt(sheet.classes, set("classes"), index, { hp })} />
                  <NumberField label="+ PM" value={entry.mp} min={0} onChange={(mp) => updateAt(sheet.classes, set("classes"), index, { mp })} />
                  <NumberField label="+ PI" value={entry.ip} min={0} onChange={(ip) => updateAt(sheet.classes, set("classes"), index, { ip })} />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              {sheet.classes.length < 3 && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => set("classes", [...sheet.classes, { name: "", level: 1, hp: 0, mp: 0, ip: 0 }])}
                >
                  + Aggiungi una Classe
                </button>
              )}
              {sheet.classes.length > 2 && (
                <button type="button" className="btn-ghost" onClick={() => set("classes", sheet.classes.slice(0, -1))}>
                  Rimuovi ultima Classe
                </button>
              )}
              <b className="text-sm">Livelli assegnati: {sheet.classes.reduce((sum, entry) => sum + entry.level, 0)} / {RULES.startingLevel}</b>
            </div>
            <p className="text-xs text-muted">Inserisci qui le Classi scelte; nel passaggio successivo puoi cercare e aggiungere alla scheda le Abilità e gli incantesimi presenti nel catalogo.</p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Scegli una distribuzione iniziale e assegna i dadi alle quattro Caratteristiche. Puoi riordinare i dadi, ma non cambiarne la distribuzione.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {STARTING_DISTRIBUTIONS.map((distribution, index) => {
                const selected = distributionsEqual(sheet, distribution);
                return (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={selected}
                    className={`rounded-xl border p-3 text-left ${selected ? "border-accent bg-panel-2" : "border-line"}`}
                    onClick={() => set("attributes", Object.fromEntries(ATTRIBUTES.map((attribute, i) => [attribute.key, distribution[i]])) as Sheet["attributes"])}
                  >
                    <b>{["Tuttofare", "Nella media", "Specializzato"][index]}</b>
                    <span className="mt-1 block font-mono text-sm">{distribution.map((die) => `d${die}`).join(" · ")}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ATTRIBUTES.map((attribute) => (
                <Field key={attribute.key} label={attribute.name}>
                  <select
                    aria-label={attribute.name}
                    value={sheet.attributes[attribute.key]}
                    onChange={(event) => set("attributes", { ...sheet.attributes, [attribute.key]: Number(event.target.value) as Sheet["attributes"][typeof attribute.key] })}
                    className="field font-mono"
                  >
                    {DICE.filter((die) => die <= 10).map((die) => (
                      <option key={die} value={die}>d{die}</option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted">Aggiungi alla scheda Abilità e incantesimi dal catalogo oppure inseriscili a mano; i Rituali restano personalizzabili. Puoi completare questa parte più tardi.</p>
            <ManualCatalogPicker classes={sheet.classes} skills={sheet.skills} spells={sheet.spells} onSelect={addCatalogEntry} />
            <div className="flex flex-col gap-3">
              <h3 className="label">Abilità</h3>
              {sheet.skills.map((skill, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-line bg-panel-2 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto_auto]">
                  <Field label="Nome">
                    <input aria-label={`Abilità ${index + 1}`} value={skill.name} onChange={(event) => updateAt<SkillEntry>(sheet.skills, set("skills"), index, { name: event.target.value })} className="field" />
                  </Field>
                  <Field label="Classe">
                    <input aria-label={`Classe abilità ${index + 1}`} value={skill.source} onChange={(event) => updateAt(sheet.skills, set("skills"), index, { source: event.target.value })} className="field" />
                  </Field>
                  <NumberField label="Gradi" value={skill.level} min={1} max={skill.maxRank ?? 10} onChange={(level) => updateAt(sheet.skills, set("skills"), index, { level })} />
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold">
                    <input type="checkbox" checked={skill.heroic} onChange={(event) => updateAt(sheet.skills, set("skills"), index, { heroic: event.target.checked })} className="accent-accent" />
                    Eroica
                  </label>
                  <Field label="Promemoria" className="sm:col-span-4">
                    <textarea aria-label={`Promemoria abilità ${index + 1}`} value={skill.summary} onChange={(event) => updateAt(sheet.skills, set("skills"), index, { summary: event.target.value })} className="field" rows={2} />
                  </Field>
                  {skill.name.trim().toLocaleLowerCase("it") === "tecnologie" && (
                    <TechnologyOptionsEditor
                      value={skill.technologyOptions}
                      skillLevel={skill.level}
                      onChange={(technologyOptions) => updateAt(sheet.skills, set("skills"), index, { technologyOptions })}
                    />
                  )}
                  <RemoveButton onClick={() => set("skills", sheet.skills.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
              ))}
              <button type="button" className="btn-ghost self-start" onClick={() => set("skills", [...sheet.skills, { name: "", source: "", level: 1, maxRank: null, heroic: false, summary: "" }])}>
                + Aggiungi Abilità
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="label">Incantesimi</h3>
              {sheet.spells.map((spell, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-line bg-panel-2 p-3 sm:grid-cols-2">
                  <Field label="Nome">
                    <input aria-label={`Incantesimo ${index + 1}`} value={spell.name} onChange={(event) => updateAt<SpellEntry>(sheet.spells, set("spells"), index, { name: event.target.value })} className="field" />
                  </Field>
                  <Field label="Costo in PM">
                    <input aria-label={`Costo incantesimo ${index + 1}`} value={spell.mp} onChange={(event) => updateAt(sheet.spells, set("spells"), index, { mp: event.target.value })} className="field" />
                  </Field>
                  <Field label="Bersaglio">
                    <input aria-label={`Bersaglio incantesimo ${index + 1}`} value={spell.target} onChange={(event) => updateAt(sheet.spells, set("spells"), index, { target: event.target.value })} className="field" />
                  </Field>
                  <Field label="Durata">
                    <input aria-label={`Durata incantesimo ${index + 1}`} value={spell.duration} onChange={(event) => updateAt(sheet.spells, set("spells"), index, { duration: event.target.value })} className="field" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input aria-label={`Incantesimo offensivo ${index + 1}`} type="checkbox" checked={spell.offensive} onChange={(event) => updateAt(sheet.spells, set("spells"), index, { offensive: event.target.checked })} className="accent-accent" />
                    Incantesimo offensivo
                  </label>
                  <Field label="Promemoria" className="sm:col-span-2">
                    <textarea aria-label={`Promemoria incantesimo ${index + 1}`} value={spell.summary} onChange={(event) => updateAt(sheet.spells, set("spells"), index, { summary: event.target.value })} className="field" rows={2} />
                  </Field>
                  <RemoveButton onClick={() => set("spells", sheet.spells.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
              ))}
              <button type="button" className="btn-ghost self-start" onClick={() => set("spells", [...sheet.spells, { name: "", mp: "", target: "", duration: "", offensive: false, summary: "" }])}>
                + Aggiungi incantesimo
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="label">Rituali</h3>
              <p className="text-sm text-muted">I Rituali si definiscono in base all’obiettivo: registra quelli utili al tuo PG come promemoria personalizzati.</p>
              {sheet.rituals.map((ritual, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-line bg-panel-2 p-3">
                  <Field label="Nome o scopo del rituale">
                    <input aria-label={`Rituale ${index + 1}`} value={ritual.name} onChange={(event) => updateAt<RitualEntry>(sheet.rituals, set("rituals"), index, { name: event.target.value })} className="field" />
                  </Field>
                  <Field label="Promemoria">
                    <textarea aria-label={`Promemoria rituale ${index + 1}`} value={ritual.summary} onChange={(event) => updateAt(sheet.rituals, set("rituals"), index, { summary: event.target.value })} className="field" rows={2} />
                  </Field>
                  <RemoveButton onClick={() => set("rituals", sheet.rituals.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
              ))}
              <button type="button" className="btn-ghost self-start" onClick={() => set("rituals", [...sheet.rituals, { name: "", summary: "" }])}>
                + Aggiungi rituale personale
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted">Hai 500 Zenit per l&apos;equipaggiamento iniziale. Inserisci i costi per controllare il budget; i risparmi sono ciò che avanza più il tiro 2d6 × 10.</p>
            <div className="flex flex-col gap-3">
              <h3 className="label">Equipaggiamento</h3>
              {sheet.equipment.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-line bg-panel-2 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_repeat(3,minmax(0,0.8fr))]">
                  <Field label="Oggetto">
                    <input aria-label={`Oggetto ${index + 1}`} value={item.name} onChange={(event) => updateAt<EquipmentEntry>(sheet.equipment, set("equipment"), index, { name: event.target.value })} className="field" placeholder="Es. Spada di bronzo" />
                  </Field>
                  <Field label="Tipo">
                    <select aria-label={`Tipo oggetto ${index + 1}`} value={item.slot} onChange={(event) => updateAt(sheet.equipment, set("equipment"), index, { slot: event.target.value as EquipmentEntry["slot"] })} className="field">
                      {EQUIPMENT_SLOTS.map((slot) => <option key={slot.key} value={slot.key}>{slot.label}</option>)}
                    </select>
                  </Field>
                  <NumberField label="Costo" value={item.cost} min={0} onChange={(cost) => updateAt(sheet.equipment, set("equipment"), index, { cost })} />
                  <NumberField label="Dif." value={item.defense} min={-10} onChange={(defense) => updateAt(sheet.equipment, set("equipment"), index, { defense })} />
                  <NumberField label="D. Mag." value={item.magicDefense} min={-10} onChange={(magicDefense) => updateAt(sheet.equipment, set("equipment"), index, { magicDefense })} />
                  <Field label="Regole / danno" className="sm:col-span-5">
                    <input aria-label={`Dettagli oggetto ${index + 1}`} value={item.summary} onChange={(event) => updateAt(sheet.equipment, set("equipment"), index, { summary: event.target.value })} className="field" placeholder="Es. Precisione DES + VIG · danno TM + 6 fisico" />
                  </Field>
                  <RemoveButton onClick={() => set("equipment", sheet.equipment.filter((_, itemIndex) => itemIndex !== index))} />
                </div>
              ))}
              <button type="button" className="btn-ghost self-start" onClick={() => set("equipment", [...sheet.equipment, { name: "", slot: "arma", quantity: 1, cost: 0, acquisition: "starting", paymentSource: null, sessionNumber: null, date: "", defense: 0, magicDefense: 0, initiative: 0, summary: "" }])}>
                + Aggiungi oggetto
              </button>
              <p className={`text-sm font-bold ${spent > RULES.equipmentBudget ? "text-danger" : ""}`}>
                Spesi: {spent} / {RULES.equipmentBudget} Zenit · Rimasti: {RULES.equipmentBudget - spent}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Risultato del tiro 2d6">
                <select aria-label="Risultato del tiro 2d6" value={savingsRoll} onChange={(event) => setSavingsRoll(event.target.value)} className="field">
                  <option value="">Scegli il risultato</option>
                  {Array.from({ length: 11 }, (_, index) => index + 2).map((roll) => <option key={roll} value={roll}>{roll}</option>)}
                </select>
                <span className="text-xs text-muted">Il risultato viene moltiplicato per 10 e aggiunto agli Zenit rimasti.</span>
              </Field>
              <div className="rounded-xl bg-panel-2 p-3 text-sm">
                <b>Risorse iniziali calcolate</b>
                <p className="mt-1">Livello {derived.level} · PV {derived.maxHp} · PM {derived.maxMp} · PI {derived.maxIp}</p>
                <p>Difesa {derived.defense} · Difesa Magica {derived.magicDefense}</p>
                <p>Zenit iniziali: {startingZenit ?? "—"}</p>
              </div>
            </div>
            <Field label="Note">
              <textarea aria-label="Note" value={basics.notes} onChange={(event) => setBasic("notes", event.target.value)} className="field resize-y" rows={3} placeholder="Aspetto, storia, segreti da ricordare…" />
            </Field>
            <div className="rounded-xl border border-line p-3 text-sm">
              <b>Riepilogo</b>
              <p>{basics.name} · {basics.identity} · Tema: {basics.theme} · Origine: {basics.origin}</p>
              <p>{sheet.classes.map((entry) => `${entry.name} ${entry.level}`).join(" · ")}</p>
              <p>{ATTRIBUTES.map((attribute) => `${attribute.short} d${sheet.attributes[attribute.key]}`).join(" · ")}</p>
              <p>Punti Fabula iniziali: {RULES.startingFabulaPoints}</p>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
        {state.error && <p role="alert" className="text-sm font-bold text-danger">{state.error}</p>}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && <button type="button" className="btn-ghost" onClick={() => { setError(""); setStep((current) => current - 1); }}>Indietro</button>}
        {step < STEP_NAMES.length - 1 ? (
          <button type="button" className="btn" onClick={next}>Continua</button>
        ) : (
          <>
            <SubmitButton>Crea il personaggio</SubmitButton>
            <p className="text-xs text-muted">Dopo il salvataggio potrai aggiungere i Legami e completare la scheda in qualsiasi momento.</p>
          </>
        )}
      </div>
    </form>
  );
}

function distributionsEqual(sheet: Sheet, distribution: readonly number[]) {
  return ATTRIBUTES.every((attribute, index) => sheet.attributes[attribute.key] === distribution[index]);
}

function updateAt<T>(items: T[], onChange: ((items: T[]) => void) | void, index: number, patch: Partial<T>) {
  if (onChange) onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}><span className="label">{label}</span>{children}</label>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" inputMode="numeric" min={min} max={max} step={1} value={Number.isFinite(value) ? value : ""} onChange={(event) => onChange(event.target.value === "" ? (min ?? 0) : Math.trunc(Number(event.target.value)))} className="field" />
    </Field>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label="Rimuovi" className="justify-self-start self-end rounded-full px-3 py-2 text-sm font-bold text-muted hover:text-danger">Rimuovi</button>;
}
