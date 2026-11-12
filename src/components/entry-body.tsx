import Link from "next/link";
import { goalText, threadText, tokenize } from "@/lib/tags";

/** Testo di una voce di diario: i tag diventano link al compendio, le righe "?" e "!" vengono evidenziate. */
export function EntryBody({ body, campaignId }: { body: string; campaignId: string }) {
  return (
    <div className="max-w-[68ch] whitespace-pre-wrap">
      {body.split("\n").map((line, i) => {
        const t = threadText(line);
        const g = t === null ? goalText(line) : null;
        const content = <InlineTags text={t ?? g ?? line} campaignId={campaignId} />;
        return t !== null ? (
          <span key={i} className="my-1 block rounded-lg bg-thread-bg px-3 py-1 font-bold text-thread">
            ? {content}
          </span>
        ) : g !== null ? (
          <span key={i} className="my-1 block rounded-lg bg-goal-bg px-3 py-1 font-bold text-goal">
            ! {content}
          </span>
        ) : (
          <span key={i}>
            {content}
            {"\n"}
          </span>
        );
      })}
    </div>
  );
}

export function InlineTags({ text, campaignId }: { text: string; campaignId: string }) {
  return (
    <>
      {tokenize(text).map((s, i) =>
        s.type === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <Link
            key={i}
            href={`/c/${campaignId}/compendio/${s.kind}/${s.slug}`}
            className={
              s.kind === "npc"
                ? "rounded-md bg-npc-bg px-1.5 font-bold text-npc hover:underline"
                : "rounded-md bg-place-bg px-1.5 font-bold text-place hover:underline"
            }
          >
            {s.kind === "place" ? "⌖ " : ""}
            {s.name}
          </Link>
        ),
      )}
    </>
  );
}
