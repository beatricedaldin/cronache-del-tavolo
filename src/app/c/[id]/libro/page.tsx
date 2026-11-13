import type { Metadata } from "next";
import { Suspense } from "react";
import { aiAvailable } from "@/lib/ai";
import { getBook } from "@/lib/data/ai";
import { getCampaign } from "@/lib/data/campaigns";
import { ChapterBlock } from "@/components/book";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Il Libro della Campagna" };

export default function BookPage({ params }: PageProps<"/c/[id]/libro">) {
  return (
    <Suspense fallback={<p className="text-muted">Sfoglio il libro…</p>}>
      <Book params={params} />
    </Suspense>
  );
}

async function Book({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [campaign, book] = await Promise.all([getCampaign(id), getBook(id)]);
  const enabled = aiAvailable();
  const byNumber = new Map(book.chapters.map((c) => [c.sessionNumber, c]));
  const missing = book.sessions.filter((n) => !byNumber.has(n)).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="label">Il Libro della Campagna</p>
        <h1 className="font-display text-5xl font-bold">{campaign.name}</h1>
        <p className="max-w-xl text-muted print:hidden">
          Una cronaca narrativa, un capitolo per sessione, scritta dall&apos;AI a partire da quello che puoi leggere tu. È tua: gli altri non la vedono.
          Ogni capitolo si può riscrivere.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2 print:hidden">
          <PrintButton />
          <a href={`/c/${id}/libro/esporta`} className="btn-ghost">
            ⤓ Scarica in Markdown
          </a>
        </div>
        {missing > 0 && enabled && (
          <p className="text-sm text-muted print:hidden">
            {missing} {missing === 1 ? "capitolo da scrivere" : "capitoli da scrivere"}: scrivili uno alla volta, in ordine, così ognuno riprende dal precedente.
          </p>
        )}
      </header>

      {!enabled && book.chapters.length === 0 ? (
        <p className="panel text-muted">Il Libro si scrive con l&apos;AI, che non è attiva su questa installazione (manca GEMINI_API_KEY).</p>
      ) : book.sessions.length === 0 ? (
        <p className="panel text-muted">Il diario è ancora vuoto: il primo capitolo arriverà dopo la prima sessione.</p>
      ) : (
        <div className="panel px-6 py-8 sm:px-10">
          {book.sessions.map((n) => (
            <ChapterBlock key={n} campaignId={id} session={n} initial={byNumber.get(n) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
