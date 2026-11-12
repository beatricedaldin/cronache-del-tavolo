import { deleteThreadAction, toggleThreadAction } from "@/app/actions";
import type { Thread } from "@/lib/data/types";
import { InlineTags } from "./entry-body";

export function ThreadItem({
  thread,
  campaignId,
  currentUserId,
  currentSession,
  showAuthor,
  deletable = false,
}: {
  thread: Thread;
  campaignId: string;
  currentUserId: string;
  currentSession: number;
  showAuthor: boolean;
  deletable?: boolean;
}) {
  const closed = thread.resolvedSession !== null;
  const mine = thread.ownerId === currentUserId;
  const goal = thread.kind === "goal";
  const tone = goal ? "border-goal" : "border-thread";
  const fill = goal ? "bg-goal" : "bg-thread";
  const box = `mt-0.5 grid size-6 flex-none place-items-center rounded-md border-2 ${tone} text-sm font-extrabold ${
    closed ? `${fill} text-accent-ink` : ""
  }`;
  const label = goal ? (closed ? "Riapri l'obiettivo" : "Segna come raggiunto") : closed ? "Riapri il filo" : "Segna come risolto";

  return (
    <div className="group flex items-start gap-3 border-t border-line py-3 first:border-t-0">
      {mine ? (
        <form action={toggleThreadAction.bind(null, campaignId, thread.id, closed ? null : currentSession)}>
          <button type="submit" className={box} aria-label={label} title={label}>
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
          <span className={`mr-1 font-bold ${goal ? "text-goal" : "text-thread"}`}>{goal ? "!" : "?"}</span>
          <InlineTags text={thread.text} campaignId={campaignId} />
        </p>
        <p className="text-xs text-muted">
          Aperto in S{thread.openedSession}
          {showAuthor && ` · ${thread.ownerName}`}
          {closed && ` · ${goal ? "raggiunto" : "risolto"} in S${thread.resolvedSession}`}
        </p>
      </div>
      {mine && deletable && (
        <form action={deleteThreadAction.bind(null, campaignId, thread.id)}>
          <button
            type="submit"
            className="text-xs font-bold text-muted opacity-60 hover:text-danger group-hover:opacity-100"
            aria-label="Elimina"
            title="Elimina"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
