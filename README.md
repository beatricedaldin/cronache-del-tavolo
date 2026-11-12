# Cronache del Tavolo

Schede, diario e memoria condivisa per una campagna di Fabula Ultima.

- **Stack:** Next.js 16 (App Router, Cache Components) · React 19 · Tailwind 4 · Supabase (Auth, Postgres, RLS)
- **Package manager:** pnpm

## Regola di visibilità

- Ogni voce di diario e ogni nota del compendio è **privata** (default) o **pubblica**: decide chi la scrive.
  - privata: la leggono l'autore e il Master
  - pubblica: la leggono tutti i membri della campagna
- **Nome e ritratto dei PG** li vedono tutti al tavolo (striscia "Il gruppo" in cima alla campagna).
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

> **Accesso senza email.** Supabase vuole comunque un'email: l'app la ricava dal nome utente (`nome@giocatori.cronache-del-tavolo.local`) e non la usa per inviare nulla. Non esiste "password dimenticata": la reimposta chi gestisce il progetto, da **Authentication > Users** nella dashboard di Supabase.

## Online su Vercel

1. Importa il repository GitHub su [vercel.com](https://vercel.com) (Next.js e pnpm vengono riconosciuti da soli).
2. In **Settings > Environment Variables** aggiungi `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, poi rifai il deploy.

Non serve configurare URL di redirect in Supabase: senza link via email non ci sono redirect.

## Scheda del personaggio

Principio: **al tavolo si consulta, a casa si compila.** Niente da aggiornare durante il gioco.

- **Scheda PG** (`/c/[id]/scheda`): sola lettura, caratteri grandi, stampabile. Tratti, caratteristiche, PV/PM/PI, Difesa, Legami con la loro forza, abilità, incantesimi, equipaggiamento, fili aperti e un promemoria delle regole.
- **Modifica scheda** (`/c/[id]/scheda/modifica`): si compila con calma, anche a fine sessione (PV/PM/PI attuali, Punti Fabula, PE, Zenit).

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

Fili e obiettivi restano privati anche se la voce è pubblica. Si possono aggiungere anche a mano dalla pagina *Fili e obiettivi*.

## Altre funzioni

- **Modifica delle voci**: citazioni, fili e obiettivi si riallineano al nuovo testo (quelli già chiusi restano).
- **Data** su ogni voce e nota: di default oggi, si può cambiare.
- **Cronologia**: la campagna sessione per sessione (prime apparizioni, chi ritorna, fili aperti e chiusi).
- **Cerca**: in diario, compendio, note, fili e obiettivi, solo tra quello che puoi già leggere.
- **Esporta**: scarica in Markdown tutto quello che vedi della campagna.
- **Immagini** (compendio e ritratti) in Supabase Storage, in bucket privati. Vengono ridimensionate nel browser prima del caricamento.
- **Account**: cambio password dall'app.

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

## Prossimi passi

- PWA (manifest + icone) per installarla su telefono e tablet
- Possibilità per il Master di "rivelare" una nota a un singolo giocatore
