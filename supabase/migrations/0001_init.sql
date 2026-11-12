-- Cronache del Tavolo: schema iniziale
--
-- Regola di visibilità (applicata dal database con Row Level Security):
--   * ogni giocatore legge e modifica SOLO le proprie cose (PG, legami, diario, compendio, fili)
--   * il Master di una campagna legge TUTTO quello che c'è in quella campagna
--   * il Master scrive solo le proprie note (non modifica quelle dei giocatori)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profili (uno per account Supabase)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Campagne e membri
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  gm_id       uuid not null references public.profiles (id) on delete restrict,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at  timestamptz not null default now()
);

create type public.member_role as enum ('gm', 'player');

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.member_role not null default 'player',
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

-- Helper usati dalle policy. SECURITY DEFINER per evitare ricorsione nelle policy RLS.
create or replace function public.is_member(p_campaign uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign and user_id = auth.uid()
  );
$$;

create or replace function public.is_gm(p_campaign uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign and user_id = auth.uid() and role = 'gm'
  );
$$;

-- Vero se l'utente corrente è Master di una campagna in cui `p_user` è membro.
create or replace function public.is_gm_of_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.campaign_members me
    join public.campaign_members other on other.campaign_id = me.campaign_id
    where me.user_id = auth.uid() and me.role = 'gm' and other.user_id = p_user
  );
$$;

-- Crea una campagna: il chiamante ne diventa il Master.
create or replace function public.create_campaign(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_campaign uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato';
  end if;

  insert into public.campaigns (name, gm_id) values (trim(p_name), auth.uid())
  returning id into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign, auth.uid(), 'gm');

  return v_campaign;
end;
$$;

-- Unirsi a una campagna con il codice invito.
create or replace function public.join_campaign(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_campaign uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato';
  end if;

  select id into v_campaign from public.campaigns where invite_code = upper(trim(p_code));
  if v_campaign is null then
    raise exception 'Codice invito non valido';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign, auth.uid(), 'player')
  on conflict do nothing;

  return v_campaign;
end;
$$;

-- ---------------------------------------------------------------------------
-- Personaggi e Legami
-- ---------------------------------------------------------------------------
create table public.characters (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  classes       text not null default '',
  level         int  not null default 5 check (level between 1 and 60),
  identity      text not null default '',
  theme         text not null default '',
  origin        text not null default '',
  fabula_points int  not null default 3 check (fabula_points >= 0),
  notes         text not null default '',
  updated_at    timestamptz not null default now(),
  unique (campaign_id, owner_id)
);

