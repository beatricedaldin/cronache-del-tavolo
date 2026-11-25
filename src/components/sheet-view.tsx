import {
  ATTRIBUTES,
  bondStrength,
  derive,
  DIFFICULTIES,
  EQUIPMENT_ACQUISITIONS,
  EQUIPMENT_SLOTS,
  FABULA_GAINS,
  FABULA_USES,
  STATUSES,
  technologyOptionsSummary,
} from "@/lib/fabula";
import type { Character, Thread } from "@/lib/data/types";
import { formatDay } from "@/lib/dates";

/**
 * La scheda da consultare al tavolo: sola lettura, caratteri grandi, niente da compilare.
 * Si legge in pochi secondi e il telefono torna in tasca.
 */
export function SheetView({ character: c, openThreads = [] }: { character: Character; openThreads?: Thread[] }) {
  const s = c.sheet;
  const d = derive(s, c.level);
  const classes = s.classes.length > 0 ? s.classes.map((k) => `${k.name} ${k.level}`).join(" · ") : c.classes;
  const skillsBySource = groupBy(s.skills, (k) => (k.heroic ? "Abilità Eroiche" : k.source || "Altre abilità"));

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-4">
          {c.portraitUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo di Supabase Storage
            <img src={c.portraitUrl} alt={`Ritratto di ${c.name}`} className="size-24 shrink-0 rounded-2xl border border-line object-cover sm:size-32" />
          )}
          <div>
          <h2 className="font-display text-4xl font-bold leading-tight">{c.name}</h2>
          <p className="text-lg text-muted">
            Liv. <b className="text-ink">{d.level}</b>
            {classes && <> · {classes}</>}
          </p>
          </div>
        </div>
        <div className="flex items-baseline gap-2 rounded-2xl border-2 border-gold px-4 py-2">
          <span className="font-display text-4xl font-bold text-gold">{c.fabulaPoints}</span>
          <span className="label">Punti Fabula</span>
        </div>
      </header>

      {(c.identity || c.theme || c.origin) && (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Tratti">
          <Trait label="Identità" value={c.identity} />
          <Trait label="Tema" value={c.theme} />
          <Trait label="Origine" value={c.origin} />
        </section>
      )}

      <section className="grid grid-cols-4 gap-2 sm:gap-3" aria-label="Caratteristiche">
        {ATTRIBUTES.map((a) => (
          <div key={a.key} className="panel flex flex-col items-center gap-0.5 px-2 py-3 text-center">
            <span className="label" title={a.name}>
              {a.short}
            </span>
            <span className="font-mono text-3xl">d{s.attributes[a.key]}</span>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6" aria-label="Valori derivati">
        <Stat label="PV" value={d.maxHp} current={s.current.hp} note={`Crisi ≤ ${d.crisis}`} />
        <Stat label="PM" value={d.maxMp} current={s.current.mp} />
        <Stat label="PI" value={d.maxIp} current={s.current.ip} />
        <Stat label="Difesa" value={d.defense} />
        <Stat label="Dif. Magica" value={d.magicDefense} />
        <Stat label="Iniziativa" value={d.initiative} signed />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Block title="Legami" empty="Nessun legame.">
          {c.bonds.length > 0 && (
            <ul className="flex flex-col">
              {c.bonds.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 border-t border-dashed border-line py-2 first:border-t-0">
                  <span>
                    <b className="text-lg">{b.target}</b>
                    <span className="block text-sm text-muted">{b.emotions.join(" · ")}</span>
                  </span>
                  <Strength value={bondStrength(b.emotions)} />
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Fili in sospeso" empty="Nessun filo aperto.">
          {openThreads.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {openThreads.map((t) => (
                <li key={t.id} className="flex gap-2">
                  <span className="font-bold text-thread">?</span>
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      <Block title="Abilità" empty="Nessuna abilità segnata.">
        {s.skills.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {[...skillsBySource].map(([source, skills]) => (
              <div key={source} className="flex flex-col gap-2">
                <h4 className={`label ${source === "Abilità Eroiche" ? "text-gold" : ""}`}>{source}</h4>
                <ul className="flex flex-col gap-2">
                  {skills.map((k, i) => (
                    <li key={i}>
                      <b>{k.name}</b>
                      {!k.heroic && (k.level > 1 || k.maxRank !== null) && (
                        <span className="session ml-2">LA {k.level}{k.maxRank !== null ? `/${k.maxRank}` : ""}</span>
                      )}
                      {k.summary && <LongText text={k.summary} className="text-sm text-muted" />}
                      {technologyOptionsSummary(k.technologyOptions) && (
                        <p className="text-sm text-muted">{technologyOptionsSummary(k.technologyOptions)}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Block>

      {s.spells.length > 0 && (
        <Block title="Incantesimi">
          <ul className="grid gap-3 md:grid-cols-2">
            {s.spells.map((sp, i) => (
              <li key={i} className="rounded-xl border border-line bg-panel-2 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <b>{sp.name}</b>
                  {sp.mp && <span className="font-mono text-sm text-accent">{sp.mp} PM</span>}
                </div>
                {sp.offensive && <p className="text-xs font-bold text-accent">Incantesimo offensivo</p>}
                {(sp.target || sp.duration) && (
                  <p className="text-xs text-muted">{[sp.target, sp.duration].filter(Boolean).join(" · ")}</p>
                )}
                {sp.summary && <LongText text={sp.summary} className="mt-1 text-sm" />}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {s.rituals.length > 0 && (
        <Block title="Rituali">
          <ul className="flex flex-col gap-2">
            {s.rituals.map((ritual, i) => (
              <li key={i}>
                <b>{ritual.name}</b>
                {ritual.summary && <LongText text={ritual.summary} className="text-sm text-muted" />}
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Equipaggiamento" empty="Nessun oggetto segnato.">
        {s.equipment.length > 0 && (
          <ul className="flex flex-col">
            {s.equipment.map((e, i) => (
              <li key={i} className="flex flex-col border-t border-dashed border-line py-2 first:border-t-0">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="label">{EQUIPMENT_SLOTS.find((x) => x.key === e.slot)?.label}</span>
                  <b>{e.name}</b>
                  {e.quantity > 1 && <span className="session">×{e.quantity}</span>}
                  {!e.equipped && <span className="text-xs italic text-muted">nello zaino</span>}
                  {e.acquisition !== "unknown" && (
                    <span className="text-xs text-muted">
                      {EQUIPMENT_ACQUISITIONS.find((source) => source.key === e.acquisition)?.label}
                      {e.sessionNumber ? ` · S${e.sessionNumber}` : ""}
                      {e.date ? ` · ${formatDay(e.date)}` : ""}
                    </span>
                  )}
                  {e.cost > 0 && <span className="text-xs text-muted">{e.cost} Zenit</span>}
                </span>
                {e.summary && <LongText text={e.summary} className="text-sm text-muted" />}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex flex-wrap gap-x-5 border-t border-line pt-2 text-sm text-muted">
          <span>
            Zenit <b className="text-ink">{s.zenit}</b>
          </span>
          <span>
            PE <b className="text-ink">{s.xp}</b>
          </span>
        </p>
      </Block>

      {c.notes && (
        <Block title="Note">
          <p className="whitespace-pre-wrap">{c.notes}</p>
        </Block>
      )}

      {s.advancements.length > 0 && (
        <details className="panel group">
          <summary className="cursor-pointer font-display text-xl font-bold">
            Registro dei progressi · {s.advancements.length}
          </summary>
          <ol className="mt-3 flex flex-col">
            {[...s.advancements].reverse().map((entry, index) => (
              <li key={`${entry.date}-${index}`} className="border-t border-dashed border-line py-3 first:border-t-0">
                <p className="text-sm font-bold">
                  {entry.sessionNumber ? `Sessione ${entry.sessionNumber} · ` : ""}
                  {entry.date ? formatDay(entry.date) : "Data non specificata"}
                  <span className="font-normal text-muted"> · Liv. {entry.level}{entry.classes ? ` · ${entry.classes}` : ""}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{entry.summary}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      <RulesReminder />
    </article>
  );
}

/** Promemoria delle regole che si chiedono più spesso al tavolo. Chiuso di default. */
export function RulesReminder() {
  return (
    <details className="panel group print:hidden">
      <summary className="cursor-pointer font-display text-xl font-bold">Promemoria regole</summary>
      <div className="mt-4 grid gap-5 text-sm md:grid-cols-2">
        <div>
          <h4 className="label mb-1">Spendere un Punto Fabula</h4>
          <ul className="list-disc pl-5">
            {FABULA_USES.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <h4 className="label mb-1 mt-3">Guadagnare Punti Fabula</h4>
          <ul className="list-disc pl-5">
            {FABULA_GAINS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="label mb-1">Status</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3">
            {STATUSES.map((x) => (
              <div key={x.name} className="contents">
                <dt className="font-bold">{x.name}</dt>
                <dd className="text-muted">{x.effect}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-xs text-muted">Nessuna caratteristica scende sotto d6.</p>
          <h4 className="label mb-1 mt-3">Difficoltà</h4>
          <p>{DIFFICULTIES.map((x) => `${x.level} ${x.label.toLowerCase()}`).join(" · ")}</p>
          <h4 className="label mb-1 mt-3">Dadi</h4>
          <p>
            <b>Critico:</b> stesso numero su entrambi i dadi, 6 o più. <b>Fallimento critico:</b> doppio 1.
          </p>
        </div>
      </div>
    </details>
  );
}

/** Le descrizioni lunghe (es. il testo completo di un incantesimo) restano chiuse: al tavolo basta l'inizio. */
function LongText({ text, className = "" }: { text: string; className?: string }) {
  if (text.length <= 220 && !text.includes("\n")) return <p className={className}>{text}</p>;
  const firstLine = text.split("\n")[0];
  const preview = firstLine.length > 160 ? `${firstLine.slice(0, 160).trimEnd()}…` : firstLine;
  return (
    <details className={`group ${className}`}>
      <summary className="cursor-pointer list-none">
        <span className="group-open:hidden">
          {preview} <span className="font-bold text-accent">leggi tutto</span>
        </span>
        <span className="hidden font-bold text-accent group-open:inline">chiudi</span>
      </summary>
      <p className="mt-1 whitespace-pre-wrap">{text}</p>
    </details>
  );
}

function Trait({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-4 py-3">
      <span className="label">{label}</span>
      <p className="text-lg font-bold leading-snug">{value || <span className="font-normal italic text-muted">—</span>}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  current = null,
  note,
  signed = false,
}: {
  label: string;
  value: number;
  current?: number | null;
  note?: string;
  signed?: boolean;
}) {
  const shown = signed && value > 0 ? `+${value}` : String(value);
  return (
    <div className="panel flex flex-col px-3 py-3">
      <span className="label">{label}</span>
      <span className="font-mono text-2xl">
        {current !== null ? (
          <>
            {current}
            <span className="text-base text-muted">/{shown}</span>
          </>
        ) : (
          shown
        )}
      </span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

function Strength({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-label={`Forza ${value}`} title={`Forza ${value}`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`size-3 rounded-full border-2 border-accent ${n <= value ? "bg-accent" : ""}`} />
      ))}
    </span>
  );
}

function Block({ title, empty, children }: { title: string; empty?: string; children?: React.ReactNode }) {
  const hasContent = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <section className="panel break-inside-avoid">
      <h3 className="mb-3 font-display text-xl font-bold">{title}</h3>
      {hasContent ? children : <p className="text-sm italic text-muted">{empty}</p>}
    </section>
  );
}

function groupBy<T>(items: T[], key: (x: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const x of items) map.set(key(x), [...(map.get(key(x)) ?? []), x]);
  return map;
}
