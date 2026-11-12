-- Cronache del Tavolo: parti condivise, modifica del diario, compendio, obiettivi.
--
-- Nuova regola di visibilità:
--   * una voce di diario o una nota del compendio è PRIVATA (default) o PUBBLICA
--   * privata: la leggono l'autore e il Master
--   * pubblica: la leggono tutti i membri della campagna
--   * la scheda di un personaggio o luogo (descrizione + immagine) la scrive solo il Master
--     e la leggono tutti
--   * fili in sospeso e obiettivi restano privati (autore + Master)
--
-- Lo script si può rieseguire senza problemi.

-- ---------------------------------------------------------------------------
-- Profili: i membri di una stessa campagna vedono i nomi degli altri
-- (serve a firmare le voci pubbliche).
-- ---------------------------------------------------------------------------
create or replace function public.shares_campaign(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.campaign_members me
    join public.campaign_members other on other.campaign_id = me.campaign_id
    where me.user_id = auth.uid() and other.user_id = p_user
  );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_campaign(id));

-- ---------------------------------------------------------------------------
-- Diario: voci pubbliche o private, modificabili
-- ---------------------------------------------------------------------------
alter table public.entries add column if not exists is_public  boolean not null default false;
alter table public.entries add column if not exists updated_at timestamptz;
-- La data della voce (di solito quella della sessione): la sceglie chi scrive.
-- Per le voci già scritte si usa il giorno in cui sono state create.
alter table public.entries add column if not exists entry_date date;
update public.entries set entry_date = created_at::date where entry_date is null;
alter table public.entries alter column entry_date set default current_date;
alter table public.entries alter column entry_date set not null;

drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select
  using (
    author_id = auth.uid()
    or public.is_gm(campaign_id)
    or (is_public and public.is_member(campaign_id))
  );

