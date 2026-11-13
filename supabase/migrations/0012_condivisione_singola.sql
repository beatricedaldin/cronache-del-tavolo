-- Rivelare una voce di diario o una nota del compendio a qualcuno in particolare.
--
-- Una voce o una nota PRIVATA si può condividere con uno o più membri della campagna:
--   * privata: la leggono l'autore e il Master, più chi è nella lista di condivisione
--   * pubblica: la leggono tutti (la lista non serve più e viene svuotata dall'app)
-- La lista la decide solo l'autore. Chi la riceve la legge e basta.
-- Fili e obiettivi della voce restano privati anche se la voce è condivisa.
-- Lo script si può rieseguire senza problemi.

-- Vero se `p_user` è membro della campagna (serve per controllare a chi si condivide).
create or replace function public.is_user_member(p_campaign uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campaign_members where campaign_id = p_campaign and user_id = p_user);
$$;

-- ---------------------------------------------------------------------------
-- Tabelle di condivisione. owner_id e campaign_id sono copiati dalla voce/nota:
-- così le policy di queste tabelle non devono leggere entries/entity_notes
-- (che a loro volta leggono queste: si andrebbe in ricorsione).
-- ---------------------------------------------------------------------------
create table if not exists public.entry_shares (
  entry_id    uuid not null references public.entries (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (entry_id, user_id),
  check (user_id <> owner_id)
);
create index if not exists entry_shares_user_idx on public.entry_shares (user_id);

create table if not exists public.note_shares (
  note_id     uuid not null references public.entity_notes (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (note_id, user_id),
  check (user_id <> owner_id)
);
create index if not exists note_shares_user_idx on public.note_shares (user_id);

alter table public.entry_shares enable row level security;
alter table public.note_shares enable row level security;

drop policy if exists entry_shares_select on public.entry_shares;
drop policy if exists entry_shares_insert on public.entry_shares;
drop policy if exists entry_shares_delete on public.entry_shares;
create policy entry_shares_select on public.entry_shares for select
  using (user_id = auth.uid() or owner_id = auth.uid() or public.is_gm(campaign_id));
create policy entry_shares_insert on public.entry_shares for insert
  with check (
    owner_id = auth.uid()
    and public.is_user_member(campaign_id, user_id)
    and exists (
      select 1 from public.entries e
      where e.id = entry_id and e.author_id = auth.uid() and e.campaign_id = entry_shares.campaign_id
    )
  );
create policy entry_shares_delete on public.entry_shares for delete using (owner_id = auth.uid());

drop policy if exists note_shares_select on public.note_shares;
drop policy if exists note_shares_insert on public.note_shares;
drop policy if exists note_shares_delete on public.note_shares;
create policy note_shares_select on public.note_shares for select
  using (user_id = auth.uid() or owner_id = auth.uid() or public.is_gm(campaign_id));
create policy note_shares_insert on public.note_shares for insert
  with check (
    owner_id = auth.uid()
    and public.is_user_member(campaign_id, user_id)
    and exists (
      select 1 from public.entity_notes n
      where n.id = note_id and n.owner_id = auth.uid() and n.campaign_id = note_shares.campaign_id
    )
  );
create policy note_shares_delete on public.note_shares for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Chi legge cosa: alle regole di prima si aggiunge "è stata condivisa con me"
-- (e sono ancora membro della campagna).
-- ---------------------------------------------------------------------------
drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select
  using (
    author_id = auth.uid()
    or public.is_gm(campaign_id)
    or (is_public and public.is_member(campaign_id))
    or (
      public.is_member(campaign_id)
      and exists (select 1 from public.entry_shares s where s.entry_id = entries.id and s.user_id = auth.uid())
    )
  );

-- Chi riceve una voce vede anche i personaggi e i luoghi che cita (per i link al compendio).
drop policy if exists entities_select on public.entities;
create policy entities_select on public.entities for select
  using (
    owner_id = auth.uid()
    or public.is_gm(campaign_id)
    or exists (
      select 1
      from public.entry_mentions m
      join public.entries e on e.id = m.entry_id
      where m.entity_id = entities.id
        and public.is_member(e.campaign_id)
        and (
          e.is_public
          or exists (select 1 from public.entry_shares s where s.entry_id = e.id and s.user_id = auth.uid())
        )
    )
  );

drop policy if exists notes_select on public.entity_notes;
create policy notes_select on public.entity_notes for select
  using (
    owner_id = auth.uid()
    or public.is_gm(campaign_id)
    or (is_public and public.is_member(campaign_id))
    or (
      public.is_member(campaign_id)
      and exists (select 1 from public.note_shares s where s.note_id = entity_notes.id and s.user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Impostare la lista in un colpo solo (togliere chi non c'è più, aggiungere i nuovi).
-- SECURITY INVOKER: valgono le policy qui sopra.
-- ---------------------------------------------------------------------------
create or replace function public.set_entry_shares(p_entry uuid, p_users uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.entry_shares
  where entry_id = p_entry and owner_id = auth.uid() and not (user_id = any (coalesce(p_users, '{}')));

  insert into public.entry_shares (entry_id, user_id, campaign_id, owner_id)
  select e.id, u, e.campaign_id, auth.uid()
  from public.entries e, unnest(coalesce(p_users, '{}')) as u
  where e.id = p_entry and e.author_id = auth.uid() and u <> auth.uid()
  on conflict do nothing;
end;
$$;

create or replace function public.set_note_shares(p_note uuid, p_users uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.note_shares
  where note_id = p_note and owner_id = auth.uid() and not (user_id = any (coalesce(p_users, '{}')));

  insert into public.note_shares (note_id, user_id, campaign_id, owner_id)
  select n.id, u, n.campaign_id, auth.uid()
  from public.entity_notes n, unnest(coalesce(p_users, '{}')) as u
  where n.id = p_note and n.owner_id = auth.uid() and u <> auth.uid()
  on conflict do nothing;
end;
$$;

grant select, insert, delete on public.entry_shares, public.note_shares to authenticated;

revoke execute on function public.is_user_member(uuid, uuid) from public, anon;
revoke execute on function public.set_entry_shares(uuid, uuid[]) from public, anon;
revoke execute on function public.set_note_shares(uuid, uuid[]) from public, anon;
grant execute on function public.is_user_member(uuid, uuid) to authenticated;
grant execute on function public.set_entry_shares(uuid, uuid[]) to authenticated;
grant execute on function public.set_note_shares(uuid, uuid[]) to authenticated;
