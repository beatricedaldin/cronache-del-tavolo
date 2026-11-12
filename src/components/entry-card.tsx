import { deleteEntryAction } from "@/app/actions";
import type { Entry } from "@/lib/data/types";
import { EntryBody } from "./entry-body";

export function EntryCard({
  entry,
  campaignId,
  currentUserId,
  showAuthor,
}: {
  entry: Entry;
  campaignId: string;
  currentUserId: string;
  showAuthor: boolean;
}) {
  const mine = entry.authorId === currentUserId;
  const date = new Date(entry.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

  return (
    <article className="flex flex-col gap-2 border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="session">S{entry.sessionNumber}</span>
        {showAuthor && <span className="font-extrabold text-ink">{entry.authorName}</span>}
        <span>{date}</span>
        {mine && (
          <form action={deleteEntryAction.bind(null, campaignId, entry.id)} className="ml-auto">
            <button className="text-xs font-bold text-muted hover:text-danger" type="submit">
              Elimina
            </button>
          </form>
        )}
      </div>
      <EntryBody body={entry.body} campaignId={campaignId} />
    </article>
  );
}
