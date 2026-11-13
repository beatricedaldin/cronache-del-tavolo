import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCampaign } from "@/lib/data/campaigns";
import { getMyCharacter } from "@/lib/data/characters";
import { removePortraitAction, setPortraitAction } from "@/app/actions";
import { BondEditor } from "@/components/bond-editor";
import { CharacterCreationWizard } from "@/components/character-creation-wizard";
import { ImageUpload } from "@/components/image-upload";
import { SheetEditor } from "@/components/sheet-editor";

export const metadata: Metadata = { title: "Modifica scheda" };

export default function EditSheetPage({ params }: PageProps<"/c/[id]/scheda/modifica">) {
  return (
    <Suspense fallback={<p className="text-muted">Apro la scheda…</p>}>
      <EditSheet params={params} />
    </Suspense>
  );
}

async function EditSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  // Il Master non ha un PG: vede le schede dei giocatori.
  if (campaign.role === "gm") redirect(`/c/${id}/scheda`);

  const character = await getMyCharacter(id);
  return (
    <div className={character ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]" : ""}>
      {character ? <SheetEditor campaignId={id} character={character} /> : <CharacterCreationWizard campaignId={id} />}
      {character && (
        <div className="flex flex-col gap-5 lg:sticky lg:top-4">
          <section className="panel flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">Ritratto</h2>
            <div className="flex items-center gap-4">
              {character.portraitUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo di Supabase Storage
                <img src={character.portraitUrl} alt="" className="size-24 rounded-2xl border border-line object-cover" />
              ) : (
                <div className="grid size-24 place-items-center rounded-2xl border border-dashed border-line font-display text-3xl text-muted">
                  {character.name.slice(0, 1)}
                </div>
              )}
              <ImageUpload
                upload={setPortraitAction.bind(null, id)}
                remove={removePortraitAction.bind(null, id)}
                hasImage={Boolean(character.portraitPath)}
                label="Carica ritratto"
              />
            </div>
            <p className="text-xs text-muted">Lo vedono tutti al tavolo, insieme al nome del PG. Il resto della scheda resta tra te e il Master.</p>
          </section>
          <BondEditor campaignId={id} characterId={character.id} bonds={character.bonds} />
        </div>
      )}
    </div>
  );
}
