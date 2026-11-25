# Cronache del Tavolo

Schede, diario e memoria condivisa per una campagna di Fabula Ultima.

- **Stack:** Next.js 16 (App Router, Cache Components) · React 19 · Tailwind 4 · Supabase (Auth, Postgres, RLS)
- **Package manager:** pnpm

## Regola di visibilità

- Ogni voce di diario e ogni nota del compendio è **privata** (default) o **pubblica**: decide chi la scrive.
  - privata: la leggono l'autore e il Master
  - pubblica: la leggono tutti i membri della campagna
- **Nome e ritratto dei PG** li vedono tutti al tavolo (striscia "Il gruppo" in cima alla campagna).
- **Frasi memorabili** le vedono tutti; **relazioni** del compendio private o pubbliche come le note.
- **Il resto della scheda, legami, fili in sospeso e obiettivi** sono sempre privati: li vedono il giocatore e il Master.
- La **scheda pubblica** di un personaggio o luogo del compendio (descrizione e immagine) la scrive solo il Master e la leggono tutti.
- Ognuno modifica solo le proprie cose, Master compreso.

La regola è applicata dal database con Row Level Security ([supabase/migrations/](supabase/migrations/)), non solo dall'interfaccia. Lo script [supabase/tests/visibilita.sql](supabase/tests/visibilita.sql) la verifica: incollalo nell'SQL Editor di Supabase ed eseguilo. Crea utenti finti, controlla chi vede cosa e poi annulla tutto. Deve rispondere `✅ TUTTI I TEST SUPERATI` (mostrato come errore: è il modo per annullare i dati di prova).

## Primo avvio

1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. In **SQL Editor** incolla ed esegui, in ordine, il contenuto dei file in `supabase/migrations/` (`0001_init.sql`, `0002_grants.sql`, `0003_scheda.sql`, …).
3. In **Authentication > Sign In / Providers > Email**: lascia attivo il provider Email e **disattiva "Confirm email"**. L'accesso è con nome utente e password e l'app non invia mai email.
4. Copia `.env.example` in `.env.local` e inserisci URL e Publishable key (**Project Settings > API Keys**).
5. Avvia:

   ```bash
   pnpm install
   pnpm dev
   ```

6. Apri http://localhost:3000 e crea un account. Chi crea una campagna ne diventa il **Master** e riceve il codice invito da passare ai giocatori. I giocatori creano il proprio account e inseriscono il codice.

   Se il tavolo non usa l'app, un giocatore può creare una **campagna personale** ("Gioco per conto mio"): vedi sotto.

> **Accesso senza email.** Supabase vuole comunque un'email: l'app la ricava dal nome utente (`nome@giocatori.cronache-del-tavolo.local`) e non la usa per inviare nulla. Non esiste "password dimenticata": la reimposta chi gestisce il progetto, da **Authentication > Users** nella dashboard di Supabase.

## Campagna personale

Per chi gioca a un tavolo dove il Master e gli altri non usano l'app.

- Dalla home, **Gioco per conto mio**: si crea una campagna di cui si è l'unico membro. Si tengono scheda, inventario, diario, fili e obiettivi, frasi e compendio (comprese le schede pubbliche di personaggi e luoghi, che altrimenti scrive il Master).
- Finché è personale il codice invito non funziona e non compare.
- Se il gruppo vuole unirsi: **Scheda PG → Apri la campagna al gruppo**. Il codice invito si attiva (non si torna indietro). Quando il vero Master è entrato, dalla pagina **Giocatori** gli si passa il ruolo: si torna giocatore e diario, scheda e note restano propri. Finché non lo si fa, il Master resta chi ha creato la campagna e vede le note private di chi entra.

Nel database chi crea la campagna personale ha il ruolo di Master: le regole di visibilità non cambiano, cambia solo quello che mostra l'app ([0017_campagna_personale.sql](supabase/migrations/0017_campagna_personale.sql)).

## Online su Vercel

