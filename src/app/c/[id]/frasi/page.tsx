import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { latestSessionNumber } from "@/lib/data/diary";
import { listQuotes } from "@/lib/data/quotes";
import { QuoteCard, QuoteForm } from "@/components/quotes";

export const metadata: Metadata = { title: "Frasi memorabili" };

export default function QuotesPage({ params }: PageProps<"/c/[id]/frasi">) {
  return (
    <Suspense fallback={<p className="text-muted">Raccolgo le frasi…</p>}>
      <Quotes params={params} />
    </Suspense>
  );
}

async function Quotes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, campaign, quotes, session] = await Promise.all([
    getCurrentUser(),
    getCampaign(id),
    listQuotes(id),
    latestSessionNumber(id),
  ]);
  const isGm = campaign.role === "gm";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-w-0 flex-col gap-4">
        {quotes.length === 0 ? (
          <p className="panel italic text-muted">
            Ancora nessuna frase memorabile. Quando qualcuno al tavolo dice qualcosa da ricordare, trascrivila qui a fine serata.
          </p>
        ) : (
          <div className="columns-1 gap-4 md:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {quotes.map((q) => (
              <QuoteCard key={q.id} campaignId={id} quote={q} mine={q.authorId === user.id} canDelete={q.authorId === user.id || isGm} />
            ))}
          </div>
        )}
      </section>
      <aside className="lg:sticky lg:top-4">
        <QuoteForm campaignId={id} defaultSession={session} />
      </aside>
    </div>
  );
}
