"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Quando qualcosa va storto in una pagina. In produzione Next non mostra il messaggio originale, quindi spieghiamo noi. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";

  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-4 px-4 py-16">
      <p className="label">Un tiro sfortunato</p>
      <h1 className="font-display text-3xl font-bold">Qualcosa è andato storto</h1>
      <p className="text-muted">
        Può capitare se la connessione è caduta o se la sessione è scaduta. Riprova; se non funziona, esci e rientra.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className="btn">
          Riprova
        </button>
        <Link href="/" className="btn-ghost">
          Torna alle campagne
        </Link>
      </div>
      {digest && <p className="font-mono text-xs text-muted">Codice: {digest}</p>}
    </main>
  );
}
