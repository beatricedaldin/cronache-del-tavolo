import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { latestSessionNumber } from "@/lib/data/diary";
import { listThreads } from "@/lib/data/threads";
import type { Thread, ThreadKind } from "@/lib/data/types";
import { ThreadForm } from "@/components/thread-form";
import { ThreadItem } from "@/components/thread-item";

export const metadata: Metadata = { title: "Fili e obiettivi" };

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

  const column = (kind: ThreadKind, title: string, hint: string, empty: string) => {
    const list = threads.filter((t) => t.kind === kind);
    const open = list.filter((t) => t.resolvedSession === null);
    const closed = list.filter((t) => t.resolvedSession !== null);
    const item = (t: Thread) => (
      <ThreadItem
        key={t.id}
        thread={t}
        campaignId={id}
        currentUserId={user.id}
        currentSession={session}
        showAuthor={isGm}
        deletable
      />
    );
    return (
      <section className="panel flex flex-col">
        <h2 className={`font-display text-xl font-bold ${kind === "goal" ? "text-goal" : "text-thread"}`}>
          {title} · {open.length} {open.length === 1 ? "aperto" : "aperti"}
        </h2>
        <p className="mb-3 text-sm text-muted">{hint}</p>
        {!isGm && <ThreadForm campaignId={id} kind={kind} session={session} />}
        {open.length ? open.map(item) : <p className="py-3 italic text-muted">{empty}</p>}
        {closed.length > 0 && (
          <details className="mt-2 border-t border-line pt-2">
            <summary className="label cursor-pointer">Chiusi · {closed.length}</summary>
            {closed.map(item)}
          </details>
        )}
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        🔒 {isGm ? "Fili e obiettivi di ogni giocatore: sono privati, li vedi solo tu." : "Sono privati: li vedete solo tu e il Master."}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {column(
          "goal",
          "Obiettivi",
          isGm ? "Quello che i giocatori vogliono ottenere." : "Quello che il tuo PG vuole ottenere. Nel diario: una riga che inizia con !",
          "Nessun obiettivo aperto.",
        )}
        {column(
          "question",
          "Fili in sospeso",
          isGm ? "Le domande aperte dei giocatori." : "Le domande senza risposta. Nel diario: una riga che inizia con ?",
          "Nessun filo aperto.",
        )}
      </div>
    </div>
  );
}
