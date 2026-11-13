import Link from "next/link";
import { goalText, threadText, tokenize } from "@/lib/tags";

/**
 * Testo formattato di diario, note e descrizioni.
 *   **grassetto**   *corsivo*
 *   - voce di elenco   (anche "* voce")
 *   > citazione
 *   @Personaggio  #Luogo  → link al compendio
 * Con `markers` (il diario) le righe "?" e "!" diventano fili e obiettivi.
 */
export function EntryBody({ body, campaignId, markers = true }: { body: string; campaignId: string; markers?: boolean }) {
  return <div className="flex max-w-[68ch] flex-col gap-1">{blocks(body, markers).map((b, i) => renderBlock(b, i, campaignId))}</div>;
}

type Block =
  | { type: "line"; text: string }
  | { type: "blank" }
  | { type: "thread" | "goal" | "quote"; text: string }
  | { type: "list"; items: string[] };

const LIST_RE = /^\s*[-*•]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

function blocks(body: string, markers: boolean): Block[] {
  const out: Block[] = [];
  for (const line of body.split("\n")) {
    const t = markers ? threadText(line) : null;
    const g = markers && t === null ? goalText(line) : null;
    const li = line.match(LIST_RE);
    const q = line.match(QUOTE_RE);
    const last = out[out.length - 1];
    if (t !== null) out.push({ type: "thread", text: t });
    else if (g !== null) out.push({ type: "goal", text: g });
    else if (li) {
      if (last?.type === "list") last.items.push(li[1]);
      else out.push({ type: "list", items: [li[1]] });
    } else if (q) {
      if (last?.type === "quote") last.text += `\n${q[1]}`;
      else out.push({ type: "quote", text: q[1] });
    } else if (line.trim() === "") out.push({ type: "blank" });
    else out.push({ type: "line", text: line });
  }
  return out;
}

function renderBlock(b: Block, i: number, campaignId: string) {
  switch (b.type) {
    case "blank":
      return <div key={i} className="h-2" aria-hidden />;
    case "line":
      return (
        <p key={i}>
          <RichInline text={b.text} campaignId={campaignId} />
        </p>
      );
    case "thread":
      return (
        <p key={i} className="rounded-lg bg-thread-bg px-3 py-1 font-bold text-thread">
          ? <RichInline text={b.text} campaignId={campaignId} />
        </p>
      );
    case "goal":
      return (
        <p key={i} className="rounded-lg bg-goal-bg px-3 py-1 font-bold text-goal">
          ! <RichInline text={b.text} campaignId={campaignId} />
        </p>
      );
    case "quote":
      return (
        <blockquote key={i} className="whitespace-pre-wrap border-l-4 border-line pl-3 italic text-muted">
          <RichInline text={b.text} campaignId={campaignId} />
        </blockquote>
      );
    case "list":
      return (
        <ul key={i} className="list-disc pl-6">
          {b.items.map((item, j) => (
            <li key={j}>
              <RichInline text={item} campaignId={campaignId} />
            </li>
          ))}
        </ul>
      );
  }
}

// **grassetto** oppure *corsivo* (l'asterisco non deve toccare spazi, così "3 * 4" resta com'è).
const EMPHASIS_RE = /\*\*(?=\S)(.+?)(?<=\S)\*\*|(?<![*\p{L}\p{N}])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![*\p{L}\p{N}])/gu;

/** Una riga con grassetto, corsivo e tag. */
export function RichInline({ text, campaignId }: { text: string; campaignId: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(EMPHASIS_RE)) {
    if (m.index > last) parts.push(<InlineTags key={k++} text={text.slice(last, m.index)} campaignId={campaignId} />);
    parts.push(
      m[1] !== undefined ? (
        <strong key={k++}>
          <RichInline text={m[1]} campaignId={campaignId} />
        </strong>
      ) : (
        <em key={k++}>
          <InlineTags text={m[2]} campaignId={campaignId} />
        </em>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<InlineTags key={k++} text={text.slice(last)} campaignId={campaignId} />);
  return <>{parts}</>;
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
