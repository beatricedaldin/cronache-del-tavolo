import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { latestSessionNumber, listEntries } from "@/lib/data/diary";
import { listEntityNames } from "@/lib/data/compendium";
import { listThreads } from "@/lib/data/threads";
import { Composer } from "@/components/composer";
import { EntryCard } from "@/components/entry-card";
import { ThreadItem } from "@/components/thread-item";

export default function DiaryPage({ params }: PageProps<"/c/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Apro il diario…</p>}>
      <Diary params={params} />
    </Suspense>
  );
}

async function Diary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, campaign, entries, session, names, threads] = await Promise.all([
    getCurrentUser(),
    getCampaign(id),
    listEntries(id),
    latestSessionNumber(id),
    listEntityNames(id),
    listThreads(id),
  ]);
  const isGm = campaign.role === "gm";
  const open = threads.filter((t) => t.resolvedSession === null);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Composer campaignId={id} defaultSession={session} suggestions={names} />
        <section className="panel">
          {entries.length === 0 ? (
            <p className="italic text-muted">
              {isGm
                ? "Nessuno ha ancora scritto nel diario."
                : "Il tuo diario è vuoto. Scrivi cosa ricordi dell'ultima sessione."}
            </p>
          ) : (
            entries.map((e) => (
              <EntryCard key={e.id} entry={e} campaignId={id} currentUserId={user.id} showAuthor={isGm} />
            ))
          )}
        </section>
      </div>

      <aside className="panel flex flex-col">
        <h2 className="label">Fili aperti</h2>
        {open.length === 0 ? (
          <p className="mt-2 text-sm italic text-muted">Nessun filo aperto.</p>
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
      </aside>
    </div>
  );
}
