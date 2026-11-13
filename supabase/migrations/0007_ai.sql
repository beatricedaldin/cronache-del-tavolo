-- Riassunti generati con l'AI ("La scorsa volta…").
--
-- Ogni riassunto è PERSONALE: è scritto a partire da quello che quell'utente può
-- leggere (il suo diario e le voci pubbliche; il Master tutto), quindi lo vede solo lui.
-- Si salva per non rigenerarlo a ogni visita (e non consumare la quota gratuita).
-- Lo script si può rieseguire senza problemi.

create table if not exists public.ai_recaps (
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  session_number int  not null check (session_number > 0),
  content        text not null,
  model          text not null default '',
  created_at     timestamptz not null default now(),
  primary key (campaign_id, user_id, session_number)
);

alter table public.ai_recaps enable row level security;

drop policy if exists recaps_own on public.ai_recaps;
create policy recaps_own on public.ai_recaps for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(campaign_id));

grant select, insert, update, delete on public.ai_recaps to authenticated;
