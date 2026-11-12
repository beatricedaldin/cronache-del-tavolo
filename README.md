# Cronache del Tavolo

Schede, diario e memoria condivisa per una campagna di Fabula Ultima.

- **Stack:** Next.js 16 (App Router, Cache Components) · React 19 · Tailwind 4 · Supabase (Auth, Postgres, RLS)
- **Package manager:** pnpm

## Regola di visibilità

- Ogni **giocatore** vede e modifica solo le proprie cose: il suo PG, i suoi legami, il suo diario, il suo compendio e i suoi fili in sospeso.
- Il **Master** vede tutto quello che scrivono tutti i giocatori della sua campagna, ma modifica solo le proprie note.

La regola è applicata dal database con Row Level Security ([supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)), non solo dall'interfaccia.

## Primo avvio

1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. In **SQL Editor** incolla ed esegui, in ordine, il contenuto di `supabase/migrations/0001_init.sql` e di `supabase/migrations/0002_grants.sql`.
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

## Sintassi del diario

| Scrivi | Diventa |
|---|---|
| `@Velia` | personaggio, con pagina nel compendio |
| `@[Mastro Odo]` | personaggio con nome di più parole |
| `#Portocielo` | luogo o fazione |
| `#[Culto del Sole]` | luogo o fazione con nome di più parole |
| `? Chi ha rubato la bussola?` | filo in sospeso, da spuntare quando è risolto |

## Struttura

```
src/
  app/                pagine e server actions (actions.ts)
    c/[id]/           campagna: diario, compendio, fili, scheda
  components/         componenti UI
  lib/
    data/             livello dati: l'UNICO punto che parla con Supabase
    supabase/         client Supabase lato server
    tags.ts           parsing di @personaggi, #luoghi e ?fili
  proxy.ts            rinnovo sessione e redirect al login
supabase/migrations/  schema del database e policy RLS
```

Le pagine e i componenti non importano mai Supabase direttamente: passano da `src/lib/data`. Per cambiare backend (PocketBase, un'API propria, Drupal per i contenuti…) basta riscrivere quel livello.

## Prossimi passi

- PWA (manifest + icone) per installarla su telefono e tablet
- Modifica delle voci di diario
- Tempo reale (Supabase Realtime) durante la sessione
- Ritratti dei PG (Supabase Storage)
- Possibilità per il Master di "rivelare" una nota a un giocatore
