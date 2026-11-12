import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { getTimeline, type TimelineEntity } from "@/lib/data/timeline";
import type { Thread } from "@/lib/data/types";
import { formatDay } from "@/lib/dates";
import { EntryBody, InlineTags } from "@/components/entry-body";

export const metadata: Metadata = { title: "Cronologia" };

export default function TimelinePage({ params }: PageProps<"/c/[id]/cronologia">) {
  return (
    <Suspense fallback={<p className="text-muted">Ripercorro le sessioni…</p>}>
      <Timeline params={params} />
    </Suspense>
  );
}

async function Timeline({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, campaign, sessions] = await Promise.all([getCurrentUser(), getCampaign(id), getTimeline(id)]);
  const isGm = campaign.role === "gm";

  if (sessions.length === 0) {
    return <p className="panel text-muted">La cronologia si costruisce dal diario: scrivi la prima voce e comparirà qui.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        La campagna sessione per sessione, dalla più recente.{" "}
        {isGm ? "Vedi le voci di tutti." : "Vedi le tue voci e quelle pubbliche degli altri; fili e obiettivi sono solo i tuoi."}
      </p>
      <ol className="relative ml-3 flex flex-col gap-6 border-l-2 border-line">
        {sessions.map((s) => (
          <li key={s.number} className="relative pl-6">
            <span className="absolute -left-[13px] top-0 grid size-6 place-items-center rounded-full border-2 border-accent bg-panel font-mono text-xs font-bold">
              {s.number}
            </span>
            <details className="panel group" open={s === sessions[0]}>
              <summary className="cursor-pointer">
                <span className="font-display text-2xl font-bold">Sessione {s.number}</span>
                <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>
                    {s.entries.length} {s.entries.length === 1 ? "voce" : "voci"}
                  </span>
                  {s.firstAppearances.length > 0 && <span>✦ {s.firstAppearances.length} nuovi incontri</span>}
                  {s.opened.length > 0 && <span>{s.opened.length} aperti</span>}
                  {s.closed.length > 0 && <span>✓ {s.closed.length} chiusi</span>}
                </span>
              </summary>

              <div className="mt-4 flex flex-col gap-4">
                {s.firstAppearances.length > 0 && (
                  <Chips title="Prima apparizione" campaignId={id} entities={s.firstAppearances} />
                )}
                {s.mentioned.length > s.firstAppearances.length && (
                  <Chips
                    title="Ritornano"
                    campaignId={id}
                    entities={s.mentioned.filter((m) => !s.firstAppearances.some((f) => f.kind === m.kind && f.slug === m.slug))}
                  />
                )}
                {(s.opened.length > 0 || s.closed.length > 0) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ThreadList title="Aperti" threads={s.opened} campaignId={id} showAuthor={isGm} />
                    <ThreadList title="Chiusi" threads={s.closed} campaignId={id} showAuthor={isGm} />
                  </div>
                )}
                {s.entries.length > 0 && (
                  <div className="flex flex-col gap-3 border-t border-line pt-3">
                    <h4 className="label">Dal diario</h4>
                    {s.entries.map((e) => (
                      <div key={e.id}>
                        <p className="mb-1 text-sm text-muted">
                          <b className="text-ink">{e.authorId === user.id ? "Tu" : e.authorName}</b> {formatDay(e.date)} {e.isPublic ? "🌍" : "🔒"}
                        </p>
                        <EntryBody body={e.body} campaignId={id} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Chips({ title, campaignId, entities }: { title: string; campaignId: string; entities: TimelineEntity[] }) {
  return (
    <div>
      <h4 className="label mb-1.5">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {entities.map((e) => (
          <Link
            key={`${e.kind}:${e.slug}`}
            href={`/c/${campaignId}/compendio/${e.kind}/${e.slug}`}
            className={`rounded-md px-2 py-0.5 text-sm font-bold hover:underline ${
              e.kind === "npc" ? "bg-npc-bg text-npc" : "bg-place-bg text-place"
            }`}
          >
            {e.kind === "place" ? "⌖ " : ""}
            {e.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ThreadList({ title, threads, campaignId, showAuthor }: { title: string; threads: Thread[]; campaignId: string; showAuthor: boolean }) {
  if (threads.length === 0) return <div />;
  return (
    <div>
      <h4 className="label mb-1.5">{title}</h4>
      <ul className="flex flex-col gap-1 text-sm">
        {threads.map((t) => (
          <li key={t.id} className="flex gap-2">
            <span className={`font-bold ${t.kind === "goal" ? "text-goal" : "text-thread"}`}>{t.kind === "goal" ? "!" : "?"}</span>
            <span>
              <InlineTags text={t.text} campaignId={campaignId} />
              {showAuthor && <span className="text-muted"> · {t.ownerName}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
