import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { getCampaign } from "@/lib/data/campaigns";
import { getEntity, listTagNames } from "@/lib/data/compendium";
import { listCharacters } from "@/lib/data/characters";
import { CardEditor } from "@/components/card-editor";
import { ImageUpload } from "@/components/image-upload";
import { removeEntityImageAction, setEntityImageAction } from "@/app/actions";
import { formatDay } from "@/lib/dates";
import { EntryBody } from "@/components/entry-body";
import { NoteForm, NoteItem } from "@/components/entity-notes";
import { RelationForm, RelationList } from "@/components/relations";
import { AskAbout } from "@/components/ai";
import { aiAvailable } from "@/lib/ai";
import type { TagKind } from "@/lib/tags";

export default function EntityPage({ params }: PageProps<"/c/[id]/compendio/[kind]/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted">Cerco nelle note…</p>}>
      <Entity params={params} />
    </Suspense>
  );
}

async function Entity({ params }: { params: Promise<{ id: string; kind: string; slug: string }> }) {
  const { id, kind: rawKind, slug } = await params;
  if (rawKind !== "npc" && rawKind !== "place") notFound();
  const kind = rawKind as TagKind;

  const [user, campaign, entity, characters, names] = await Promise.all([
    getCurrentUser(),
    getCampaign(id),
    getEntity(id, kind, slug),
    listCharacters(id),
    listTagNames(id),
  ]);
  if (!entity) notFound();

  const isGm = campaign.role === "gm";
  const sessions = entity.entries.map((e) => e.sessionNumber);
  const lower = entity.name.toLocaleLowerCase("it");
  const bonds = characters.flatMap((c) =>
    c.bonds.filter((b) => b.target.toLocaleLowerCase("it") === lower).map((b) => ({ pg: c.name, ...b })),
  );
  const myNotes = entity.notes.filter((n) => n.ownerId === user.id);
  const otherNotes = entity.notes.filter((n) => n.ownerId !== user.id);
  const tone = kind === "npc" ? "text-npc" : "text-place";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <article className="panel flex flex-col gap-5">
          <div>
            <Link href={`/c/${id}/compendio`} className="label hover:text-accent">
              ← Compendio
            </Link>
            <p className={`label mt-3 ${tone}`}>{kind === "npc" ? "Personaggio" : "Luogo / fazione"}</p>
            <h2 className="font-display text-4xl font-bold">{entity.name}</h2>
            {sessions.length > 0 && (
              <p className="text-sm text-muted">
                Prima apparizione S{Math.min(...sessions)} · ultima S{Math.max(...sessions)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col gap-2 sm:w-56">
              {entity.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo di Supabase Storage
                <img src={entity.image.url} alt={entity.name} className="w-full rounded-xl border border-line object-cover" />
              ) : (
                <div className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-line font-display text-5xl text-muted">
                  {entity.name.slice(0, 1)}
                </div>
              )}
              <ImageUpload
                upload={setEntityImageAction.bind(null, id, kind, slug, entity.name)}
                remove={
                  entity.image && (entity.image.uploadedBy === user.id || isGm)
                    ? removeEntityImageAction.bind(null, id, kind, slug)
                    : undefined
                }
                hasImage={Boolean(entity.image)}
              />
              {entity.image && (
                <p className="text-xs text-muted">Immagine caricata da {entity.image.uploadedBy === user.id ? "te" : entity.image.uploaderName}</p>
              )}
            </div>
            {entity.card?.description ? (
              <div className="text-lg leading-relaxed">
                <EntryBody body={entity.card.description} campaignId={id} markers={false} />
              </div>
            ) : (
              <p className="text-sm italic text-muted">{isGm ? "Scrivi qui sotto la descrizione pubblica." : "Il Master non ha ancora scritto una descrizione."}</p>
            )}
          </div>

          {isGm && <CardEditor campaignId={id} kind={kind} slug={slug} name={entity.name} card={entity.card} />}
        </article>

        <section className="panel flex flex-col gap-3">
          <h3 className="font-display text-xl font-bold">Note</h3>
          <p className="text-sm text-muted">
            Quello che sapete o pensate di {entity.name}. Ogni nota è privata o pubblica: decide chi la scrive.
          </p>
          <NoteForm campaignId={id} kind={kind} slug={slug} name={entity.name} />
          {myNotes.length > 0 && (
            <>
              <h4 className="label mt-2">Le tue note</h4>
              <ul>
                {myNotes.map((n) => (
                  <NoteItem key={n.id} campaignId={id} note={n} mine showAuthor={false} />
                ))}
              </ul>
            </>
          )}
          {otherNotes.length > 0 && (
            <>
              <h4 className="label mt-2">{isGm ? "Note dei giocatori" : "Note pubbliche degli altri"}</h4>
              <ul>
                {otherNotes.map((n) => (
                  <NoteItem key={n.id} campaignId={id} note={n} mine={false} showAuthor />
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel flex flex-col gap-3">
          <h3 className="font-display text-xl font-bold">Relazioni</h3>
          <p className="text-sm text-muted">Chi è legato a chi: parentele, alleanze, debiti, luoghi. Ogni relazione è privata o pubblica.</p>
          <RelationList
            campaignId={id}
            self={{ kind, slug, name: entity.name }}
            relations={entity.relations}
            currentUserId={user.id}
            showAuthor={isGm}
          />
          <RelationForm campaignId={id} self={{ kind, slug, name: entity.name }} names={names} />
        </section>

        <section className="panel flex flex-col gap-3">
          <h3 className="font-display text-xl font-bold">Nel diario</h3>
          {entity.entries.length === 0 ? (
            <p className="text-sm italic text-muted">Nessuna voce che puoi leggere lo cita ancora.</p>
          ) : (
            <ol className="ml-1.5 border-l-2 border-line">
              {entity.entries.map((e) => (
                <li key={e.id} className="relative pb-5 pl-5 last:pb-0">
                  <span className="absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-accent bg-panel" />
                  <p className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className="session">S{e.sessionNumber}</span>
                    <b className="text-ink">{e.authorId === user.id ? "Tu" : e.authorName}</b>
                    {formatDay(e.date)} {e.isPublic ? "🌍" : "🔒"}
                  </p>
                  <EntryBody body={e.body} campaignId={id} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-5 lg:sticky lg:top-4">
      {aiAvailable() && <AskAbout campaignId={id} kind={kind} slug={slug} name={entity.name} />}
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
    </div>
  );
}
