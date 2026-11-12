import { Suspense } from "react";
import { addBondAction, deleteBondAction } from "@/app/actions";
import { getCampaign, listMembers } from "@/lib/data/campaigns";
import { getMyCharacter, listCharacters } from "@/lib/data/characters";
import type { Character } from "@/lib/data/types";
import { CharacterForm } from "@/components/character-form";
import { SubmitButton } from "@/components/submit-button";

// Le coppie di emozioni dei Legami di Fabula Ultima.
const EMOTIONS = [
  ["Ammirazione", "Inferiorità"],
  ["Lealtà", "Sfiducia"],
  ["Affetto", "Odio"],
];

export default function SheetPage({ params }: PageProps<"/c/[id]/scheda">) {
  return (
    <Suspense fallback={<p className="text-muted">Apro la scheda…</p>}>
      <Sheet params={params} />
    </Suspense>
  );
}

async function Sheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  return campaign.role === "gm" ? <GmPlayers campaignId={id} /> : <PlayerSheet campaignId={id} />;
}

async function PlayerSheet({ campaignId }: { campaignId: string }) {
  const character = await getMyCharacter(campaignId);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <CharacterForm campaignId={campaignId} character={character} />
      <section className="panel flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">Legami</h2>
        {!character ? (
          <p className="text-sm italic text-muted">Salva prima la scheda, poi aggiungi i legami.</p>
        ) : (
          <>
            <BondList campaignId={campaignId} character={character} editable />
            <form action={addBondAction.bind(null, campaignId, character.id)} className="flex flex-col gap-3 border-t border-line pt-3">
              <input name="target" required className="field" placeholder="Verso chi? Es. Velia" aria-label="Verso chi" />
              <fieldset className="flex flex-col gap-1.5 text-sm">
                <legend className="label mb-1">Emozioni (una per coppia)</legend>
                {EMOTIONS.map(([a, b]) => (
                  <div key={a} className="flex flex-wrap gap-4">
                    {[a, b].map((e) => (
                      <label key={e} className="flex items-center gap-1.5">
                        <input type="checkbox" name="emotions" value={e} className="accent-accent" />
                        {e}
                      </label>
                    ))}
                  </div>
                ))}
              </fieldset>
              <SubmitButton className="btn-ghost self-start">Aggiungi legame</SubmitButton>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

async function GmPlayers({ campaignId }: { campaignId: string }) {
  const [members, characters] = await Promise.all([listMembers(campaignId), listCharacters(campaignId)]);
  const players = members.filter((m) => m.role === "player");
  const byOwner = new Map(characters.map((c) => [c.ownerId, c]));

  if (players.length === 0) {
    return <p className="panel text-muted">Nessun giocatore ancora. Condividi il codice invito che vedi in alto.</p>;
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {players.map((p) => {
        const c = byOwner.get(p.userId);
        return (
          <li key={p.userId} className="panel flex flex-col gap-2">
            <span className="label">{p.displayName}</span>
            {c ? (
              <>
                <span className="font-display text-2xl font-bold">{c.name}</span>
                <span className="text-sm text-muted">
                  {c.classes || "Classi non indicate"} · Liv. {c.level} · {c.fabulaPoints} Punti Fabula
                </span>
                {(c.identity || c.theme || c.origin) && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                    {c.identity && (<><dt className="text-muted">Identità</dt><dd>{c.identity}</dd></>)}
                    {c.theme && (<><dt className="text-muted">Tema</dt><dd>{c.theme}</dd></>)}
                    {c.origin && (<><dt className="text-muted">Origine</dt><dd>{c.origin}</dd></>)}
                  </dl>
                )}
                <BondList campaignId={campaignId} character={c} />
                {c.notes && <p className="whitespace-pre-wrap border-t border-line pt-2 text-sm">{c.notes}</p>}
              </>
            ) : (
              <span className="italic text-muted">Non ha ancora creato il personaggio.</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BondList({ campaignId, character, editable = false }: { campaignId: string; character: Character; editable?: boolean }) {
  if (character.bonds.length === 0) return <p className="text-sm italic text-muted">Nessun legame.</p>;
  return (
    <ul className="flex flex-col">
      {character.bonds.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 border-t border-dashed border-line py-2 text-sm first:border-t-0">
          <b>{b.target}</b>
          <span className="flex items-center gap-3 text-right text-muted">
            {b.emotions.join(" · ")}
            {editable && (
              <form action={deleteBondAction.bind(null, campaignId, b.id)}>
                <button type="submit" className="text-xs font-bold hover:text-danger" aria-label={`Rimuovi legame con ${b.target}`}>
                  ✕
                </button>
              </form>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
