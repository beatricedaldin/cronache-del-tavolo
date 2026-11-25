import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { latestSessionNumber, listEntriesPage } from "@/lib/data/diary";
import { listEntityNames } from "@/lib/data/compendium";
import { listThreads } from "@/lib/data/threads";
import { listQuotes } from "@/lib/data/quotes";
import { QuoteCard } from "@/components/quotes";
import { RecapCard } from "@/components/ai";
import { aiAvailable } from "@/lib/ai";
import { getMyRecap } from "@/lib/data/ai";
import { Composer } from "@/components/composer";
import { EntryCard } from "@/components/entry-card";
import { SyntaxLegend } from "@/components/syntax-legend";
import { ThreadItem } from "@/components/thread-item";

const PAGE_SIZE = 30;
const MAX_ENTRIES = 600;

export default function DiaryPage({ params, searchParams }: PageProps<"/c/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Apro il diario…</p>}>
      <Diary params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Diary({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Quante voci mostrare: si parte da PAGE_SIZE e "Mostra altre voci" le aumenta (?voci=60, 90…).
  const asked = Number.parseInt(typeof sp.voci === "string" ? sp.voci : "", 10);
  const shown = Number.isFinite(asked) ? Math.min(MAX_ENTRIES, Math.max(PAGE_SIZE, asked)) : PAGE_SIZE;
  const [user, campaign, { entries, hasMore }, session, names, threads, quotes] = await Promise.all([
    getCurrentUser(),
    getCampaign(id),
    listEntriesPage(id, shown),
    latestSessionNumber(id),
    listEntityNames(id),
    listThreads(id),
    listQuotes(id, 1),
  ]);
  const isGm = campaign.role === "gm";
  const open = threads.filter((t) => t.resolvedSession === null);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        {aiAvailable() && entries.length > 0 && (
          <Suspense fallback={null}>
            <Recap campaignId={id} />
          </Suspense>
        )}
        <Composer campaignId={id} defaultSession={session} suggestions={names} aiEnabled={aiAvailable()} />
        <section className="panel">
          {entries.length === 0 ? (
            <p className="italic text-muted">
              {campaign.personal
                ? "Il diario è vuoto. Scrivi cosa ricordi dell'ultima sessione: resta qui per te."
                : isGm
                  ? "Nessuno ha ancora scritto nel diario."
                  : "Il diario è vuoto. Scrivi cosa ricordi dell'ultima sessione: le voci pubbliche le leggerà tutto il gruppo."}
            </p>
          ) : (
            entries.map((e) => (
              <EntryCard key={e.id} entry={e} campaignId={id} currentUserId={user.id} showAuthor={isGm} />
            ))
          )}
          {hasMore && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {shown < MAX_ENTRIES ? (
                <Link href={`/c/${id}?voci=${shown + PAGE_SIZE}`} scroll={false} className="btn-ghost">
                  Mostra altre voci
                </Link>
              ) : null}
              <span className="text-sm text-muted">
                {shown < MAX_ENTRIES
                  ? `Stai vedendo le ${entries.length} più recenti.`
                  : `Stai vedendo le ${entries.length} più recenti. Per il resto usa Cerca o Esporta.`}
              </span>
            </div>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-5 lg:sticky lg:top-4">
        <SyntaxLegend className="hidden lg:flex" />
        {quotes[0] && (
          <div className="flex flex-col gap-2">
            <h2 className="label">L&apos;ultima frase memorabile</h2>
            <QuoteCard
              campaignId={id}
              quote={quotes[0]}
              mine={quotes[0].authorId === user.id}
              canDelete={quotes[0].authorId === user.id || isGm}
            />
            <Link href={`/c/${id}/frasi`} className="btn-ghost self-start">
              Tutte le frasi
            </Link>
          </div>
        )}
        <div className="panel flex flex-col">
        <h2 className="label">Fili e obiettivi aperti</h2>
        {open.length === 0 ? (
          <p className="mt-2 text-sm italic text-muted">Niente di aperto.</p>
        ) : (
          open
            .slice(0, 6)
            .map((t) => (
              <ThreadItem
                key={t.id}
                thread={t}
                campaignId={id}
                currentUserId={user.id}
                currentSession={session}
                showAuthor={isGm}
              />
            ))
        )}
        <Link href={`/c/${id}/fili`} className="btn-ghost mt-3 self-start">
          Vedi tutti
        </Link>
        </div>
      </aside>
    </div>
  );
}

async function Recap({ campaignId }: { campaignId: string }) {
  const { recap, session } = await getMyRecap(campaignId);
  if (session === 0) return null;
  return <RecapCard campaignId={campaignId} session={session} initial={recap} />;
}
