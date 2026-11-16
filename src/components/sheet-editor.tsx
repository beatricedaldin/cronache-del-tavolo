"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveCharacterAction } from "@/app/actions/character";
import type { FormState } from "@/lib/form";
import type { Character } from "@/lib/data/types";
import type { CatalogEntry } from "@/lib/fabula-catalog";
import { ManualCatalogPicker } from "./manual-catalog-picker";
import { TechnologyOptionsEditor } from "./technology-options-editor";
import {
  ATTRIBUTES,
  DICE,
  derive,
  emptySheet,
  emptyTechnologyOptions,
  EQUIPMENT_SLOTS,
  RULES,
  sheetWarnings,
  STARTING_DISTRIBUTIONS,
  type ClassEntry,
  type EquipmentEntry,
  type RitualEntry,
  type Sheet,
  type SkillEntry,
  type SpellEntry,
} from "@/lib/fabula";
import { SubmitButton } from "./submit-button";

type Basics = { name: string; identity: string; theme: string; origin: string; fabulaPoints: number; notes: string };

/** La scheda completa, da compilare con calma dopo la sessione. Tutti i campi sono controllati, così un errore non li svuota. */
export function SheetEditor({ campaignId, character }: { campaignId: string; character: Character | null }) {
  const [state, action] = useActionState<FormState, FormData>(saveCharacterAction.bind(null, campaignId), {});
  const [basics, setBasics] = useState<Basics>({
    name: character?.name ?? "",
    identity: character?.identity ?? "",
    theme: character?.theme ?? "",
    origin: character?.origin ?? "",
    fabulaPoints: character?.fabulaPoints ?? RULES.startingFabulaPoints,
    notes: character?.notes ?? "",
  });
  const [sheet, setSheet] = useState<Sheet>(character?.sheet ?? emptySheet());

  const d = derive(sheet, character?.level ?? 5);
  const warnings = sheetWarnings(sheet, character?.bonds.length ?? 0);
  const set = <K extends keyof Sheet>(key: K, value: Sheet[K]) => setSheet((s) => ({ ...s, [key]: value }));
  const setBasic = <K extends keyof Basics>(key: K, value: Basics[K]) => setBasics((b) => ({ ...b, [key]: value }));
  const classNames = sheet.classes.map((c) => c.name).filter(Boolean);
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

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="sheet" value={JSON.stringify(sheet)} />

      <Section title={character ? "Il tuo personaggio" : "Crea il tuo personaggio"}>
        <Field label="Nome del PG">
          <input
            name="name"
            required
            value={basics.name}
            onChange={(e) => setBasic("name", e.target.value)}
            className="field"
            placeholder="Es. Kael Senzaterra"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Identità">
            <input name="identity" value={basics.identity} onChange={(e) => setBasic("identity", e.target.value)} className="field" placeholder="Es. Mercenario in cerca di riscatto" />
          </Field>
          <Field label="Tema">
            <input name="theme" value={basics.theme} onChange={(e) => setBasic("theme", e.target.value)} className="field" placeholder="Es. Vendetta" />
          </Field>
          <Field label="Origine">
            <input name="origin" value={basics.origin} onChange={(e) => setBasic("origin", e.target.value)} className="field" placeholder="Es. Le Terre Cineree" />
          </Field>
        </div>
      </Section>

      <Section title="Caratteristiche" hint={`Alla creazione scegli una distribuzione e assegna i dadi come vuoi: ${STARTING_DISTRIBUTIONS.map((x) => x.map((n) => `d${n}`).join(" ")).join(" · oppure ")}. Il d12 si raggiunge solo più avanti.`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ATTRIBUTES.map((a) => (
            <Field key={a.key} label={`${a.name} (${a.short})`}>
              <select
                value={sheet.attributes[a.key]}
                onChange={(e) => set("attributes", { ...sheet.attributes, [a.key]: Number(e.target.value) })}
                className="field font-mono"
              >
                {DICE.map((n) => (
                  <option key={n} value={n}>
                    d{n}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Classi" hint={`Massimo ${RULES.maxClassLevel} livelli per classe e al massimo ${RULES.maxOpenClasses} classi sotto il livello ${RULES.maxClassLevel} insieme. Il livello del personaggio è la somma. Nei bonus metti quello che la classe dà al primo livello (es. +5 PV).`}>
        <ListEditor<ClassEntry>
          items={sheet.classes}
          onChange={(v) => set("classes", v)}
          create={() => ({ name: "", level: 1, hp: 0, mp: 0, ip: 0 })}
          addLabel="Aggiungi classe"
          render={(c, update) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
              <Field label="Classe" className="col-span-2 sm:col-span-1">
                <input value={c.name} onChange={(e) => update({ name: e.target.value })} className="field" placeholder="Es. Furia" />
              </Field>
              <Num label="Livello" value={c.level} min={1} max={RULES.maxClassLevel} onChange={(level) => update({ level })} />
              <Num label="+PV" value={c.hp} min={0} onChange={(hp) => update({ hp })} />
              <Num label="+PM" value={c.mp} min={0} onChange={(mp) => update({ mp })} />
              <Num label="+PI" value={c.ip} min={0} onChange={(ip) => update({ ip })} />
            </div>
          )}
        />
        <p className="rounded-xl bg-panel-2 px-4 py-3 text-sm">
          Livello <b>{d.level}</b> · PV <b>{d.maxHp}</b> (crisi ≤ {d.crisis}) · PM <b>{d.maxMp}</b> · PI <b>{d.maxIp}</b>
        </p>
      </Section>

      <Section title="Catalogo dei manuali" hint="Cerca per categoria o Classe e aggiungi le voci selezionate alla scheda. L’indice OCR è una bozza: verifica requisiti e riferimenti sul manuale.">
        <ManualCatalogPicker classes={sheet.classes} skills={sheet.skills} spells={sheet.spells} onSelect={addCatalogEntry} />
      </Section>

      <Section title="Abilità" hint="Bastano nome e una riga che ti ricordi cosa fa: è quello che consulterai al tavolo.">
        <datalist id="skill-sources">
          {classNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <ListEditor<SkillEntry>
          items={sheet.skills}
          onChange={(v) => set("skills", v)}
          create={() => ({ name: "", source: classNames[0] ?? "", level: 1, maxRank: null, heroic: false, summary: "" })}
          addLabel="Aggiungi abilità"
          render={(k, update) => (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,0.8fr)_auto]">
                <Field label="Abilità" className="col-span-2 sm:col-span-1">
                  <input value={k.name} onChange={(e) => update({ name: e.target.value })} className="field" />
                </Field>
                <Field label="Classe">
                  <input value={k.source} onChange={(e) => update({ source: e.target.value })} list="skill-sources" className="field" />
                </Field>
                <Num label="Livello (LA)" value={k.level} min={1} max={k.maxRank ?? 10} onChange={(level) => update({ level })} />
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold">
                  <input type="checkbox" checked={k.heroic} onChange={(e) => update({ heroic: e.target.checked })} className="accent-accent" />
                  Eroica
                </label>
              </div>
              <Summary value={k.summary} onChange={(summary) => update({ summary })} />
              {k.name.trim().toLocaleLowerCase("it") === "tecnologie" && (
                <TechnologyOptionsEditor
                  value={k.technologyOptions}
                  skillLevel={k.level}
                  onChange={(technologyOptions) => update({ technologyOptions })}
                />
              )}
            </div>
          )}
        />
      </Section>

      <Section title="Incantesimi" hint="Lascia vuoto se il tuo PG non usa la magia.">
        <ListEditor<SpellEntry>
          items={sheet.spells}
          onChange={(v) => set("spells", v)}
          create={() => ({ name: "", mp: "", target: "", duration: "", offensive: false, summary: "" })}
          addLabel="Aggiungi incantesimo"
          render={(sp, update) => (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
                <Field label="Incantesimo" className="col-span-2 sm:col-span-1">
                  <input value={sp.name} onChange={(e) => update({ name: e.target.value })} className="field" />
                </Field>
                <Field label="PM">
                  <input value={sp.mp} onChange={(e) => update({ mp: e.target.value })} className="field" placeholder="10" />
                </Field>
                <Field label="Bersaglio">
                  <input value={sp.target} onChange={(e) => update({ target: e.target.value })} className="field" placeholder="Una creatura" />
                </Field>
                <Field label="Durata">
                  <input value={sp.duration} onChange={(e) => update({ duration: e.target.value })} className="field" placeholder="Istantanea" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sp.offensive} onChange={(event) => update({ offensive: event.target.checked })} className="accent-accent" />
                Incantesimo offensivo
              </label>
              <Summary value={sp.summary} onChange={(summary) => update({ summary })} />
            </div>
          )}
        />
      </Section>

      <Section title="Rituali" hint="I Rituali si definiscono in base all’obiettivo: non sono un elenco chiuso di opzioni per Classe. Registra qui quelli utili al tuo PG.">
        <ListEditor<RitualEntry>
          items={sheet.rituals}
          onChange={(v) => set("rituals", v)}
          create={() => ({ name: "", summary: "" })}
          addLabel="Aggiungi rituale personale"
          render={(ritual, update) => (
            <div className="flex flex-col gap-2">
              <Field label="Nome o scopo del rituale">
                <input value={ritual.name} onChange={(event) => update({ name: event.target.value })} className="field" placeholder="Es. proteggere il villaggio dalla tempesta" />
              </Field>
              <Summary value={ritual.summary} onChange={(summary) => update({ summary })} />
            </div>
          )}
        />
      </Section>

      <Section title="Equipaggiamento" hint="Nei campi numerici metti i bonus a Difesa, Difesa Magica e Iniziativa. Per registrare un nuovo acquisto, ritrovamento o ricompensa usa Inventario PG: solo gli acquisti scalano gli Zenit personali.">
        <ListEditor<EquipmentEntry>
          items={sheet.equipment}
          onChange={(v) => set("equipment", v)}
          create={() => ({ name: "", slot: "arma", quantity: 1, cost: 0, acquisition: "unknown", paymentSource: null, sessionNumber: null, date: "", defense: 0, magicDefense: 0, initiative: 0, summary: "" })}
          addLabel="Aggiungi oggetto"
          render={(e, update) => (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_repeat(5,minmax(0,0.8fr))]">
                <Field label="Oggetto" className="col-span-3 sm:col-span-1">
                  <input value={e.name} onChange={(ev) => update({ name: ev.target.value })} className="field" />
                </Field>
                <Field label="Tipo" className="col-span-3 sm:col-span-1">
                  <select value={e.slot} onChange={(ev) => update({ slot: ev.target.value as EquipmentEntry["slot"] })} className="field">
                    {EQUIPMENT_SLOTS.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Num label="Quantità" value={e.quantity} min={1} onChange={(quantity) => update({ quantity })} />
                <Num label="Dif." value={e.defense} min={-10} onChange={(defense) => update({ defense })} />
                <Num label="D. Mag." value={e.magicDefense} min={-10} onChange={(magicDefense) => update({ magicDefense })} />
                <Num label="Iniz." value={e.initiative} min={-10} onChange={(initiative) => update({ initiative })} />
                <Num label="Costo" value={e.cost} min={0} onChange={(cost) => update({ cost })} />
              </div>
              <Summary value={e.summary} onChange={(summary) => update({ summary })} placeholder="Es. Precisione DES + VIG · danno RA + 8 fisico" />
            </div>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionalNum
            label={`Difesa base fissa (ora ${d.defense})`}
            hint="Solo per le armature marziali, che sostituiscono la DES (es. Brigantina 10). Lo scudo mettilo come oggetto: il suo bonus si somma. Vuoto = DES."
            value={sheet.defenseBase}
            onChange={(v) => set("defenseBase", v)}
          />
          <OptionalNum
            label={`Difesa Magica base fissa (ora ${d.magicDefense})`}
            hint="Raramente serve. Vuoto = INT più i bonus degli oggetti."
            value={sheet.magicDefenseBase}
            onChange={(v) => set("magicDefenseBase", v)}
          />
        </div>
      </Section>

      <Section title="Dopo la sessione" hint="Aggiorna a casa quello che il Master vi ha assegnato. Lascia vuoti PV, PM e PI se sono al massimo.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <OptionalNum label={`PV (max ${d.maxHp})`} value={sheet.current.hp} onChange={(hp) => set("current", { ...sheet.current, hp })} />
          <OptionalNum label={`PM (max ${d.maxMp})`} value={sheet.current.mp} onChange={(mp) => set("current", { ...sheet.current, mp })} />
          <OptionalNum label={`PI (max ${d.maxIp})`} value={sheet.current.ip} onChange={(ip) => set("current", { ...sheet.current, ip })} />
          <Field label="Punti Fabula">
            <input
              name="fabulaPoints"
              type="number"
              min={0}
              value={basics.fabulaPoints}
              onChange={(e) => setBasic("fabulaPoints", Number(e.target.value))}
              className="field"
            />
          </Field>
          <Num label="PE" value={sheet.xp} min={0} onChange={(xp) => set("xp", xp)} />
          <Num label="Zenit" value={sheet.zenit} min={0} onChange={(zenit) => set("zenit", zenit)} />
        </div>
        <p className="text-xs text-muted">
          Alla creazione hai {RULES.equipmentBudget} Zenit da spendere in equipaggiamento: quelli che avanzano si sommano a 2d6 × 10.
        </p>
        <div key={state.at} className="grid gap-3 rounded-xl border border-line bg-panel-2 p-3 sm:grid-cols-[120px_minmax(0,1fr)]">
          <Field label="Sessione (facoltativa)">
            <input name="advancementSession" type="number" min={1} max={999} defaultValue="" className="field" placeholder="Es. 4" />
          </Field>
          <Field label="Registro dei progressi (facoltativo)">
            <textarea
              name="advancementSummary"
              maxLength={1500}
              rows={2}
              defaultValue=""
              className="field resize-y"
              placeholder="Dopo aver aggiornato la scheda, annota qui cosa è cambiato: nuova Classe/Abilità, ricompense o decisioni del gruppo."
            />
          </Field>
          <p className="text-xs text-muted sm:col-span-2">
            Se scrivi una sessione, descrivi anche il cambiamento. La nota verrà salvata insieme alla scheda e comparirà nel registro consultabile.
          </p>
        </div>
      </Section>

      <Section title="Note">
        <textarea
          name="notes"
          rows={5}
          value={basics.notes}
          onChange={(e) => setBasic("notes", e.target.value)}
          className="field resize-y"
          placeholder="Storia, aspetto, segreti, cose da ricordare…"
        />
      </Section>

      {warnings.length > 0 && (
        <ul className="rounded-2xl border border-thread bg-thread-bg px-5 py-3 text-sm">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-bg px-1 py-3">
        <SubmitButton>Salva scheda</SubmitButton>
        {character && (
          <Link href={`/c/${campaignId}/scheda`} className="btn-ghost">
            Vai alla scheda da consultare
          </Link>
        )}
        {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
        {state.ok && <p className="text-sm font-bold text-place">{state.message}</p>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="panel flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Num({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === "" ? (min ?? 0) : Number(e.target.value))}
        className="field"
      />
    </Field>
  );
}

function OptionalNum({ label, hint, value, onChange }: { label: string; hint?: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="field"
        placeholder="—"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Field>
  );
}

function Summary({ value, onChange, placeholder = "Cosa fa: una riga, oppure il testo completo" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <textarea rows={2} maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)} className="field resize-y text-sm" placeholder={placeholder} />;
}

function ListEditor<T>({
  items,
  onChange,
  create,
  render,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
}) {
  const update = (i: number) => (patch: Partial<T>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 rounded-xl border border-line bg-panel-2 p-3">
          <div className="min-w-0 flex-1">{render(item, update(i))}</div>
          <div className="flex flex-col gap-1 text-muted">
            <IconButton label="Sposta su" onClick={() => move(i, i - 1)}>↑</IconButton>
            <IconButton label="Sposta giù" onClick={() => move(i, i + 1)}>↓</IconButton>
            <IconButton label="Rimuovi" danger onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</IconButton>
          </div>
        </div>
      ))}
      <button type="button" className="btn-ghost self-start" onClick={() => onChange([...items, create()])}>
        + {addLabel}
      </button>
    </div>
  );
}

function IconButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`size-7 rounded-full text-sm font-bold hover:bg-panel ${danger ? "hover:text-danger" : "hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
