import { toggleThreadAction } from "@/app/actions";
import type { Thread } from "@/lib/data/types";
import { InlineTags } from "./entry-body";

export function ThreadItem({
  thread,
  campaignId,
  currentUserId,
  currentSession,
  showAuthor,
}: {
  thread: Thread;
  campaignId: string;
  currentUserId: string;
  currentSession: number;
  showAuthor: boolean;
}) {
  const closed = thread.resolvedSession !== null;
  const mine = thread.ownerId === currentUserId;
  const box = `mt-0.5 grid size-6 flex-none place-items-center rounded-md border-2 border-thread text-sm font-extrabold ${
    closed ? "bg-thread text-accent-ink" : ""
  }`;

  return (
    <div className="flex items-start gap-3 border-t border-line py-3 first:border-t-0">
      {mine ? (
        <form action={toggleThreadAction.bind(null, campaignId, thread.id, closed ? null : currentSession)}>
          <button type="submit" className={box} aria-label={closed ? "Riapri il filo" : "Segna come risolto"}>
            {closed ? "✓" : ""}
          </button>
        </form>
      ) : (
        <span className={box} aria-hidden>
          {closed ? "✓" : ""}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={closed ? "text-muted line-through" : ""}>
          <InlineTags text={thread.text} campaignId={campaignId} />
        </p>
        <p className="text-xs text-muted">
          Aperto in S{thread.openedSession}
          {showAuthor && ` · ${thread.ownerName}`}
          {closed && ` · risolto in S${thread.resolvedSession}`}
        </p>
      </div>
    </div>
  );
}
