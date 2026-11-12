"use client";

/** Ultima difesa: un errore nel layout principale. Non ha gli stili dell'app, quindi è volutamente semplice. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="it">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 520, margin: "4rem auto", padding: "0 1rem", lineHeight: 1.5 }}>
        <title>Qualcosa è andato storto · Cronache del Tavolo</title>
        <h1>Qualcosa è andato storto</h1>
        <p>L&apos;app non è riuscita a caricarsi. Controlla la connessione e riprova.</p>
        <button type="button" onClick={() => retry()} style={{ padding: "0.5rem 1.25rem", borderRadius: 999, cursor: "pointer" }}>
          Riprova
        </button>
      </body>
    </html>
  );
}
