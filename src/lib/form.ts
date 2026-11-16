import { revalidatePath } from "next/cache";

export type FormState = {
  error?: string;
  ok?: boolean;
  message?: string;
  /** Valori da rimettere nel form (React lo svuota dopo ogni invio). */
  values?: Record<string, string>;
  /** Cambia a ogni invio: serve a rimontare i campi con i nuovi valori. */
  at?: number;
};

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export const int = (fd: FormData, key: string, fallback: number) => {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
};

/** Una data AAAA-MM-GG valida, altrimenti null (il database usa oggi). */
export const dateOf = (fd: FormData, key = "date") => {
  const v = str(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
};

/** Numero di sessione facoltativo (1-999): vuoto = nessuna sessione. */
export function optionalSession(fd: FormData, key: string): { value: number | null } | { error: string } {
  const text = str(fd, key);
  if (!text) return { value: null };
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1 || n > 999) return { error: "Il numero della sessione deve essere compreso tra 1 e 999." };
  return { value: n };
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Qualcosa è andato storto. Riprova.");

/** Rilegge tutte le pagine della campagna dopo una modifica. */
export const revalidateCampaign = (campaignId: string) => revalidatePath(`/c/${campaignId}`, "layout");

/** Esegue una modifica senza dati da form (eliminazioni, spunte) e traduce gli errori in un messaggio da mostrare accanto al pulsante. */
export async function mutate(campaignId: string, run: () => Promise<unknown>): Promise<FormState> {
  const at = Date.now();
  try {
    await run();
  } catch (e) {
    return { error: errorMessage(e), at };
  }
  revalidateCampaign(campaignId);
  return { ok: true, at };
}
