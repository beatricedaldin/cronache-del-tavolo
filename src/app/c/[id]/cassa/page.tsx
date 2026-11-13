import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CharacterEquipmentForm } from "@/components/character-equipment-form";
import { EQUIPMENT_ACQUISITIONS, EQUIPMENT_SLOTS } from "@/lib/fabula";
import { getMyCharacter } from "@/lib/data/characters";
import { getCampaign } from "@/lib/data/campaigns";
import { latestSessionNumber } from "@/lib/data/diary";

export const metadata: Metadata = { title: "Inventario PG" };

export default function ResourcesPage({ params }: PageProps<"/c/[id]/cassa">) {
  return (
    <Suspense fallback={<p className="text-muted">Carico le risorse personali…</p>}>
      <PersonalResources params={params} />
    </Suspense>
  );
}

async function PersonalResources({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [campaign, session, character] = await Promise.all([
    getCampaign(id),
    latestSessionNumber(id),
    getMyCharacter(id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Zenit ed equipaggiamento appartengono al singolo personaggio. Puoi registrare gli aggiornamenti con calma dopo la sessione.
      </p>
      {character ? (
        <>
          <section className="panel flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">{character.name}</h2>
              <p className="text-sm text-muted">Zenit personali</p>
            </div>
            <p className="font-display text-4xl font-bold text-gold">
              {character.sheet.zenit.toLocaleString("it-IT")}
              <span className="ml-2 text-base font-normal">Zenit</span>
            </p>
          </section>
          <section className="panel flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">Equipaggiamento · {character.sheet.equipment.length}</h2>
            {character.sheet.equipment.length === 0 ? (
              <p className="text-sm italic text-muted">Non hai ancora registrato oggetti.</p>
            ) : (
              <ul className="divide-y divide-line">
                {character.sheet.equipment.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="py-3 first:pt-0 last:pb-0">
                    <p className="font-bold">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</p>
                    <p className="text-sm text-muted">
                      {EQUIPMENT_SLOTS.find((slot) => slot.key === item.slot)?.label ?? item.slot}
                      {" · "}
                      {EQUIPMENT_ACQUISITIONS.find((entry) => entry.key === item.acquisition)?.label ?? item.acquisition}
                      {item.cost > 0 ? ` · ${item.cost.toLocaleString("it-IT")} Zenit` : ""}
                    </p>
                    {item.summary && <p className="mt-1 text-sm">{item.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/c/${id}/scheda/modifica`} className="btn-ghost self-start">Modifica la scheda</Link>
          </section>
          <CharacterEquipmentForm
            campaignId={id}
            characterId={character.id}
            defaultSession={session}
            personalZenit={character.sheet.zenit}
          />
        </>
      ) : (
        <section className="panel flex flex-col items-start gap-3">
          <h2 className="font-display text-xl font-bold">Nessuna scheda personale</h2>
          <p className="text-sm text-muted">
            {campaign.role === "gm"
              ? "Le risorse personali compaiono qui quando crei un tuo personaggio."
              : "Crea la tua scheda per registrare Zenit ed equipaggiamento personali."}
          </p>
          <Link href={`/c/${id}/scheda/modifica`} className="btn-ghost">
            {campaign.role === "gm" ? "Crea un personaggio" : "Crea la scheda"}
          </Link>
        </section>
      )}
    </div>
  );
}
