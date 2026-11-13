-- Doppioni nel compendio: "Velya" e "Velia" sono la stessa persona.
--
-- Ogni giocatore ha le proprie entità, divise per nome (slug): se uno scrive @Velya
-- e un altro @Velia, nel compendio sono due voci. Il Master le unisce: "velya" diventa
-- un ALIAS di "velia". Niente viene riscritto (ognuno modifica solo le proprie cose):
-- l'app legge le voci, le note e le relazioni di "velya" sotto "velia".
-- Si può anche correggere il tipo (un @Culto che in realtà è un #[Culto del Sole]).
-- Separare di nuovo le voci = togliere l'alias.
--
--   * gli alias li scrive solo il Master
--   * un alias lo vede il Master e chi può già vedere la voce di partenza
--     (così un nome scritto in un diario privato non diventa visibile agli altri)
--
-- Lo script si può rieseguire senza problemi.

create table if not exists public.entity_aliases (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  from_kind   public.entity_kind not null,
  from_slug   text not null,
  from_name   text not null,
  to_kind     public.entity_kind not null,
  to_slug     text not null,
  to_name     text not null,
  created_at  timestamptz not null default now(),
  primary key (campaign_id, from_kind, from_slug),
  check (not (from_kind = to_kind and from_slug = to_slug))
);
create index if not exists entity_aliases_to_idx on public.entity_aliases (campaign_id, to_kind, to_slug);

alter table public.entity_aliases enable row level security;

drop policy if exists aliases_select on public.entity_aliases;
drop policy if exists aliases_insert on public.entity_aliases;
drop policy if exists aliases_update on public.entity_aliases;
drop policy if exists aliases_delete on public.entity_aliases;
-- Le sottoquery applicano le policy di entities, entity_notes, entity_relations ed entity_cards:
-- l'alias si vede solo se si vede già qualcosa della voce di partenza.
create policy aliases_select on public.entity_aliases for select
  using (
    public.is_gm(campaign_id)
    or exists (
      select 1 from public.entities e
      where e.campaign_id = entity_aliases.campaign_id and e.kind = from_kind and e.slug = from_slug
    )
    or exists (
      select 1 from public.entity_notes n
      where n.campaign_id = entity_aliases.campaign_id and n.kind = from_kind and n.slug = from_slug
    )
    or exists (
      select 1 from public.entity_relations r
      where r.campaign_id = entity_aliases.campaign_id
        and ((r.from_kind = from_kind and r.from_slug = from_slug) or (r.to_kind = from_kind and r.to_slug = from_slug))
    )
    or exists (
      select 1 from public.entity_cards c
      where c.campaign_id = entity_aliases.campaign_id and c.kind = from_kind and c.slug = from_slug
    )
  );
create policy aliases_insert on public.entity_aliases for insert with check (public.is_gm(campaign_id));
create policy aliases_update on public.entity_aliases for update using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy aliases_delete on public.entity_aliases for delete using (public.is_gm(campaign_id));

-- Il Master unisce la voce "from" a "to".
--   * se "to" è a sua volta un doppione, si punta direttamente all'originale
--   * chi puntava a "from" ora punta a "to" (gli alias non fanno mai catene)
--   * se "from" ha la scheda del Master e "to" no, la scheda passa a "to"
-- SECURITY INVOKER: valgono le policy del Master.
create or replace function public.merge_entity(
  p_campaign  uuid,
  p_from_kind public.entity_kind,
  p_from_slug text,
  p_from_name text,
  p_to_kind   public.entity_kind,
  p_to_slug   text,
  p_to_name   text
)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_kind public.entity_kind := p_to_kind;
  v_slug text := p_to_slug;
  v_name text := p_to_name;
  r      record;
begin
  if not public.is_gm(p_campaign) then
    raise exception 'Solo il Master può unire le voci del compendio';
  end if;

  select to_kind, to_slug, to_name into r
  from public.entity_aliases
  where campaign_id = p_campaign and from_kind = p_to_kind and from_slug = p_to_slug;
  if found then
    v_kind := r.to_kind;
    v_slug := r.to_slug;
    v_name := r.to_name;
  end if;

  if v_kind = p_from_kind and v_slug = p_from_slug then
    raise exception 'Una voce non si può unire a sé stessa';
  end if;

  update public.entity_aliases set to_kind = v_kind, to_slug = v_slug, to_name = v_name
  where campaign_id = p_campaign and to_kind = p_from_kind and to_slug = p_from_slug;
  -- Se "to" era un alias di "from", ora punterebbe a sé stesso: non serve più.
  delete from public.entity_aliases
  where campaign_id = p_campaign and from_kind = to_kind and from_slug = to_slug;

  insert into public.entity_aliases (campaign_id, from_kind, from_slug, from_name, to_kind, to_slug, to_name)
  values (p_campaign, p_from_kind, p_from_slug, p_from_name, v_kind, v_slug, v_name)
  on conflict (campaign_id, from_kind, from_slug)
  do update set from_name = excluded.from_name, to_kind = excluded.to_kind, to_slug = excluded.to_slug, to_name = excluded.to_name;

  if not exists (select 1 from public.entity_cards where campaign_id = p_campaign and kind = v_kind and slug = v_slug) then
    update public.entity_cards set kind = v_kind, slug = v_slug, name = v_name
    where campaign_id = p_campaign and kind = p_from_kind and slug = p_from_slug;
  end if;
end;
$$;

grant select, insert, update, delete on public.entity_aliases to authenticated;

revoke execute on function public.merge_entity(uuid, public.entity_kind, text, text, public.entity_kind, text, text) from public, anon;
grant execute on function public.merge_entity(uuid, public.entity_kind, text, text, public.entity_kind, text, text) to authenticated;
