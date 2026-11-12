import "server-only";

type DbError = { message: string; code?: string };

/** Traduce gli errori di Supabase/Postgres in messaggi comprensibili. */
export function dbError(error: DbError): Error {
  const m = error.message ?? "";
  switch (error.code) {
    case "42501":
      return new Error("Non hai il permesso di farlo.");
    case "23505":
      return new Error("Esiste già.");
    case "23514":
      return new Error("Qualche campo non è valido: controlla e riprova.");
    case "23503":
      return new Error("Quello che stai cercando di collegare non esiste più.");
    case "PGRST116":
      return new Error("Non trovato.");
    case "P0001":
      // Messaggi scritti da noi nel database (raise exception '…'): sono già in italiano.
      return new Error(m);
  }
  if (/row-level security/i.test(m)) return new Error("Non hai il permesso di farlo.");
  if (/fetch failed|network|ECONN/i.test(m)) return new Error("Non riesco a raggiungere il database. Controlla la connessione e riprova.");
  if (/JWT|session/i.test(m)) return new Error("La sessione è scaduta: esci e rientra.");
  return new Error("Qualcosa è andato storto. Riprova tra poco.");
}
