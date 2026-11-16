"use client";

import { useEffect, useRef, useState } from "react";
import { CATALOG_CLASSES, CATALOG_KINDS, FABULA_CATALOG, type CatalogEntry, type CatalogKind } from "@/lib/fabula-catalog";
import { TECHNOLOGY_DISCIPLINES, type ClassEntry, type SkillEntry, type SpellEntry } from "@/lib/fabula";

type Availability = { available: boolean; uncertain: boolean; label: string };

function getAvailability(entry: CatalogEntry, classes: ClassEntry[], skills: SkillEntry[], spells: SpellEntry[]): Availability {
  if (entry.availabilityWarning) {
    return { available: false, uncertain: true, label: entry.availabilityWarning };
  }

  if (entry.requirementUnverified) {
    return { available: false, uncertain: true, label: "Requisito da verificare sulla fonte" };
  }

  const classLevels = new Map(classes.map((item) => [item.name.trim().toLocaleLowerCase("it"), item.level]));
  const missingSkills = (entry.requiredSkills ?? []).filter((name) =>
    !skills.some((skill) => skill.name.trim().toLocaleLowerCase("it") === name.toLocaleLowerCase("it")),
  );
  const missingSkillAlternatives = (entry.requiredSkillAlternatives ?? []).filter((alternatives) =>
    !alternatives.some((name) =>
      skills.some((skill) => skill.name.trim().toLocaleLowerCase("it") === name.toLocaleLowerCase("it")),
    ),
  );
  const technologyRequirement = entry.requiredTechnologyOption;
  const technologySkill = technologyRequirement
    ? skills.find((skill) => skill.name.trim().toLocaleLowerCase("it") === "tecnologie")
    : undefined;
  const technologyDiscipline = technologyRequirement
    ? TECHNOLOGY_DISCIPLINES.find(({ key }) => key === technologyRequirement.discipline)
    : undefined;
  const allocatedTechnologyRanks = technologySkill?.technologyOptions
    ? Object.values(technologySkill.technologyOptions).reduce<number>((total, rank) => total + rank, 0)
    : 0;
  const missingTechnologyRequirement = technologyRequirement && technologyDiscipline
    ? !technologySkill
      ? `Manca il beneficio avanzato ${technologyDiscipline.label} di Tecnologie`
      : allocatedTechnologyRanks > technologySkill.level
        ? `Controlla i gradi di Tecnologie (${allocatedTechnologyRanks}/${technologySkill.level})`
        : (technologySkill.technologyOptions?.[technologyRequirement.discipline] ?? 0) < technologyRequirement.rank
          ? `Manca il beneficio avanzato ${technologyDiscipline.label} di Tecnologie`
          : ""
    : "";
  const missingOffensiveSpells = Math.max(
    0,
    (entry.requiredOffensiveSpells ?? 0) - spells.filter((spell) => spell.offensive).length,
  );
  const characterLevel = classes.reduce((total, item) => total + item.level, 0);
  if (entry.requiresMastery) {
    const mastered = entry.requiredClasses.length > 0
      ? entry.requiredClasses.filter((name) =>
        (classLevels.get(name.toLocaleLowerCase("it")) ?? 0) >= 10,
      )
      : classes.filter((item) => item.level >= 10).map((item) => item.name.trim());
    const needed = entry.masteryCount ?? 1;
    if (
      mastered.length >= needed
      && missingSkills.length === 0
      && missingSkillAlternatives.length === 0
      && !missingTechnologyRequirement
      && missingOffensiveSpells === 0
      && characterLevel >= (entry.requiredCharacterLevel ?? 0)
    ) {
      return { available: true, uncertain: false, label: `Requisiti soddisfatti: ${mastered.join(", ")}` };
    }
    return {
      available: false,
      uncertain: false,
      label: [
        mastered.length < needed
          ? entry.requiredClasses.length > 0
            ? `Richiede padroneggiare ${needed} ${needed === 1 ? "Classe" : "Classi"} tra: ${entry.requiredClasses.join(", ")}`
            : `Richiede padroneggiare almeno ${needed === 1 ? "una Classe" : `${needed} Classi`}`
          : "",
        entry.requiredCharacterLevel && characterLevel < entry.requiredCharacterLevel
          ? `Richiede livello personaggio ${entry.requiredCharacterLevel} (ora ${characterLevel})`
          : "",
        missingSkills.length > 0 ? `Manca: ${missingSkills.join(", ")}` : "",
        ...missingSkillAlternatives.map((alternatives) => `Manca una tra: ${alternatives.join(" o ")}`),
        missingTechnologyRequirement,
        missingOffensiveSpells > 0
          ? `Richiede almeno ${entry.requiredOffensiveSpells} incantesimi offensivi (ne risultano ${spells.filter((spell) => spell.offensive).length})`
          : "",
      ].filter(Boolean).join(" · "),
    };
  }

  if (missingSkills.length > 0 || missingSkillAlternatives.length > 0 || missingTechnologyRequirement) {
    const missingRequirements = [
      ...(missingSkills.length > 0 ? [`Manca: ${missingSkills.join(", ")}`] : []),
      ...missingSkillAlternatives.map((alternatives) => `Manca una tra: ${alternatives.join(" o ")}`),
      missingTechnologyRequirement,
    ];
    return { available: false, uncertain: false, label: missingRequirements.join(" · ") };
  }

  if (entry.requiredClasses.length === 0) {
    return { available: true, uncertain: false, label: "Disponibile" };
  }

  const present = entry.requiredClasses.find((name) => classLevels.has(name.toLocaleLowerCase("it")));
  return present
    ? { available: true, uncertain: false, label: `Disponibile · ${present} ${classLevels.get(present.toLocaleLowerCase("it"))}/10` }
    : { available: false, uncertain: false, label: `Richiede la Classe: ${entry.requiredClasses.join(" o ")}` };
}

