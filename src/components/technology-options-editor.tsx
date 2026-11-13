"use client";

import {
  TECHNOLOGY_DISCIPLINES,
  TECHNOLOGY_TIERS,
  emptyTechnologyOptions,
  type TechnologyDiscipline,
  type TechnologyOptions,
} from "@/lib/fabula";

export function TechnologyOptionsEditor({
  value,
  skillLevel,
  onChange,
}: {
  value?: TechnologyOptions;
  skillLevel: number;
  onChange: (value: TechnologyOptions) => void;
}) {
  const options = value ?? emptyTechnologyOptions();
  const allocatedRanks = Object.values(options).reduce<number>((total, rank) => total + rank, 0);

  function update(discipline: TechnologyDiscipline, rank: TechnologyOptions[TechnologyDiscipline]) {
    onChange({ ...options, [discipline]: rank });
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:col-span-4">
      <legend className="label px-1">Benefici acquisiti di Tecnologie</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {TECHNOLOGY_DISCIPLINES.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="label">{label}</span>
            <select
              aria-label={`Tecnologie ${label}`}
              value={options[key]}
              onChange={(event) => {
                const tier = TECHNOLOGY_TIERS.find((option) => String(option.value) === event.target.value);
                if (tier) update(key, tier.value);
              }}
              className="field"
            >
              {TECHNOLOGY_TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>{tier.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">Gradi di disciplina registrati: {allocatedRanks} · LA Tecnologie {skillLevel}</p>
      {allocatedRanks > skillLevel && (
        <p role="alert" className="text-sm text-danger">I gradi delle discipline superano il livello di Tecnologie.</p>
      )}
    </fieldset>
  );
}