1. Importa il repository GitHub su [vercel.com](https://vercel.com) (Next.js e pnpm vengono riconosciuti da soli).
2. In **Settings > Environment Variables** aggiungi `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, poi rifai il deploy.

Non serve configurare URL di redirect in Supabase: senza link via email non ci sono redirect.

**Supabase non va in pausa.** Il piano gratuito mette in pausa il progetto dopo 7 giorni senza attività. La GitHub Action [keepalive.yml](.github/workflows/keepalive.yml) lo chiama ogni 6 giorni (funzione `keepalive()`, migrazione 0019, che non restituisce dati). Va configurata una volta: in GitHub, **Settings > Secrets and variables > Actions**, aggiungi `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (gli stessi valori di `.env.local`), poi provala da **Actions > Supabase sveglio > Run workflow**. GitHub sospende le azioni pianificate dopo 60 giorni senza commit nel repository: se succede, la riattivi dalla stessa pagina.

## Scheda del personaggio

Principio: **al tavolo si consulta, a casa si compila.** Niente da aggiornare durante il gioco.

- **Scheda PG** (`/c/[id]/scheda`): sola lettura, caratteri grandi, stampabile. Tratti, caratteristiche, PV/PM/PI, Difesa, Legami con la loro forza, abilità, incantesimi, Rituali personali, equipaggiamento, fili aperti e un promemoria delle regole.
- **Prima creazione** (`/c/[id]/scheda/modifica` senza un PG): procedura guidata per concept, Classi e livelli iniziali, distribuzione delle Caratteristiche, Abilità/incantesimi ed equipaggiamento. Il catalogo permette di cercare e aggiungere le voci indicizzate, mostra gradi massimi, confronta i requisiti con Classi/livelli del PG e precompila i dati degli incantesimi leggibili nell’OCR. Per Tecnologie si possono registrare i livelli acquisiti di Alchimia, Infusione e Magitech; il filtro usa questi dati per verificare i requisiti avanzati di Magicannone Quantico e Nebulizzazione. Il flag “offensivo” è modificabile nella scheda e viene usato per il requisito di Soldato Arcano. Il catalogo include anche alcuni materiali ufficiali di playtest; le voci segnalate, i campi incompleti e i riferimenti vanno verificati sulla fonte indicata. Controlla i 5 livelli iniziali, le distribuzioni ammesse, il budget di 500 Zenit e calcola i risparmi iniziali da 2d6 × 10.
- **Test E2E**: `pnpm test:e2e:isolated` prepara un progetto Supabase temporaneo con porte e database distinti, esegue i test e lo arresta al termine; `pnpm test:e2e` resta il flusso per il progetto Supabase locale esistente.
- **Modifica scheda** (`/c/[id]/scheda/modifica` con un PG): editor libero per completare o aggiornare la scheda con calma, anche a fine sessione (PV/PM/PI attuali, Punti Fabula, PE, Zenit).
- **Registro dei progressi**: dopo aver aggiornato la scheda, annota sessione e cambiamenti; il livello e le Classi risultanti restano consultabili nella scheda e nell'esportazione.
- **Inventario PG** (`/c/[id]/cassa`): registra acquisti, ritrovamenti, ricompense e regali. Gli acquisti scalano gli Zenit personali; gli oggetti trovati o ricevuti non addebitano nulla.

Le regole (formule di PV/PM/PI, Difesa, limiti di livello e di Legami, status) stanno tutte in [src/lib/fabula.ts](src/lib/fabula.ts). Le regole di fine sessione (PE, salita di livello) non ci sono di proposito: le decide il Master. Gli avvisi della scheda non bloccano il salvataggio, per lasciare spazio alle regole della casa.

## Sintassi del diario

| Scrivi | Diventa |
|---|---|
| `@Velia` | personaggio, con pagina nel compendio |
| `@[Mastro Odo]` | personaggio con nome di più parole |
| `#Portocielo` | luogo o fazione |
| `#[Culto del Sole]` | luogo o fazione con nome di più parole |
| `? Chi ha rubato la bussola?` | filo in sospeso, da spuntare quando è risolto |
| `! Ritrovare la bussola` | obiettivo, da spuntare quando è raggiunto |
| `**grassetto**` · `*corsivo*` | formattazione (vale anche in note e descrizioni) |
| `- voce` | elenco puntato |
| `> frase` | citazione |

Scrivendo `@` o `#` compaiono i personaggi e i luoghi già noti: ↑ ↓ per scegliere, Invio o Tab per inserire.

Fili e obiettivi restano privati anche se la voce è pubblica. Si possono aggiungere anche a mano dalla pagina *Fili e obiettivi*.

## Altre funzioni

- **Modifica delle voci**: citazioni, fili e obiettivi si riallineano al nuovo testo (quelli già chiusi restano).
- **Data** su ogni voce e nota: di default oggi, si può cambiare.
- **Cronologia**: la campagna sessione per sessione (prime apparizioni, chi ritorna, fili aperti e chiusi).
- **Cerca**: in diario, compendio, note, fili, obiettivi e frasi, solo tra quello che puoi già leggere. Trova la frase esatta (anche un pezzo di nome: «Vel») e, per le domande, le singole parole in italiano con le loro varianti («chi ci ha rubato le mappe?» trova «mancavano le mappe»), con i risultati più pertinenti in cima ([0020_ricerca_italiano.sql](supabase/migrations/0020_ricerca_italiano.sql)).
- **Esporta**: scarica in Markdown tutto quello che vedi della campagna.
- **Immagini** (compendio e ritratti) in Supabase Storage, in bucket privati. Vengono ridimensionate nel browser prima del caricamento.
- **Account**: cambio password dall'app.
- **Frasi memorabili**: le citazioni dette al tavolo, visibili a tutti (chi le trascrive le modifica, il Master può toglierle). L'ultima compare accanto al diario.
- **Risorse personali**: ciascun personaggio ha i propri Zenit ed equipaggiamento. Acquisti, ritrovamenti e ricompense si registrano dopo la sessione; solo gli acquisti scalano il saldo personale.
- **Relazioni** nel compendio ("Velia → sorella di → Mastro Odo"), private o pubbliche come le note, visibili sulla pagina di entrambi.

## Struttura

```
src/
  app/                pagine e server actions (actions.ts)
    c/[id]/           campagna: diario, compendio, fili, scheda
  components/         componenti UI
  lib/
    data/             livello dati: l'UNICO punto che parla con Supabase
    supabase/         client Supabase lato server
    fabula.ts         regole di Fabula Ultima: forma della scheda e valori derivati
    tags.ts           parsing di @personaggi, #luoghi e ?fili
  proxy.ts            rinnovo sessione e redirect al login
supabase/migrations/  schema del database e policy RLS (da eseguire in ordine)
supabase/tests/       test delle regole di visibilità (da eseguire nell'SQL Editor)
```

Le pagine e i componenti non importano mai Supabase direttamente: passano da `src/lib/data`. Per cambiare backend (PocketBase, un'API propria, Drupal per i contenuti…) basta riscrivere quel livello.

## Funzioni AI (facoltative)

Con una chiave di Gemini si attivano:

- **✨ La scorsa volta…** in cima al diario: un riassunto personale dell'ultima sessione, da leggere a casa prima di giocare. Si salva (tabella `ai_recaps`) e lo vede solo chi l'ha generato.
- **✨ Cosa so di…?** nella pagina di ogni personaggio o luogo del compendio.
- **✨ In prosa** e **✨ Suggerisci tag** nel diario: dagli appunti a una pagina nella voce del tuo PG; proposte di `@`, `#`, `?` e `!` da applicare con una spunta. Niente si salva finché non premi «Salva nel diario».
- **📖 Il Libro della Campagna**: un capitolo per sessione, personale, da stampare o scaricare in Markdown.

All'AI arriva **solo quello che l'utente può già leggere** (stesse funzioni e regole RLS dell'app). Si usa `generateContent` di Gemini, che non conserva le richieste. Per attivarle:

1. Crea una chiave gratuita su [Google AI Studio](https://aistudio.google.com/apikey).
2. Aggiungi `GEMINI_API_KEY` in `.env.local` e nelle variabili d'ambiente di Vercel (**senza** `NEXT_PUBLIC_`: resta sul server).
3. Facoltativo: `GEMINI_MODEL` (default `gemini-3.5-flash-lite`).

**Limite per persona:** ognuno ha 30 richieste AI al giorno (variabile `AI_DAILY_LIMIT`), così nessuno consuma da solo la quota gratuita di tutti. Se l'AI non risponde, la richiesta non viene contata. Il contatore si vede nella pagina Account.

Il codice dell'AI è tutto in [src/lib/ai/](src/lib/ai/): per cambiare servizio basta aggiungere lì un'altra funzione.

## Test

- **Regole di visibilità (SQL):** [supabase/tests/visibilita.sql](supabase/tests/visibilita.sql), da incollare nell'SQL Editor di Supabase.
- **Tutto, con un browser vero:** `pnpm test:e2e` (serve Docker). Avvia un Supabase completo in locale, ricrea il database con tutte le migrazioni, esegue il test SQL e poi [e2e/campagna.spec.ts](e2e/campagna.spec.ts): un Master, due giocatori e un estraneo, ciascuno nel suo browser, sia in formato telefono che computer. L'AI usa un servizio finto (`AI_PROVIDER=finto`): niente chiave, niente quota. Il rapporto si apre con `pnpm exec playwright show-report`.

**Supabase locale, solo quando serve.** `pnpm db:start` lo accende, `pnpm db:stop` lo spegne (i dati restano), `pnpm db:status` mostra lo stato. I container non ripartono da soli con Docker o col Mac. `pnpm test:e2e` lo accende se serve e lo rispegne a fine test (se era già acceso, lo lascia com'è).

Gli stessi test girano da soli su GitHub a ogni push ([.github/workflows/test.yml](.github/workflows/test.yml)): se qualcosa si rompe, il commit viene segnato con ❌ e arriva un'email. Per spegnere il Supabase locale: `pnpm db:stop`.

## App sul telefono (PWA)

Si installa come un'app, con la sua icona:

- **Android (Chrome):** compare l'invito "Installa" nella pagina di accesso e in home, oppure menu ⋮ → *Installa app*.
- **iPhone/iPad (Safari):** *Condividi* → *Aggiungi alla schermata Home* (l'app lo spiega con un riquadro).

Il service worker ([public/sw.js](public/sw.js)) è volutamente minimo: **non** salva pagine in cache, perché diari e schede sono privati e il telefono potrebbe essere condiviso. Senza connessione mostra solo un messaggio chiaro. Le icone si rigenerano con `pnpm icone` ([scripts/genera-icone.mjs](scripts/genera-icone.mjs)).

## Prossimi passi

- Possibilità per il Master di "rivelare" una nota a un singolo giocatore
