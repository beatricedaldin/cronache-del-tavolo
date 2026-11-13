import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { latestSessionNumber } from "@/lib/data/diary";
import { getParty } from "@/lib/data/party";
import { ItemCard, ItemForm, LedgerForm, LedgerRow } from "@/components/party";

export const metadata: Metadata = { title: "Cassa e inventario" };

export default function PartyPage({ params }: PageProps<"/c/[id]/cassa">) {
  return (
    <Suspense fallback={<p className="text-muted">Conto gli Zenit…</p>}>
      <Party params={params} />
    </Suspense>
  );
}

async function Party({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, campaign, party, session] = await Promise.all([getCurrentUser(), getCampaign(id), getParty(id), latestSessionNumber(id)]);
  const isGm = campaign.role === "gm";
  const kept = party.items.filter((i) => !i.gone);
  const gone = party.items.filter((i) => i.gone);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        🌍 Cassa e inventario sono del gruppo: li vedete e li aggiornate tutti, con calma a fine serata. Gli Zenit personali restano nella scheda di ciascuno.
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="panel flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold">Cassa comune</h2>
            <p className="flex items-baseline gap-2">
              <span className={`font-display text-4xl font-bold ${party.balance < 0 ? "text-danger" : "text-gold"}`}>
                {party.balance.toLocaleString("it-IT")}
              </span>
              <span className="label">Zenit</span>
            </p>
          </div>
          <LedgerForm campaignId={id} defaultSession={session} />
          {party.ledger.length === 0 ? (
            <p className="text-sm italic text-muted">Nessun movimento ancora.</p>
          ) : (
            <ul>
              {party.ledger.map((e) => (
                <LedgerRow key={e.id} campaignId={id} entry={e} canDelete={e.authorId === user.id || isGm} />
              ))}
            </ul>
          )}
        </section>

        <section className="panel flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Inventario del gruppo · {kept.length}</h2>
          <ItemForm campaignId={id} />
          {kept.length === 0 ? (
            <p className="text-sm italic text-muted">Lo zaino comune è vuoto.</p>
          ) : (
            <ul>
              {kept.map((i) => (
                <ItemCard key={i.id} campaignId={id} item={i} canDelete={i.addedBy === user.id || isGm} />
              ))}
            </ul>
          )}
          {gone.length > 0 && (
            <details className="border-t border-line pt-2">
              <summary className="label cursor-pointer">Non ci sono più · {gone.length}</summary>
              <ul>
                {gone.map((i) => (
                  <ItemCard key={i.id} campaignId={id} item={i} canDelete={i.addedBy === user.id || isGm} />
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
