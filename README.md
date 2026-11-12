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
2. In **SQL Editor** incolla ed esegui `supabase/migrations/0001_init.sql`.
3. In **Authentication > URL Configuration** imposta:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
4. Copia `.env.example` in `.env.local` e inserisci URL e Publishable key (**Project Settings > API Keys**).
5. Avvia:

   ```bash
   pnpm install
   pnpm dev
   ```

6. Apri http://localhost:3000, accedi con il link via email, crea la campagna e passa il codice invito ai giocatori.

> Il servizio email integrato di Supabase ha un limite basso di invii orari, sufficiente per un gruppo piccolo. Per usi più intensi conviene configurare un SMTP (Authentication > Emails).

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