export function ManualCatalogPicker({
  onSelect,
  classes,
  skills,
  spells,
}: {
  onSelect: (entry: CatalogEntry) => void;
  classes: ClassEntry[];
  skills: SkillEntry[];
  spells: SpellEntry[];
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CatalogKind | "all">("all");
  const [className, setClassName] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  // Voce con requisiti non soddisfatti in attesa di conferma: si può aggiungere lo stesso (regole della casa, materiali di terze parti).
  const [pending, setPending] = useState<{ entry: CatalogEntry; availability: Availability } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);
  const normalizedQuery = query.trim().toLocaleLowerCase("it");
  const matches = FABULA_CATALOG.map((entry) => ({ entry, availability: getAvailability(entry, classes, skills, spells) }))
    .filter(({ entry, availability }) => {
    const text = `${entry.name} ${entry.className} ${entry.requirement} ${entry.source} ${entry.summary ?? ""}`.toLocaleLowerCase("it");
    return (!normalizedQuery || text.includes(normalizedQuery))
      && (kind === "all" || entry.kind === kind)
      && (!className || entry.className === className || entry.requiredClasses.includes(className))
      && (!availableOnly || availability.available);
    });

  return (
    <details className="rounded-xl border border-line bg-panel-2">
      <summary className="cursor-pointer px-4 py-3 font-bold">Scegli dal catalogo dei manuali</summary>
      <div className="flex flex-col gap-3 border-t border-line p-4">
        <p className="text-sm text-muted">
          Tranche OCR non esaustiva, con alcuni materiali ufficiali di playtest. I promemoria sono sintetici; verifica i dettagli, i requisiti e le pagine sulla fonte indicata. La disponibilità è confrontata con le Classi e i livelli di questa scheda.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="label">Cerca</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="field" placeholder="Nome, Classe o requisito" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Categoria</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as CatalogKind | "all")} className="field">
              {CATALOG_KINDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Classe</span>
            <select value={className} onChange={(event) => setClassName(event.target.value)} className="field">
              <option value="">Tutte le Classi</option>
              {CATALOG_CLASSES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />
          Mostra solo le opzioni disponibili per questo PG
        </label>
        <p className="label">{matches.length} voci</p>
        {matches.length === 0 ? (
          <p className="text-sm italic text-muted">Nessuna voce corrisponde ai filtri.</p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {matches.map(({ entry, availability }) => (
              <li
                key={entry.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3 ${
                  !availability.available ? "bg-panel-2" : "bg-panel"
                }`}
              >
                <span>
                  <b>{entry.name}</b>
                  {entry.kind === "heroic" && (
                    <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                      Abilità Eroica
                    </span>
                  )}
                  <span className="block text-sm text-muted">
                    {entry.requirement} · {entry.source}, p. {entry.page}
                    {entry.maxRank && ` · fino a ${entry.maxRank} gradi`}
                    {entry.summary && <span className="mt-1 block text-ink">{entry.summary}</span>}
                    <span className={`block ${availability.available ? "text-accent" : availability.uncertain ? "text-muted" : "text-danger"}`}>
                      {availability.label}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => (availability.available ? onSelect(entry) : setPending({ entry, availability }))}
                >
                  {availability.available ? "Aggiungi alla scheda" : "Aggiungi comunque…"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <dialog
        ref={dialogRef}
        onClose={() => setPending(null)}
        aria-labelledby="catalog-warning-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-5 text-ink backdrop:bg-black/50"
      >
        {pending && (
          <div className="flex flex-col gap-3">
            <h3 id="catalog-warning-title" className="font-display text-xl font-bold">
              {pending.availability.uncertain ? "Requisiti da verificare" : "Requisiti non soddisfatti"}
            </h3>
            <p>
              <b>{pending.entry.name}</b>
            </p>
            <p className="text-sm text-danger">{pending.availability.label}</p>
            <p className="text-sm text-muted">
              Puoi aggiungerla lo stesso, per esempio per una regola della casa o per materiale non incluso nel catalogo.
              Se non sei sicuro, chiedi al Master.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" autoFocus onClick={() => setPending(null)}>
                Annulla
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onSelect(pending.entry);
                  setPending(null);
                }}
              >
                Aggiungi comunque
              </button>
            </div>
          </div>
        )}
      </dialog>
    </details>
  );
}
