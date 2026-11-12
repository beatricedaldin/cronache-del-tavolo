import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { latestSessionNumber } from "@/lib/data/diary";
import { listThreads } from "@/lib/data/threads";
import { ThreadItem } from "@/components/thread-item";

export default function ThreadsPage({ params }: PageProps<"/c/[id]/fili">) {
  return (
    <Suspense fallback={<p className="text-muted">Raccolgo i fili…</p>}>
      <Threads params={params} />
    </Suspense>
  );
}

async function Threads({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, campaign, threads, session] = await Promise.all([
    getCurrentUser(),
    getCampaign(id),
    listThreads(id),
    latestSessionNumber(id),
  ]);
  const isGm = campaign.role === "gm";
  const open = threads.filter((t) => t.resolvedSession === null);
  const closed = threads.filter((t) => t.resolvedSession !== null);
  const item = (t: (typeof threads)[number]) => (
    <ThreadItem
      key={t.id}
      thread={t}
      campaignId={id}
      currentUserId={user.id}
      currentSession={session}
      showAuthor={isGm}
    />
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="panel flex flex-col">
        <h2 className="font-display text-xl font-bold">Ancora aperti · {open.length}</h2>
        <p className="mb-2 text-sm text-muted">
          {isGm
            ? "Le domande aperte di tutti i giocatori."
            : "Le tue domande senza risposta. Spuntale quando le risolvi."}
        </p>
        {open.length ? open.map(item) : <p className="italic text-muted">Nessun filo aperto.</p>}
      </section>
      <section className="panel flex flex-col">
        <h2 className="label">Risolti · {closed.length}</h2>
        {closed.length ? closed.map(item) : <p className="mt-2 italic text-muted">Nessuno ancora.</p>}
      </section>
    </div>
  );
}