create table public.bonds (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  target       text not null,
  emotions     text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Diario, compendio, fili in sospeso
-- ---------------------------------------------------------------------------
create table public.entries (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete cascade,
  session_number int  not null check (session_number > 0),
  body           text not null check (length(trim(body)) > 0),
  created_at     timestamptz not null default now()
);
create index entries_campaign_idx on public.entries (campaign_id, session_number desc, created_at desc);

create type public.entity_kind as enum ('npc', 'place');

-- Ogni giocatore ha il proprio compendio: la stessa "Velia" esiste una volta per ogni autore.
-- Il Master li vede tutti e li raggruppa per (kind, slug).
create table public.entities (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  kind        public.entity_kind not null,
  slug        text not null,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (campaign_id, owner_id, kind, slug)
);

create table public.entry_mentions (
  entry_id  uuid not null references public.entries (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  primary key (entry_id, entity_id)
);

create table public.threads (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns (id) on delete cascade,
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  entry_id         uuid references public.entries (id) on delete set null,
  text             text not null,
  opened_session   int  not null,
  resolved_session int,
  created_at       timestamptz not null default now()
);

-- Salva una voce di diario con menzioni e fili in un'unica transazione.
-- SECURITY INVOKER: valgono le policy RLS dell'utente che chiama.
-- p_tags: [{"kind":"npc","slug":"velia","name":"Velia"}, ...]
create or replace function public.create_entry(
  p_campaign uuid,
  p_session  int,
  p_body     text,
  p_tags     jsonb,
  p_threads  text[]
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_entry uuid;
  v_tag   jsonb;
  v_ent   uuid;
  v_text  text;
begin
  insert into public.entries (campaign_id, author_id, session_number, body)
  values (p_campaign, auth.uid(), p_session, p_body)
  returning id into v_entry;

  for v_tag in select * from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) loop
    insert into public.entities (campaign_id, owner_id, kind, slug, name)
    values (p_campaign, auth.uid(), (v_tag ->> 'kind')::public.entity_kind, v_tag ->> 'slug', v_tag ->> 'name')
    on conflict (campaign_id, owner_id, kind, slug) do update set name = public.entities.name
    returning id into v_ent;

    insert into public.entry_mentions (entry_id, entity_id) values (v_entry, v_ent)
    on conflict do nothing;
  end loop;

  foreach v_text in array coalesce(p_threads, '{}') loop
    insert into public.threads (campaign_id, owner_id, entry_id, text, opened_session)
    values (p_campaign, auth.uid(), v_entry, v_text, p_session);
  end loop;

  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.campaigns        enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters       enable row level security;
alter table public.bonds            enable row level security;
alter table public.entries          enable row level security;
alter table public.entities         enable row level security;
alter table public.entry_mentions   enable row level security;
alter table public.threads          enable row level security;

-- Profili: il proprio, più quelli dei giocatori delle campagne di cui sei Master.
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_gm_of_user(id));
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Campagne: visibili ai membri; si creano solo tramite create_campaign().
create policy campaigns_select on public.campaigns for select
  using (public.is_member(id));
create policy campaigns_update on public.campaigns for update
  using (public.is_gm(id)) with check (public.is_gm(id));

-- Membri: il giocatore vede solo la propria iscrizione, il Master vede tutti.
-- Ci si iscrive solo tramite join_campaign().
create policy members_select on public.campaign_members for select
  using (user_id = auth.uid() or public.is_gm(campaign_id));
create policy members_delete on public.campaign_members for delete
  using (user_id = auth.uid() or public.is_gm(campaign_id));

-- Tabelle "di proprietà": in lettura il proprietario o il Master,
-- in scrittura solo il proprietario (e solo se membro della campagna).
create policy characters_select on public.characters for select
  using (owner_id = auth.uid() or public.is_gm(campaign_id));
create policy characters_insert on public.characters for insert
  with check (owner_id = auth.uid() and public.is_member(campaign_id));
create policy characters_update on public.characters for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy characters_delete on public.characters for delete
  using (owner_id = auth.uid());

create policy bonds_select on public.bonds for select
  using (exists (select 1 from public.characters c where c.id = character_id));
create policy bonds_write on public.bonds for all
  using (exists (select 1 from public.characters c where c.id = character_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.characters c where c.id = character_id and c.owner_id = auth.uid()));

create policy entries_select on public.entries for select
  using (author_id = auth.uid() or public.is_gm(campaign_id));
create policy entries_insert on public.entries for insert
  with check (author_id = auth.uid() and public.is_member(campaign_id));
create policy entries_update on public.entries for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy entries_delete on public.entries for delete
  using (author_id = auth.uid());

create policy entities_select on public.entities for select
  using (owner_id = auth.uid() or public.is_gm(campaign_id));
create policy entities_insert on public.entities for insert
  with check (owner_id = auth.uid() and public.is_member(campaign_id));
create policy entities_update on public.entities for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy entities_delete on public.entities for delete
  using (owner_id = auth.uid());

-- Una menzione è visibile se è visibile la voce di diario (si applicano le policy di entries).
create policy mentions_select on public.entry_mentions for select
  using (exists (select 1 from public.entries e where e.id = entry_id));
create policy mentions_insert on public.entry_mentions for insert
  with check (exists (select 1 from public.entries e where e.id = entry_id and e.author_id = auth.uid()));
create policy mentions_delete on public.entry_mentions for delete
  using (exists (select 1 from public.entries e where e.id = entry_id and e.author_id = auth.uid()));

create policy threads_select on public.threads for select
  using (owner_id = auth.uid() or public.is_gm(campaign_id));
create policy threads_insert on public.threads for insert
  with check (owner_id = auth.uid() and public.is_member(campaign_id));
create policy threads_update on public.threads for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy threads_delete on public.threads for delete
  using (owner_id = auth.uid());

-- Le funzioni RPC sono chiamabili solo da utenti autenticati.
-- (Il grant di default va a PUBLIC, che include anche il ruolo anon: va revocato da lì.)
revoke execute on function public.create_campaign(text) from public, anon;
revoke execute on function public.join_campaign(text) from public, anon;
revoke execute on function public.create_entry(uuid, int, text, jsonb, text[]) from public, anon;
grant execute on function public.create_campaign(text) to authenticated;
grant execute on function public.join_campaign(text) to authenticated;
grant execute on function public.create_entry(uuid, int, text, jsonb, text[]) to authenticated;
