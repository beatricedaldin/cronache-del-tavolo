"use client";

import { useState, useTransition } from "react";
import { writeChapterAction } from "@/app/ai-actions";
import type { Chapter } from "@/lib/data/ai";
import { EntryBody } from "./entry-body";

/** Un capitolo del Libro: già scritto (con "Riscrivi") oppure da scrivere. */
export function ChapterBlock({ campaignId, session, initial }: { campaignId: string; session: number; initial: Chapter | null }) {
  const [chapter, setChapter] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function write() {
    if (chapter && !confirm("Riscrivere il capitolo? Quello attuale verrà sostituito.")) return;
    setError(null);
    start(async () => {
      const r = await writeChapterAction(campaignId, session);
      if (r.error) setError(r.error);
      else if (r.chapter) setChapter(r.chapter);
    });
  }

  return (
    <article className="flex break-inside-avoid-page flex-col gap-3 border-t border-line py-8 first:border-t-0 first:pt-0" id={`capitolo-${session}`}>
      <p className="label">Capitolo {session}</p>
      {chapter ? (
        <>
          <h2 className="font-display text-3xl font-bold">{chapter.title}</h2>
          <div className="text-lg leading-relaxed [&_p]:indent-6 first:[&_p]:indent-0">
            <EntryBody body={chapter.content} campaignId={campaignId} markers={false} />
          </div>
        </>
      ) : (
        <p className="italic text-muted">Questo capitolo non è ancora stato scritto.</p>
      )}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button type="button" onClick={write} disabled={pending} className={chapter ? "btn-ghost" : "btn"}>
          {pending ? "Sto scrivendo il capitolo…" : chapter ? "Riscrivi" : `✨ Scrivi il capitolo ${session}`}
        </button>
        {error && <span className="text-sm font-bold text-danger">{error}</span>}
      </div>
    </article>
  );
}
