-- Campagna personale: un giocatore tiene memoria del proprio PG anche se il resto
-- del tavolo (Master compreso) non usa l'app.
--
--   * chi la crea ne è l'unico membro: nel database ha il ruolo di Master (così
--     può rinominarla, eliminarla e scrivere le schede pubbliche del compendio),
--     ma l'app gli mostra scheda, inventario, fili e diario come a un giocatore
--   * finché è personale il codice invito non funziona
--   * se il gruppo decide di usare l'app, la si apre: il codice invito si attiva e,
--     quando il vero Master è entrato, gli si passa il ruolo (transfer_gm, 0011)
--   * aprirla non si può annullare
--
-- Lo script si può rieseguire senza problemi.

alter table public.campaigns add column if not exists personal boolean not null default false;

-- ---------------------------------------------------------------------------
-- Creazione: un parametro in più. La vecchia firma va tolta, altrimenti
-- create_campaign('nome') sarebbe ambigua tra le due versioni.
-- ---------------------------------------------------------------------------
drop function if exists public.create_campaign(text);

create or replace function public.create_campaign(p_name text, p_personal boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_campaign uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato';
  end if;

  insert into public.campaigns (name, gm_id, personal) values (trim(p_name), auth.uid(), coalesce(p_personal, false))
  returning id into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign, auth.uid(), 'gm');

  return v_campaign;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ingresso con il codice: le campagne personali non accettano nessuno.
-- Si risponde "codice non valido", senza dire che la campagna esiste.
-- ---------------------------------------------------------------------------
create or replace function public.join_campaign(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_campaign uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato';
  end if;

  select id into v_campaign from public.campaigns
  where invite_code = upper(trim(p_code)) and not personal;
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
-- Aprire la campagna al gruppo. Restituisce il codice invito da condividere.
-- ---------------------------------------------------------------------------
create or replace function public.open_campaign(p_campaign uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_gm(p_campaign) then
    raise exception 'Solo chi ha creato la campagna può aprirla al gruppo';
  end if;
  update public.campaigns set personal = false where id = p_campaign
  returning invite_code into v_code;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Il gruppo: oltre ai giocatori, anche il Master quando ha un PG suo
-- (chi ha aperto una campagna personale e non ha ancora passato il ruolo).
-- ---------------------------------------------------------------------------
create or replace function public.campaign_party(p_campaign uuid)
returns table (user_id uuid, display_name text, character_name text, portrait_path text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.display_name, c.name, c.portrait_path
  from public.campaign_members m
  join public.profiles p on p.id = m.user_id
  left join public.characters c on c.campaign_id = m.campaign_id and c.owner_id = m.user_id
  where m.campaign_id = p_campaign
    and (m.role = 'player' or c.id is not null)
    and public.is_member(p_campaign)
  order by m.joined_at;
$$;

revoke execute on function public.create_campaign(text, boolean) from public, anon;
revoke execute on function public.open_campaign(uuid) from public, anon;
grant execute on function public.create_campaign(text, boolean) to authenticated;
grant execute on function public.open_campaign(uuid) to authenticated;
