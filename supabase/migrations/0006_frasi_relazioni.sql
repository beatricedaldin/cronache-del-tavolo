-- Frasi memorabili e relazioni tra personaggi e luoghi.
--
--   * frasi memorabili: le leggono TUTTI i membri della campagna; le modifica chi le ha
--     trascritte; il Master può toglierle
--   * relazioni ("Velia → sorella di → Mastro Odo"): private o pubbliche come le note
--     del compendio (privata = autore + Master, pubblica = tutti i membri)
--
-- Lo script si può rieseguire senza problemi.

-- ---------------------------------------------------------------------------
-- Frasi memorabili
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete cascade,
  speaker        text not null check (length(trim(speaker)) > 0),
  text           text not null check (length(trim(text)) > 0),
  context        text not null default '',
  session_number int check (session_number is null or session_number > 0),
  quote_date     date not null default current_date,
  created_at     timestamptz not null default now()
);
create index if not exists quotes_campaign_idx on public.quotes (campaign_id, quote_date desc);

alter table public.quotes enable row level security;

drop policy if exists quotes_select on public.quotes;
drop policy if exists quotes_insert on public.quotes;
drop policy if exists quotes_update on public.quotes;
drop policy if exists quotes_delete on public.quotes;
create policy quotes_select on public.quotes for select using (public.is_member(campaign_id));
create policy quotes_insert on public.quotes for insert
  with check (author_id = auth.uid() and public.is_member(campaign_id));
create policy quotes_update on public.quotes for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy quotes_delete on public.quotes for delete
  using (author_id = auth.uid() or public.is_gm(campaign_id));

-- ---------------------------------------------------------------------------
-- Relazioni tra personaggi e luoghi del compendio
-- ---------------------------------------------------------------------------
create table if not exists public.entity_relations (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  from_kind   public.entity_kind not null,
  from_slug   text not null,
  from_name   text not null,
  label       text not null check (length(trim(label)) > 0),
  to_kind     public.entity_kind not null,
  to_slug     text not null,
  to_name     text not null,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  check (not (from_kind = to_kind and from_slug = to_slug))
);
create index if not exists relations_from_idx on public.entity_relations (campaign_id, from_kind, from_slug);
create index if not exists relations_to_idx on public.entity_relations (campaign_id, to_kind, to_slug);

alter table public.entity_relations enable row level security;

drop policy if exists relations_select on public.entity_relations;
drop policy if exists relations_insert on public.entity_relations;
drop policy if exists relations_update on public.entity_relations;
drop policy if exists relations_delete on public.entity_relations;
create policy relations_select on public.entity_relations for select
  using (owner_id = auth.uid() or public.is_gm(campaign_id) or (is_public and public.is_member(campaign_id)));
create policy relations_insert on public.entity_relations for insert
  with check (owner_id = auth.uid() and public.is_member(campaign_id));
create policy relations_update on public.entity_relations for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy relations_delete on public.entity_relations for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Permessi: solo utenti collegati
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.quotes, public.entity_relations to authenticated;
