import Link from "next/link";
import { Suspense } from "react";
import { getCampaign, listMembers } from "@/lib/data/campaigns";
import { getMyCharacter, listCharacters } from "@/lib/data/characters";
import { listThreads } from "@/lib/data/threads";
import { derive } from "@/lib/fabula";
import { PrintButton } from "@/components/print-button";
import { RulesReminder, SheetView } from "@/components/sheet-view";

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
  const [character, threads] = await Promise.all([getMyCharacter(campaignId), listThreads(campaignId)]);

  if (!character) {
    return (
      <div className="panel flex flex-col items-start gap-3">
        <h2 className="font-display text-2xl font-bold">Non hai ancora un personaggio</h2>
        <p className="text-muted">Compila la scheda con calma: al tavolo la troverai qui, pronta da consultare.</p>
        <Link href={`/c/${campaignId}/scheda/modifica`} className="btn">
          Crea il personaggio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <PrintButton />
        <Link href={`/c/${campaignId}/scheda/modifica`} className="btn-ghost">
          Modifica scheda
        </Link>
      </div>
      <SheetView character={character} openThreads={threads.filter((t) => t.resolvedSession === null)} />
    </div>
  );
}

async function GmPlayers({ campaignId }: { campaignId: string }) {
  const [members, characters, threads] = await Promise.all([
    listMembers(campaignId),
    listCharacters(campaignId),
    listThreads(campaignId),
  ]);
  const players = members.filter((m) => m.role === "player");
  const byOwner = new Map(characters.map((c) => [c.ownerId, c]));

  if (players.length === 0) {
    return <p className="panel text-muted">Nessun giocatore ancora. Condividi il codice invito che vedi in alto.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {players.map((p) => {
        const c = byOwner.get(p.userId);
        if (!c) {
          return (
            <div key={p.userId} className="panel flex flex-wrap items-baseline justify-between gap-2">
              <b>{p.displayName}</b>
              <span className="italic text-muted">Non ha ancora creato il personaggio.</span>
            </div>
          );
        }
        const d = derive(c.sheet, c.level);
        return (
          <details key={p.userId} className="panel group">
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span>
                <span className="label block">{p.displayName}</span>
                <span className="font-display text-2xl font-bold">{c.name}</span>
              </span>
              <span className="text-sm text-muted">
                Liv. {d.level} · PV {d.maxHp} · PM {d.maxMp} · <b className="text-gold">{c.fabulaPoints} PF</b> · {c.bonds.length} legami
              </span>
            </summary>
            <div className="mt-5 border-t border-line pt-5">
              <SheetView
                character={c}
                openThreads={threads.filter((t) => t.ownerId === c.ownerId && t.resolvedSession === null)}
              />
            </div>
          </details>
        );
      })}
      <RulesReminder />
    </div>
  );
}
