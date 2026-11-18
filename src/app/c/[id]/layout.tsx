import Link from "next/link";
import { Suspense } from "react";
import { getCampaign, listParty } from "@/lib/data/campaigns";
import { CampaignNav } from "@/components/campaign-nav";

export default function CampaignLayout({ children, params }: LayoutProps<"/c/[id]">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
      <Suspense fallback={<HeaderSkeleton />}>
        <CampaignHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

function HeaderSkeleton() {
  return <div className="h-28 border-b border-line" aria-hidden />;
}

async function CampaignHeader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  const isGm = campaign.role === "gm";

  return (
    <header className="flex flex-col gap-4 rule-gold pb-4 print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="label hover:text-accent">
            ← Le tue campagne
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-wide sm:text-4xl">{campaign.name}</h1>
          <p className={`label mt-1 ${isGm ? "text-gold" : ""}`}>
            {isGm ? "Sei il Master: vedi le note di tutti" : "Giocatore: vedi solo le tue note"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {campaign.inviteCode && (
            <div className="flex flex-col items-end gap-1">
              <span className="label">Codice invito</span>
              <span className="select-all rounded-lg border border-dashed border-accent bg-panel-2 px-3 py-1 font-mono text-lg tracking-widest">
                {campaign.inviteCode}
              </span>
            </div>
          )}
          <div className="flex gap-2 text-sm">
            {/* Un link normale, non <Link>: è un file da scaricare, non una pagina. */}
            <a href={`/c/${campaign.id}/esporta`} className="btn-ghost" title="Scarica in Markdown tutto quello che puoi vedere">
              ⤓ Esporta
            </a>
            <Link href="/account" className="btn-ghost">
              Account
            </Link>
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        <Party campaignId={campaign.id} />
      </Suspense>
      <CampaignNav campaignId={campaign.id} role={campaign.role} />
    </header>
  );
}

/** Il gruppo: ritratto e nome di ogni PG, visibili a tutti. */
async function Party({ campaignId }: { campaignId: string }) {
  const party = await listParty(campaignId);
  if (party.length === 0) return null;
  return (
    <ul className="-mx-1 flex gap-3 overflow-x-auto px-1" aria-label="Il gruppo">
      {party.map((p) => (
        <li key={p.userId} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3">
          {p.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo di Supabase Storage
            <img src={p.portraitUrl} alt="" className="size-9 rounded-full object-cover" />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-panel-2 font-display text-lg text-muted">
              {(p.characterName ?? p.displayName).slice(0, 1)}
            </span>
          )}
          <span className="flex flex-col leading-tight">
            <b className="text-sm">{p.characterName ?? <span className="font-normal italic text-muted">senza PG</span>}</b>
            <span className="text-xs text-muted">{p.displayName}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
