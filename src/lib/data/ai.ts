import "server-only";
import { AiError, generateText, parseJson, type GenerateInput } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { tagSyntax, type TagKind } from "@/lib/tags";
import { dbError } from "./errors";
import { getCurrentUser } from "./auth";
import { getCampaign } from "./campaigns";
import { getMyCharacter } from "./characters";
import { getEntity, listTagNames } from "./compendium";
import { listEntries } from "./diary";
import { listQuotes } from "./quotes";
import { listThreads } from "./threads";
import { seesAsMaster, type Entry } from "./types";

/**
 * Funzioni AI. Regola d'oro: all'AI arriva SOLO quello che l'utente può già leggere.
 * Tutti i dati passano dalle stesse funzioni dell'app, quindi valgono le regole RLS.
 */

const MAX_CONTEXT_CHARS = 40_000;
/** Quante voci recenti leggere per il riassunto «La scorsa volta…». */
const RECAP_MAX_ENTRIES = 200;

// --- Limite giornaliero per persona -------------------------------------------------

/** Richieste AI al giorno per persona. Si cambia con AI_DAILY_LIMIT. */
export const aiDailyLimit = () => {
  const n = Number.parseInt(process.env.AI_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
};

/**
 * Chiama l'AI scalando una richiesta dal limite di oggi.
 * Se l'AI non risponde, la richiesta viene restituita: si paga solo quello che arriva.
 */
async function generate(input: GenerateInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("consume_ai_quota", { p_limit: aiDailyLimit() });
  if (error) throw dbError(error);
  try {
    return await generateText(input);
  } catch (e) {
    await supabase.rpc("refund_ai_quota");
    throw e;
  }
}

/** Quante richieste AI ha usato oggi l'utente collegato. */
export async function getAiUsage(): Promise<{ used: number; limit: number }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("ai_today");
  const { data: row } = await supabase.from("ai_usage").select("used").eq("user_id", user.id).eq("day", data as string).maybeSingle();
  return { used: row?.used ?? 0, limit: aiDailyLimit() };
}

const BASE_RULES = `Sei il cronista di una campagna del gioco di ruolo Fabula Ultima (fantasy in stile JRPG).
Scrivi sempre in italiano, con tono caldo e un pizzico di epica, ma chiaro.
Usa SOLO le informazioni fornite: non inventare fatti, nomi, luoghi o motivazioni. Se qualcosa non è chiaro, dillo.
Formattazione consentita: **grassetto**, *corsivo*, righe che iniziano con "- " per gli elenchi.
Non iniziare mai una riga con "?" o "!". Niente titoli con "#" a inizio riga.`;

function namesBlock(names: { kind: TagKind; name: string }[]) {
  if (names.length === 0) return "";
  return `\n\nNomi noti (quando li citi, scrivili ESATTAMENTE così, così diventano link):\n${names
    .slice(0, 150)
    .map((n) => `${tagSyntax(n.kind, n.name)} (${n.kind === "npc" ? "personaggio" : "luogo/fazione"})`)
    .join("\n")}\nPer qualsiasi altro nome non usare @ o #.`;
}

function entryBlock(e: Entry, me: string) {
  const who = e.authorId === me ? "io" : e.authorName;
  return `[Sessione ${e.sessionNumber} · scritto da ${who}]\n${e.body.trim()}`;
}

/** Tiene le voci più recenti finché ci stanno nel limite di caratteri. */
function fitEntries(entries: Entry[], me: string, budget: number) {
  const out: string[] = [];
  let used = 0;
  for (const e of entries) {
    const block = entryBlock(e, me);
    if (used + block.length > budget) break;
    out.push(block);
    used += block.length;
  }
  return out.reverse().join("\n\n");
}

// --- "La scorsa volta…" -------------------------------------------------------

export type Recap = { sessionNumber: number; content: string; createdAt: string };

