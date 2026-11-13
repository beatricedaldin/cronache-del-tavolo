-- Cassa e inventario del gruppo, Libro della Campagna.
--
--   * cassa (movimenti di Zenit) e inventario del gruppo: li vedono e li aggiornano
--     TUTTI i membri della campagna (sono del gruppo); cancellare un movimento o un
--     oggetto può farlo chi l'ha inserito oppure il Master
--   * capitoli del Libro della Campagna: come i riassunti AI, sono PERSONALI
--     (scritti da quello che quell'utente può leggere) e li vede solo lui
--
-- Lo script si può rieseguire senza problemi.

-- ---------------------------------------------------------------------------
-- Cassa del gruppo: un registro di entrate e uscite
-- ---------------------------------------------------------------------------
create table if not exists public.party_ledger (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete cascade,
  amount         int  not null check (amount <> 0 and abs(amount) <= 10000000),
  reason         text not null check (length(trim(reason)) > 0),
  session_number int  check (session_number is null or session_number > 0),
  entry_date     date not null default current_date,
  created_at     timestamptz not null default now()
);
create index if not exists party_ledger_campaign_idx on public.party_ledger (campaign_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- Inventario del gruppo
-- ---------------------------------------------------------------------------
create table if not exists public.party_items (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  added_by    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  description text not null default '',
  quantity    int  not null default 1 check (quantity >= 0),
  holder      text not null default '',
  gone        boolean not null default false,
  gone_note   text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists party_items_campaign_idx on public.party_items (campaign_id, gone, name);

alter table public.party_ledger enable row level security;
alter table public.party_items enable row level security;

drop policy if exists ledger_select on public.party_ledger;
drop policy if exists ledger_insert on public.party_ledger;
drop policy if exists ledger_delete on public.party_ledger;
create policy ledger_select on public.party_ledger for select using (public.is_member(campaign_id));
create policy ledger_insert on public.party_ledger for insert
  with check (author_id = auth.uid() and public.is_member(campaign_id));
create policy ledger_delete on public.party_ledger for delete
  using (author_id = auth.uid() or public.is_gm(campaign_id));

drop policy if exists items_select on public.party_items;
drop policy if exists items_insert on public.party_items;
drop policy if exists items_update on public.party_items;
drop policy if exists items_delete on public.party_items;
create policy items_select on public.party_items for select using (public.is_member(campaign_id));
create policy items_insert on public.party_items for insert
  with check (added_by = auth.uid() and public.is_member(campaign_id));
-- L'inventario è di tutti: chiunque nel gruppo può aggiornarlo (chi lo porta, quantità…).
create policy items_update on public.party_items for update
  using (public.is_member(campaign_id)) with check (public.is_member(campaign_id));
create policy items_delete on public.party_items for delete
  using (added_by = auth.uid() or public.is_gm(campaign_id));

-- Chi ha aggiunto l'oggetto resta lo stesso anche se altri lo aggiornano.
create or replace function public.keep_item_author()
returns trigger language plpgsql set search_path = public as $$
begin
  new.added_by := old.added_by;
  new.campaign_id := old.campaign_id;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists party_items_keep_author on public.party_items;
create trigger party_items_keep_author
  before update on public.party_items
  for each row execute function public.keep_item_author();

-- ---------------------------------------------------------------------------
-- Il Libro della Campagna: un capitolo per sessione, personale
-- ---------------------------------------------------------------------------
create table if not exists public.ai_chapters (
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  session_number int  not null check (session_number > 0),
  title          text not null default '',
  content        text not null,
  model          text not null default '',
  created_at     timestamptz not null default now(),
  primary key (campaign_id, user_id, session_number)
);

alter table public.ai_chapters enable row level security;

drop policy if exists chapters_own on public.ai_chapters;
create policy chapters_own on public.ai_chapters for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(campaign_id));

-- ---------------------------------------------------------------------------
-- Permessi: solo utenti collegati
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.party_ledger to authenticated;
grant select, insert, update, delete on public.party_items, public.ai_chapters to authenticated;
