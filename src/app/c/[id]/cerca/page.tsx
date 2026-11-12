import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { search } from "@/lib/data/search";
import { formatDay } from "@/lib/dates";
import { EntryBody, InlineTags } from "@/components/entry-body";

export const metadata: Metadata = { title: "Cerca" };

export default function SearchPage({ params, searchParams }: PageProps<"/c/[id]/cerca">) {
  return (
    <Suspense fallback={<p className="text-muted">Cerco…</p>}>
      <Search params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Search({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const [user, results] = await Promise.all([getCurrentUser(), search(id, q)]);
  const total = results.entries.length + results.entities.length + results.notes.length + results.threads.length;

  return (
    <div className="flex flex-col gap-5">
      <form action={`/c/${id}/cerca`} className="flex gap-2" role="search">
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          minLength={2}
          className="field text-lg"
          placeholder="Velia, bussola, Culto del Sole…"
          aria-label="Cerca nella campagna"
        />
        <button type="submit" className="btn">
          Cerca
        </button>
      </form>

      {q.length < 2 ? (
        <p className="text-muted">Cerca in diario, compendio, note, fili e obiettivi. Trovi solo quello che puoi già leggere.</p>
      ) : total === 0 ? (
        <p className="panel text-muted">Nessun risultato per «{q}».</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            {total} {total === 1 ? "risultato" : "risultati"} per «{q}»
          </p>

          {results.entities.length > 0 && (
            <Group title="Compendio">
              <ul className="grid gap-2 sm:grid-cols-2">
                {results.entities.map((e) => (
                  <li key={`${e.kind}:${e.slug}`}>
                    <Link href={`/c/${id}/compendio/${e.kind}/${e.slug}`} className="block rounded-xl border border-line bg-panel-2 p-3 hover:border-accent">
                      <b className={e.kind === "npc" ? "text-npc" : "text-place"}>
                        {e.kind === "place" ? "⌖ " : ""}
                        {e.name}
                      </b>
                      {e.description && <p className="line-clamp-2 text-sm text-muted">{e.description}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Group>
          )}

          {results.entries.length > 0 && (
            <Group title="Diario">
              {results.entries.map((e) => (
                <div key={e.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
                  <p className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className="session">S{e.sessionNumber}</span>
                    <b className="text-ink">{e.authorId === user.id ? "Tu" : e.authorName}</b>
                    {formatDay(e.date)} {e.isPublic ? "🌍" : "🔒"}
                  </p>
                  <EntryBody body={e.body} campaignId={id} />
                </div>
              ))}
            </Group>
          )}

          {results.notes.length > 0 && (
            <Group title="Note del compendio">
              {results.notes.map((n) => (
                <div key={n.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
                  <p className="mb-1 text-sm text-muted">
                    <Link href={`/c/${id}/compendio/${n.kind}/${n.slug}`} className="font-bold text-accent hover:underline">
                      {n.name}
                    </Link>{" "}
                    · {n.ownerName} {n.isPublic ? "🌍" : "🔒"}
                  </p>
                  <p className="whitespace-pre-wrap">
                    <InlineTags text={n.body} campaignId={id} />
                  </p>
                </div>
              ))}
            </Group>
          )}

          {results.threads.length > 0 && (
            <Group title="Fili e obiettivi">
              <ul className="flex flex-col gap-1.5">
                {results.threads.map((t) => (
                  <li key={t.id} className={t.resolvedSession !== null ? "text-muted line-through" : ""}>
                    <span className={`mr-1 font-bold ${t.kind === "goal" ? "text-goal" : "text-thread"}`}>{t.kind === "goal" ? "!" : "?"}</span>
                    <InlineTags text={t.text} campaignId={id} />
                    <span className="ml-2 text-xs text-muted">S{t.openedSession}</span>
                  </li>
                ))}
              </ul>
            </Group>
          )}
        </>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel flex flex-col gap-3">
      <h2 className="label">{title}</h2>
      {children}
    </section>
  );
}