/** L'ultima sessione di cui l'utente ha qualcosa da leggere. */
async function lastVisibleSession(campaignId: string) {
  // Dalla più recente: bastano le ultime voci, il contesto è comunque limitato a MAX_CONTEXT_CHARS.
  const entries = await listEntries(campaignId, { limit: RECAP_MAX_ENTRIES });
  return { entries, session: entries.reduce((max, e) => Math.max(max, e.sessionNumber), 0) };
}

export async function getMyRecap(campaignId: string): Promise<{ recap: Recap | null; session: number }> {
  const user = await getCurrentUser();
  const { session } = await lastVisibleSession(campaignId);
  if (session === 0) return { recap: null, session };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_recaps")
    .select("session_number, content, created_at")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .eq("session_number", session)
    .maybeSingle();
  if (error) throw dbError(error);
  return {
    session,
    recap: data ? { sessionNumber: data.session_number, content: data.content, createdAt: data.created_at } : null,
  };
}

export async function generateMyRecap(campaignId: string): Promise<Recap> {
  const user = await getCurrentUser();
  const [campaign, { entries, session }, threads, quotes, names] = await Promise.all([
    getCampaign(campaignId),
    lastVisibleSession(campaignId),
    listThreads(campaignId),
    listQuotes(campaignId),
    listTagNames(campaignId),
  ]);
  if (session === 0) throw new AiError("Il diario è ancora vuoto: non c'è niente da riassumere.");
  const isGm = seesAsMaster(campaign);
  const character = await getMyCharacter(campaignId);

  const thisSession = entries.filter((e) => e.sessionNumber === session);
  const earlier = entries.filter((e) => e.sessionNumber < session);
  const open = threads.filter((t) => t.resolvedSession === null && (isGm || t.ownerId === user.id));
  const sessionQuotes = quotes.filter((q) => q.sessionNumber === session);

  const viewpoint = isGm
    ? `Chi legge è il MASTER: hai le note di tutti i giocatori. Indica quando i giocatori ricordano cose diverse o hanno capito male qualcosa: al Master è utile saperlo.`
    : `Chi legge è il giocatore ${user.displayName}${character ? `, che interpreta ${character.name}` : ""}. Scrivi dal punto di vista del gruppo ma rivolgendoti a lui ("la scorsa volta avete…"). Le voci "scritto da io" sono sue.`;

  const prompt = `Prepara il riassunto «La scorsa volta…» della SESSIONE ${session}, da leggere a casa prima della prossima sessione.

${viewpoint}

Struttura:
1. Un paragrafo di 4-8 frasi che racconta la sessione ${session}.
2. **Da ricordare**: elenco di 3-6 punti (persone incontrate, indizi, promesse, oggetti).
3. **Ancora in sospeso**: elenco delle domande e degli obiettivi aperti più importanti (massimo 6). Ometti la sezione se non ce ne sono.
Massimo 300 parole in tutto.

=== DIARIO DELLA SESSIONE ${session} ===
${thisSession.map((e) => entryBlock(e, user.id)).join("\n\n")}

=== SESSIONI PRECEDENTI (solo come contesto, non riassumerle) ===
${fitEntries([...earlier].sort((a, b) => b.sessionNumber - a.sessionNumber), user.id, MAX_CONTEXT_CHARS) || "(nessuna)"}

=== FILI IN SOSPESO (domande) E OBIETTIVI APERTI ===
${open.map((t) => `${t.kind === "goal" ? "Obiettivo" : "Domanda"}: ${t.text}${isGm ? ` (di ${t.ownerName})` : ""}`).join("\n") || "(nessuno)"}

=== FRASI MEMORABILI DELLA SESSIONE ===
${sessionQuotes.map((q) => `«${q.text}» — ${q.speaker}`).join("\n") || "(nessuna)"}${namesBlock(names)}`;

  const { text, model } = await generate({ system: BASE_RULES, prompt, maxOutputTokens: 2048, temperature: 0.6 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_recaps")
    .upsert(
      { campaign_id: campaignId, user_id: user.id, session_number: session, content: text, model, created_at: new Date().toISOString() },
      { onConflict: "campaign_id,user_id,session_number" },
    );
  if (error) throw dbError(error);
  return { sessionNumber: session, content: text, createdAt: new Date().toISOString() };
}

// --- "Cosa so di Velia?" --------------------------------------------------------

export async function askAboutEntity(campaignId: string, kind: TagKind, slug: string): Promise<string> {
  const user = await getCurrentUser();
  const [campaign, entity, names] = await Promise.all([getCampaign(campaignId), getEntity(campaignId, kind, slug), listTagNames(campaignId)]);
  if (!entity) throw new AiError("Non trovo niente su questa voce.");
  const isGm = seesAsMaster(campaign);
  const character = await getMyCharacter(campaignId);
  const lower = entity.name.toLocaleLowerCase("it");
  const myBond = character?.bonds.find((b) => b.target.toLocaleLowerCase("it") === lower);

  const material = [
    entity.card?.description ? `=== SCHEDA DEL MASTER (pubblica) ===\n${entity.card.description}` : "",
    entity.notes.length
      ? `=== NOTE ===\n${entity.notes.map((n) => `[${n.ownerId === user.id ? "mia" : n.ownerName}${n.isPublic ? ", pubblica" : ", privata"}] ${n.body}`).join("\n")}`
      : "",
    entity.relations.length
      ? `=== RELAZIONI ===\n${entity.relations
          .map((r) => (r.direction === "out" ? `${entity.name} → ${r.label} → ${r.other.name}` : `${r.other.name} → ${r.label} → ${entity.name}`))
          .join("\n")}`
      : "",
    myBond ? `=== LEGAME DEL MIO PG ===\n${character!.name} ha un legame con ${entity.name}: ${myBond.emotions.join(", ")}` : "",
    entity.entries.length
      ? `=== VOCI DI DIARIO CHE LO CITANO ===\n${fitEntries([...entity.entries].reverse(), user.id, MAX_CONTEXT_CHARS)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const who = isGm ? "il Master (che conosce le note di tutti)" : `il giocatore ${user.displayName}${character ? ` (PG: ${character.name})` : ""}`;
  const prompt = `Chi chiede è ${who}. Domanda: «Cosa so di ${entity.name}?» (${kind === "npc" ? "personaggio" : "luogo o fazione"}).

Rispondi con:
1. Due o tre frasi che dicono chi o cosa è ${entity.name} e perché conta nella storia.
2. **Cosa sappiamo**: elenco di fatti concreti, in ordine di sessione quando possibile.
3. **Dubbi e misteri**: elenco di cose non chiare o contraddittorie (ometti se non ce ne sono).
Massimo 220 parole.

${material}${namesBlock(names)}`;

  const { text } = await generate({ system: BASE_RULES, prompt, maxOutputTokens: 1536, temperature: 0.4 });
  return text;
}

// --- Diario in prosa --------------------------------------------------------------

/** Trasforma appunti veloci in una pagina di diario nella voce del PG (o del narratore, per il Master). */
export async function writeProse(campaignId: string, notes: string): Promise<string> {
  await getCurrentUser();
  const clean = notes.trim();
  if (clean.length < 10) throw new AiError("Scrivi prima qualche appunto: l'AI li trasforma in prosa.");
  // getCampaign controlla che l'utente sia membro. Anche il Master può avere un PG
  // (campagna personale): se c'è, si scrive con la sua voce.
  const [, names, character] = await Promise.all([
    getCampaign(campaignId),
    listTagNames(campaignId),
    getMyCharacter(campaignId),
  ]);

  const voice = character
    ? `Scrivi in prima persona, con la voce di ${character.name}${character.identity ? ` (${character.identity})` : ""}${
        character.theme ? `, il cui tema è «${character.theme}»` : ""
      }. È il suo diario personale.`
    : `Scrivi in terza persona, come un cronista che racconta la sessione.`;

  const prompt = `Trasforma questi appunti veloci in una pagina di diario scorrevole.

${voice}

Regole importanti:
- Racconta SOLO quello che c'è negli appunti, nello stesso ordine. Non aggiungere eventi, dialoghi o dettagli inventati.
- Mantieni ESATTAMENTE i tag @Nome, @[Nome lungo], #Luogo, #[Luogo lungo] già presenti.
- Le righe che negli appunti iniziano con "?" o "!" vanno ricopiate IDENTICHE, ciascuna su una riga sua, in fondo al testo.
- Lunghezza: simile agli appunti o poco più, al massimo 250 parole di prosa.
- Rispondi solo con il testo del diario, senza titoli né commenti.

=== APPUNTI ===
${clean.slice(0, 8000)}${namesBlock(names)}`;

  const { text } = await generate({ system: BASE_RULES.replace(/Non iniziare mai una riga con "\?" o "!"\. /, ""), prompt, maxOutputTokens: 2048, temperature: 0.8 });
  return text;
}

// --- Tag suggeriti -------------------------------------------------------------------

export type TagSuggestions = {
  tags: { name: string; kind: TagKind }[];
  threads: string[];
  goals: string[];
};

/** Propone quali nomi trasformare in @ e # e quali righe segnare come fili (?) o obiettivi (!). */
export async function suggestTags(campaignId: string, text: string): Promise<TagSuggestions> {
  await getCurrentUser();
  const clean = text.trim();
  if (clean.length < 10) throw new AiError("Scrivi prima qualcosa: l'AI propone i tag sul tuo testo.");
  const names = await listTagNames(campaignId);

  const prompt = `Analizza questa voce di diario di una campagna di Fabula Ultima e proponi:
- "tags": i nomi propri di PERSONAGGI (kind "npc") e di LUOGHI o FAZIONI (kind "place") che compaiono nel testo SENZA @ o # davanti. Usa il nome esattamente come è scritto nel testo. Se un nome corrisponde a uno dei nomi noti, usa il kind del nome noto. Non includere i personaggi dei giocatori se non sono chiaramente PNG.
- "threads": domande aperte, misteri o dubbi che emergono dal testo e che non sono già righe con "?" (massimo 3, brevi, in forma di domanda).
- "goals": obiettivi o intenzioni del gruppo che emergono dal testo e che non sono già righe con "!" (massimo 3, brevi, all'infinito: "Trovare…", "Raggiungere…").
Rispondi SOLO con JSON nella forma {"tags":[{"name":"…","kind":"npc"}],"threads":["…"],"goals":["…"]}. Liste vuote se non c'è niente.

=== TESTO ===
${clean.slice(0, 8000)}

=== NOMI NOTI ===
${names.slice(0, 150).map((n) => `${n.name} (${n.kind})`).join("\n") || "(nessuno)"}`;

  const { text: raw } = await generate({ system: BASE_RULES, prompt, maxOutputTokens: 1024, temperature: 0.2, json: true });
  const data = parseJson<Partial<TagSuggestions>>(raw);
  const lower = clean.toLocaleLowerCase("it");
  const already = new Set(
    [...clean.matchAll(/[@#](?:\[([^\]\n]+)\]|([\p{L}\p{N}_']+))/gu)].map((m) => (m[1] ?? m[2]).toLocaleLowerCase("it")),
  );
  const seen = new Set<string>();
  const tags = (Array.isArray(data.tags) ? data.tags : [])
    .filter((t): t is { name: string; kind: TagKind } => typeof t?.name === "string" && (t.kind === "npc" || t.kind === "place"))
    .map((t) => ({ name: t.name.trim().slice(0, 60), kind: t.kind }))
    .filter((t) => {
      const k = t.name.toLocaleLowerCase("it");
      if (!t.name || already.has(k) || seen.has(k) || !lower.includes(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);
  const strings = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().replace(/^[?!]\s*/, "").slice(0, 200))
      .slice(0, 3);
  return { tags, threads: strings(data.threads), goals: strings(data.goals) };
}

// --- Il Libro della Campagna ------------------------------------------------------------

export type Chapter = { sessionNumber: number; title: string; content: string; createdAt: string };

/** Le sessioni che l'utente può raccontare e i capitoli che ha già scritto. */
export async function getBook(campaignId: string): Promise<{ sessions: number[]; chapters: Chapter[] }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [entries, { data, error }] = await Promise.all([
    listEntries(campaignId),
    supabase
      .from("ai_chapters")
      .select("session_number, title, content, created_at")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .order("session_number"),
  ]);
  if (error) throw dbError(error);
  return {
    sessions: [...new Set(entries.map((e) => e.sessionNumber))].sort((a, b) => a - b),
    chapters: (data ?? []).map((c) => ({ sessionNumber: c.session_number, title: c.title, content: c.content, createdAt: c.created_at })),
  };
}

export async function writeChapter(campaignId: string, session: number): Promise<Chapter> {
  const user = await getCurrentUser();
  const [campaign, entries, quotes, names, book] = await Promise.all([
    getCampaign(campaignId),
    listEntries(campaignId),
    listQuotes(campaignId),
    listTagNames(campaignId),
    getBook(campaignId),
  ]);
  const thisSession = entries.filter((e) => e.sessionNumber === session).reverse();
  if (thisSession.length === 0) throw new AiError(`Non ci sono voci che puoi leggere per la sessione ${session}.`);
  const previous = [...book.chapters].filter((c) => c.sessionNumber < session).pop();
  const isGm = seesAsMaster(campaign);

  const prompt = `Scrivi il capitolo del «Libro della Campagna» dedicato alla SESSIONE ${session}.
È una cronaca narrativa da conservare come ricordo: terza persona, tempo passato, come un romanzo fantasy leggero.

Regole:
- Racconta SOLO i fatti presenti nel diario della sessione. Puoi dare ritmo e atmosfera, ma non inventare eventi, dialoghi o nomi.
- Se le note dei giocatori si contraddicono, scegli la versione più condivisa o resta vago.
- Puoi citare le frasi memorabili, tra «».
- Lunghezza: 250-450 parole, in paragrafi.
- Prima riga: "TITOLO: " seguito da un titolo evocativo di massimo 6 parole. Poi una riga vuota e il testo.
${isGm ? "" : "- Il diario contiene solo quello che questo giocatore conosce: non riempire i vuoti."}

${previous ? `=== COME FINIVA IL CAPITOLO PRECEDENTE (sessione ${previous.sessionNumber}) ===\n${previous.content.slice(-1200)}\n` : ""}
=== DIARIO DELLA SESSIONE ${session} ===
${thisSession.map((e) => entryBlock(e, user.id)).join("\n\n")}

=== FRASI MEMORABILI ===
${quotes.filter((q) => q.sessionNumber === session).map((q) => `«${q.text}» — ${q.speaker}`).join("\n") || "(nessuna)"}${namesBlock(names)}`;

  const { text, model } = await generate({ system: BASE_RULES, prompt, maxOutputTokens: 3072, temperature: 0.85 });
  const match = text.match(/^\s*(?:\*\*)?TITOLO:\s*(.+?)(?:\*\*)?\s*$/im);
  const title = (match?.[1] ?? `Sessione ${session}`).replace(/\*\*/g, "").trim().slice(0, 80);
  const content = (match ? text.replace(match[0], "") : text).trim();

  const supabase = await createClient();
  const createdAt = new Date().toISOString();
  const { error } = await supabase
    .from("ai_chapters")
    .upsert(
      { campaign_id: campaignId, user_id: user.id, session_number: session, title, content, model, created_at: createdAt },
      { onConflict: "campaign_id,user_id,session_number" },
    );
  if (error) throw dbError(error);
  return { sessionNumber: session, title, content, createdAt };
}