-- Un'entità (es. "Velia" di un giocatore) è visibile anche agli altri se compare in una voce pubblica.
drop policy if exists entities_select on public.entities;
create policy entities_select on public.entities for select
  using (
    owner_id = auth.uid()
    or public.is_gm(campaign_id)
    or exists (
      select 1
      from public.entry_mentions m
      join public.entries e on e.id = m.entry_id
      where m.entity_id = entities.id and e.is_public and public.is_member(e.campaign_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Fili in sospeso e obiettivi
-- ---------------------------------------------------------------------------
alter table public.threads add column if not exists kind text not null default 'question';
alter table public.threads drop constraint if exists threads_kind_check;
alter table public.threads add constraint threads_kind_check check (kind in ('question', 'goal'));
alter table public.threads drop constraint if exists threads_text_check;
alter table public.threads add constraint threads_text_check check (length(trim(text)) > 0);

-- Collega una voce alle entità citate e ai suoi fili/obiettivi.
-- In modifica: i fili non ancora risolti che non sono più nel testo vengono tolti,
-- quelli già risolti restano (fanno parte della storia).
create or replace function public.sync_entry_links(
  p_entry    uuid,
  p_campaign uuid,
  p_session  int,
  p_tags     jsonb,
  p_threads  text[],
  p_goals    text[]
)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_tag jsonb;
  v_ent uuid;
begin
  delete from public.entry_mentions where entry_id = p_entry;

  for v_tag in select * from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) loop
    insert into public.entities (campaign_id, owner_id, kind, slug, name)
    values (p_campaign, auth.uid(), (v_tag ->> 'kind')::public.entity_kind, v_tag ->> 'slug', v_tag ->> 'name')
    on conflict (campaign_id, owner_id, kind, slug) do update set name = public.entities.name
    returning id into v_ent;

    insert into public.entry_mentions (entry_id, entity_id) values (p_entry, v_ent)
    on conflict do nothing;
  end loop;

  delete from public.threads t
  where t.entry_id = p_entry
    and t.resolved_session is null
    and not (
      (t.kind = 'question' and t.text = any (coalesce(p_threads, '{}')))
      or (t.kind = 'goal' and t.text = any (coalesce(p_goals, '{}')))
    );

  insert into public.threads (campaign_id, owner_id, entry_id, text, opened_session, kind)
  select p_campaign, auth.uid(), p_entry, x.text, p_session, x.kind
  from (
    select distinct unnest(coalesce(p_threads, '{}')) as text, 'question' as kind
    union
    select distinct unnest(coalesce(p_goals, '{}')), 'goal'
  ) x
  where not exists (
    select 1 from public.threads t where t.entry_id = p_entry and t.kind = x.kind and t.text = x.text
  );
end;
$$;

drop function if exists public.create_entry(uuid, int, text, jsonb, text[]);
drop function if exists public.create_entry(uuid, int, text, jsonb, text[], text[], boolean);
drop function if exists public.update_entry(uuid, int, text, jsonb, text[], text[], boolean);

create or replace function public.create_entry(
  p_campaign uuid,
  p_session  int,
  p_body     text,
  p_tags     jsonb,
  p_threads  text[],
  p_goals    text[] default '{}',
  p_public   boolean default false,
  p_date     date default null
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_entry uuid;
begin
  insert into public.entries (campaign_id, author_id, session_number, body, is_public, entry_date)
  values (p_campaign, auth.uid(), p_session, p_body, coalesce(p_public, false), coalesce(p_date, current_date))
  returning id into v_entry;

  perform public.sync_entry_links(v_entry, p_campaign, p_session, p_tags, p_threads, p_goals);
  return v_entry;
end;
$$;

create or replace function public.update_entry(
  p_entry   uuid,
  p_session int,
  p_body    text,
  p_tags    jsonb,
  p_threads text[],
  p_goals   text[],
  p_public  boolean,
  p_date    date default null
)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_campaign uuid;
begin
  update public.entries
  set session_number = p_session, body = p_body, is_public = coalesce(p_public, false),
      entry_date = coalesce(p_date, entry_date), updated_at = now()
  where id = p_entry and author_id = auth.uid()
  returning campaign_id into v_campaign;

  if v_campaign is null then
    raise exception 'Voce di diario non trovata';
  end if;

  perform public.sync_entry_links(p_entry, v_campaign, p_session, p_tags, p_threads, p_goals);
end;
$$;

-- ---------------------------------------------------------------------------
-- Compendio: la scheda pubblica (del Master) e le note dei giocatori
-- ---------------------------------------------------------------------------
create table if not exists public.entity_cards (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind        public.entity_kind not null,
  slug        text not null,
  name        text not null check (length(trim(name)) > 0),
  description text not null default '',
  image_path  text,
  updated_at  timestamptz not null default now(),
  primary key (campaign_id, kind, slug)
);

create table if not exists public.entity_notes (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  kind        public.entity_kind not null,
  slug        text not null,
  name        text not null,
  body        text not null check (length(trim(body)) > 0),
  is_public   boolean not null default false,
  note_date   date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.entity_notes add column if not exists note_date date not null default current_date;
create index if not exists entity_notes_entity_idx on public.entity_notes (campaign_id, kind, slug);

alter table public.entity_cards enable row level security;
alter table public.entity_notes enable row level security;

drop policy if exists cards_select on public.entity_cards;
drop policy if exists cards_insert on public.entity_cards;
drop policy if exists cards_update on public.entity_cards;
drop policy if exists cards_delete on public.entity_cards;
create policy cards_select on public.entity_cards for select using (public.is_member(campaign_id));
create policy cards_insert on public.entity_cards for insert with check (public.is_gm(campaign_id));
create policy cards_update on public.entity_cards for update using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy cards_delete on public.entity_cards for delete using (public.is_gm(campaign_id));

drop policy if exists notes_select on public.entity_notes;
drop policy if exists notes_insert on public.entity_notes;
drop policy if exists notes_update on public.entity_notes;
drop policy if exists notes_delete on public.entity_notes;
create policy notes_select on public.entity_notes for select
  using (owner_id = auth.uid() or public.is_gm(campaign_id) or (is_public and public.is_member(campaign_id)));
create policy notes_insert on public.entity_notes for insert
  with check (owner_id = auth.uid() and public.is_member(campaign_id));
create policy notes_update on public.entity_notes for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy notes_delete on public.entity_notes for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Immagini del compendio (Supabase Storage)
-- Percorso dei file: <id campagna>/<tipo>/<slug>-<casuale>.<estensione>
-- Le leggono i membri della campagna, le caricano e cancellano solo il Master.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('compendio', 'compendio', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- L'id della campagna dal percorso del file; null se il percorso non è valido.
create or replace function public.campaign_from_path(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists compendio_select on storage.objects;
drop policy if exists compendio_insert on storage.objects;
drop policy if exists compendio_update on storage.objects;
drop policy if exists compendio_delete on storage.objects;
create policy compendio_select on storage.objects for select to authenticated
  using (bucket_id = 'compendio' and public.is_member(public.campaign_from_path(name)));
create policy compendio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'compendio' and public.is_gm(public.campaign_from_path(name)));
create policy compendio_update on storage.objects for update to authenticated
  using (bucket_id = 'compendio' and public.is_gm(public.campaign_from_path(name)));
create policy compendio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'compendio' and public.is_gm(public.campaign_from_path(name)));

-- ---------------------------------------------------------------------------
-- Ritratti dei PG (Supabase Storage)
-- Percorso dei file: <id campagna>/<id giocatore>/<casuale>.<estensione>
-- Come la scheda: li vedono il giocatore e il Master, li carica solo il giocatore.
-- ---------------------------------------------------------------------------
alter table public.characters add column if not exists portrait_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ritratti', 'ritratti', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists ritratti_select on storage.objects;
drop policy if exists ritratti_insert on storage.objects;
drop policy if exists ritratti_update on storage.objects;
drop policy if exists ritratti_delete on storage.objects;
create policy ritratti_select on storage.objects for select to authenticated
  using (
    bucket_id = 'ritratti'
    and (split_part(name, '/', 2) = auth.uid()::text or public.is_gm(public.campaign_from_path(name)))
  );
create policy ritratti_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ritratti'
    and split_part(name, '/', 2) = auth.uid()::text
    and public.is_member(public.campaign_from_path(name))
  );
create policy ritratti_update on storage.objects for update to authenticated
  using (bucket_id = 'ritratti' and split_part(name, '/', 2) = auth.uid()::text);
create policy ritratti_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ritratti' and split_part(name, '/', 2) = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Permessi: solo utenti collegati
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.entity_cards, public.entity_notes to authenticated;

revoke execute on function public.shares_campaign(uuid) from public, anon;
revoke execute on function public.campaign_from_path(text) from public, anon;
revoke execute on function public.sync_entry_links(uuid, uuid, int, jsonb, text[], text[]) from public, anon;
revoke execute on function public.create_entry(uuid, int, text, jsonb, text[], text[], boolean, date) from public, anon;
revoke execute on function public.update_entry(uuid, int, text, jsonb, text[], text[], boolean, date) from public, anon;

grant execute on function public.shares_campaign(uuid) to authenticated;
grant execute on function public.campaign_from_path(text) to authenticated;
grant execute on function public.sync_entry_links(uuid, uuid, int, jsonb, text[], text[]) to authenticated;
grant execute on function public.create_entry(uuid, int, text, jsonb, text[], text[], boolean, date) to authenticated;
grant execute on function public.update_entry(uuid, int, text, jsonb, text[], text[], boolean, date) to authenticated;
