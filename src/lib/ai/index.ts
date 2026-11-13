import "server-only";

/**
 * Accesso all'AI. Tutta l'app passa da qui, così cambiare servizio vuol dire
 * scrivere un'altra funzione `generate…` e cambiare AI_PROVIDER.
 *
 * Variabili d'ambiente (solo lato server, MAI con NEXT_PUBLIC_):
 *   GEMINI_API_KEY   chiave di Google AI Studio (obbligatoria per attivare l'AI)
 *   GEMINI_MODEL     facoltativa, default "gemini-3.5-flash-lite"
 *   AI_PROVIDER      facoltativa: "gemini" (default) oppure "finto" (risposte fisse, per i test)
 */

export type GenerateInput = {
  /** Istruzioni di ruolo e regole. */
  system: string;
  /** Il materiale e la richiesta. */
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  /** Chiede una risposta in JSON (da leggere con JSON.parse). */
  json?: boolean;
};

export type GenerateOutput = { text: string; model: string };

/** Errore da mostrare così com'è all'utente. */
export class AiError extends Error {}

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export function aiAvailable(): boolean {
  return process.env.AI_PROVIDER === "finto" || Boolean(process.env.GEMINI_API_KEY);
}

export async function generateText(input: GenerateInput): Promise<GenerateOutput> {
  const provider = process.env.AI_PROVIDER ?? "gemini";
  if (provider === "gemini") return generateWithGemini(input);
  if (provider === "finto") return generateFake(input);
  throw new AiError(`Servizio AI sconosciuto: ${provider}.`);
}

/** Legge una risposta JSON; i modelli a volte la avvolgono in ```json … ```. */
export function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new AiError("L'AI ha risposto in un formato inatteso. Riprova.");
  }
}

// --- Finto (test) ---------------------------------------------------------------
// Risposte fisse e prevedibili: servono ai test automatici, senza chiave e senza quota.

async function generateFake({ prompt, json }: GenerateInput): Promise<GenerateOutput> {
  if (json) {
    return {
      model: "finto",
      text: JSON.stringify({ tags: [{ name: "Velia", kind: "npc" }], threads: ["Chi ha mandato il messaggero?"], goals: ["Raggiungere il faro"] }),
    };
  }
  const firstLine = prompt.split("\n").find((l) => l.trim()) ?? "";
  return { model: "finto", text: `**Testo di prova dell'AI finta.**\n- Richiesta: ${firstLine.slice(0, 80)}` };
}

// --- Gemini -----------------------------------------------------------------
// Usiamo generateContent (non la Interactions API) perché non conserva le richieste
// sui server di Google: i diari passano, vengono riassunti e basta.

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
};

async function generateWithGemini({ system, prompt, maxOutputTokens = 2048, temperature = 0.6, json = false }: GenerateInput): Promise<GenerateOutput> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError("L'AI non è attiva: manca GEMINI_API_KEY nelle variabili d'ambiente.");
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens, temperature, ...(json ? { responseMimeType: "application/json" } : {}) },
      }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") throw new AiError("Gemini ci sta mettendo troppo: riprova tra poco.");
    throw new AiError("Non riesco a raggiungere Gemini. Controlla la connessione e riprova.");
  }

  const data = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    const msg = data.error?.message ?? "";
    console.error("Gemini", res.status, data.error?.status, msg);
    if (res.status === 429) {
      throw new AiError("Per ora è finita la quota gratuita di Gemini. Riprova più tardi (di solito si azzera ogni giorno).");
    }
    if (res.status === 404) throw new AiError(`Il modello «${model}» non è disponibile: cambia GEMINI_MODEL.`);
    if (res.status === 400 && /API key/i.test(msg)) throw new AiError("La chiave di Gemini non è valida: controlla GEMINI_API_KEY.");
    if (res.status === 403) throw new AiError("Gemini rifiuta la chiave: controlla che sia attiva in Google AI Studio.");
    throw new AiError("Gemini non ha risposto correttamente. Riprova tra poco.");
  }

  if (data.promptFeedback?.blockReason) {
    throw new AiError("Gemini si è rifiutato di rispondere a questo testo (filtro di sicurezza). Prova a riformulare.");
  }
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) {
    if (candidate?.finishReason === "MAX_TOKENS") throw new AiError("La risposta era troppo lunga ed è stata tagliata. Riprova.");
    throw new AiError("Gemini ha risposto senza testo. Riprova.");
  }
  return { text, model };
}
