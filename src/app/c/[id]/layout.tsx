import Link from "next/link";
import { Suspense } from "react";
import { getCampaign } from "@/lib/data/campaigns";
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
    <header className="flex flex-col gap-4 border-b border-line pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="label hover:text-accent">
            ← Le tue campagne
          </Link>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{campaign.name}</h1>
          <p className={`label mt-1 ${isGm ? "text-gold" : ""}`}>
            {isGm ? "Sei il Master: vedi le note di tutti" : "Giocatore: vedi solo le tue note"}
          </p>
        </div>
        {campaign.inviteCode && (
          <div className="flex flex-col items-end gap-1">
            <span className="label">Codice invito</span>
            <span className="select-all rounded-lg border border-dashed border-accent bg-panel-2 px-3 py-1 font-mono text-lg tracking-widest">
              {campaign.inviteCode}
            </span>
          </div>
        )}
      </div>
      <CampaignNav campaignId={campaign.id} role={campaign.role} />
    </header>
  );
}
