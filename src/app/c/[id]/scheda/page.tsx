import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign, listMembers } from "@/lib/data/campaigns";
import { seesAsMaster } from "@/lib/data/types";
import { openCampaignAction, transferGmAction } from "@/app/actions/campaigns";
import { ConfirmForm } from "@/components/confirm-form";
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
  if (seesAsMaster(campaign)) return <GmPlayers campaignId={id} />;
  return (
    <div className="flex flex-col gap-4">
      <PlayerSheet campaignId={id} />
      {campaign.personal && <OpenCampaign campaignId={id} />}
    </div>
  );
}

/** Campagna personale: se il gruppo decide di usare l'app, la si apre e si attiva il codice invito. */
function OpenCampaign({ campaignId }: { campaignId: string }) {
  return (
    <section className="panel flex flex-col items-start gap-2 print:hidden">
      <h2 className="font-display text-xl font-bold">Il gruppo vuole usare l&apos;app?</h2>
      <p className="text-sm text-muted">
        Apri la campagna: in alto comparirà il codice invito da dare agli altri. Diario, scheda e note restano tuoi. Quando
        il Master è entrato, passagli il ruolo dalla pagina <b>Giocatori</b>: fino ad allora il Master sei tu e vedi le note
        private di chi entra.
      </p>
      <ConfirmForm
        action={openCampaignAction.bind(null, campaignId)}
        confirmMessage="Aprire la campagna al gruppo? Il codice invito comincerà a funzionare. Non si torna indietro."
        className="btn-ghost"
      >
        Apri la campagna al gruppo
      </ConfirmForm>
    </section>
  );
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
  const [user, members, characters, threads] = await Promise.all([
    getCurrentUser(),
    listMembers(campaignId),
    listCharacters(campaignId),
    listThreads(campaignId),
  ]);
  const players = members.filter((m) => m.role === "player");
  const byOwner = new Map(characters.map((c) => [c.ownerId, c]));
  // Chi ha aperto una campagna personale ha ancora il suo PG: lo ritrova qui finché non passa il ruolo.
  const mine = byOwner.get(user.id);

  const transfer = (p: (typeof players)[number]) => (
    <ConfirmForm
      action={transferGmAction.bind(null, campaignId, p.userId)}
      confirmMessage={`Passare il ruolo di Master a ${p.displayName}? Diventerai un giocatore e non vedrai più le note private degli altri.`}
      className="btn-ghost text-sm"
    >
      Passa il ruolo di Master
    </ConfirmForm>
  );

  return (
    <div className="flex flex-col gap-4">
      {mine && (
        <details className="panel group">
          <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span>
              <span className="label block">Il tuo personaggio</span>
              <span className="font-display text-2xl font-bold">{mine.name}</span>
            </span>
            <Link href={`/c/${campaignId}/scheda/modifica`} className="btn-ghost text-sm">
              Modifica scheda
            </Link>
          </summary>
          <div className="mt-5 border-t border-line pt-5">
            <SheetView
              character={mine}
              openThreads={threads.filter((t) => t.ownerId === user.id && t.resolvedSession === null)}
            />
          </div>
        </details>
      )}
      {players.length === 0 && (
        <p className="panel text-muted">Nessun giocatore ancora. Condividi il codice invito che vedi in alto.</p>
      )}
      {players.map((p) => {
        const c = byOwner.get(p.userId);
        if (!c) {
          return (
            <div key={p.userId} className="panel flex flex-wrap items-center justify-between gap-2">
              <b>{p.displayName}</b>
              <span className="italic text-muted">Non ha ancora creato il personaggio.</span>
              {transfer(p)}
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
              <div className="mb-4 flex justify-end print:hidden">{transfer(p)}</div>
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
