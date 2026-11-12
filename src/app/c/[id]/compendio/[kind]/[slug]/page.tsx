import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { getEntity } from "@/lib/data/compendium";
import { listCharacters } from "@/lib/data/characters";
import { EntryBody } from "@/components/entry-body";
import type { TagKind } from "@/lib/tags";

export default function EntityPage({ params }: PageProps<"/c/[id]/compendio/[kind]/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted">Cerco nelle note…</p>}>
      <Entity params={params} />
    </Suspense>
  );
}

async function Entity({ params }: { params: Promise<{ id: string; kind: string; slug: string }> }) {
  const { id, kind, slug } = await params;
  if (kind !== "npc" && kind !== "place") notFound();

  const [, campaign, entity, characters] = await Promise.all([
    getCurrentUser(),
    getCampaign(id),
    getEntity(id, kind as TagKind, slug),
    listCharacters(id),
  ]);
  if (!entity || entity.entries.length === 0) notFound();

  const isGm = campaign.role === "gm";
  const first = entity.entries[0].sessionNumber;
  const last = entity.entries[entity.entries.length - 1].sessionNumber;
  const lower = entity.name.toLocaleLowerCase("it");
  const bonds = characters.flatMap((c) =>
    c.bonds.filter((b) => b.target.toLocaleLowerCase("it") === lower).map((b) => ({ pg: c.name, ...b })),
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="panel flex min-w-0 flex-col gap-5">
        <div>
          <Link href={`/c/${id}/compendio`} className="label hover:text-accent">
            ← Compendio
          </Link>
          <p className={`label mt-3 ${kind === "npc" ? "text-npc" : "text-place"}`}>
            {kind === "npc" ? "Personaggio" : "Luogo / fazione"}
          </p>
          <h2 className="font-display text-4xl font-bold">{entity.name}</h2>
          <p className="text-sm text-muted">
            Prima apparizione S{first} · ultima S{last} · {entity.entries.length}{" "}
            {entity.entries.length === 1 ? "nota" : "note"}
          </p>
        </div>

        <h3 className="label">{isGm ? "Tutto quello che il gruppo ha annotato" : "Quello che hai annotato"}</h3>
        <ol className="ml-1.5 border-l-2 border-line">
          {entity.entries.map((e) => (
            <li key={e.id} className="relative pb-5 pl-5 last:pb-0">
              <span className="absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-accent bg-panel" />
              <p className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="session">S{e.sessionNumber}</span>
                {isGm && <b className="text-ink">{e.authorName}</b>}
              </p>
              <EntryBody body={e.body} campaignId={id} />
            </li>
          ))}
        </ol>
      </article>

      <aside className="panel">
        <h3 className="label">{isGm ? "Legami dei PG" : "Il tuo legame"}</h3>
        {bonds.length === 0 ? (
          <p className="mt-2 text-sm italic text-muted">Nessun legame con {entity.name}.</p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {bonds.map((b) => (
              <li key={b.id} className="flex justify-between gap-3 border-t border-dashed border-line py-2 text-sm first:border-t-0">
                <b>{b.pg}</b>
                <span className="text-right text-muted">{b.emotions.join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
