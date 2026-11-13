-- Gestione della campagna.
--
--   * il Master rinomina la campagna, rigenera il codice invito, toglie un giocatore,
--     passa il ruolo di Master a un giocatore, elimina la campagna
--   * un giocatore esce da una campagna (il Master no: prima deve passare il ruolo)
--
-- Chi viene tolto o esce perde l'accesso; quello che ha scritto resta nella campagna
-- (le voci pubbliche le leggono ancora tutti, le private solo il Master).
-- Lo script si può rieseguire senza problemi.

-- ---------------------------------------------------------------------------
-- Campagne: il Master cambia solo il nome. Codice invito e Master si cambiano
-- solo con le funzioni qui sotto, che controllano le regole.
-- ---------------------------------------------------------------------------
revoke update on public.campaigns from authenticated;
grant update (name) on public.campaigns to authenticated;

drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_delete on public.campaigns for delete using (public.is_gm(id));

-- ---------------------------------------------------------------------------
-- Membri: si esce o si viene tolti solo da giocatori. Il Master non può
-- togliersi da solo, altrimenti la campagna resterebbe senza Master.
-- ---------------------------------------------------------------------------
drop policy if exists members_delete on public.campaign_members;
create policy members_delete on public.campaign_members for delete
  using (role = 'player' and (user_id = auth.uid() or public.is_gm(campaign_id)));

-- Un codice invito nuovo, come quello di partenza (8 caratteri esadecimali).
create or replace function public.new_invite_code()
returns text language sql volatile set search_path = public, extensions as $$
  select upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
$$;

-- Il Master rigenera il codice invito: quello vecchio smette di funzionare.
create or replace function public.regenerate_invite_code(p_campaign uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
begin
  if not public.is_gm(p_campaign) then
    raise exception 'Solo il Master può cambiare il codice invito';
  end if;
  update public.campaigns set invite_code = public.new_invite_code() where id = p_campaign
  returning invite_code into v_code;
  return v_code;
end;
$$;

-- Il Master toglie un giocatore. Il codice invito cambia nello stesso momento,
-- così chi è stato tolto non può rientrare con quello vecchio.
create or replace function public.remove_member(p_campaign uuid, p_user uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_gm(p_campaign) then
    raise exception 'Solo il Master può togliere un giocatore';
  end if;
  delete from public.campaign_members where campaign_id = p_campaign and user_id = p_user and role = 'player';
  if not found then
    raise exception 'Giocatore non trovato in questa campagna';
  end if;
  return public.regenerate_invite_code(p_campaign);
end;
$$;

-- Il Master passa il ruolo a un giocatore della campagna e diventa giocatore.
create or replace function public.transfer_gm(p_campaign uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_gm(p_campaign) then
    raise exception 'Solo il Master può passare il ruolo';
  end if;
  if not exists (
    select 1 from public.campaign_members where campaign_id = p_campaign and user_id = p_user and role = 'player'
  ) then
    raise exception 'Il nuovo Master deve essere un giocatore della campagna';
  end if;
  update public.campaign_members set role = 'player' where campaign_id = p_campaign and user_id = auth.uid();
  update public.campaign_members set role = 'gm' where campaign_id = p_campaign and user_id = p_user;
  update public.campaigns set gm_id = p_user where id = p_campaign;
end;
$$;

-- Eliminando la campagna i file dei ritratti vanno tolti dal Master:
-- può cancellare (non caricare, non sostituire) quelli della sua campagna.
drop policy if exists ritratti_delete on storage.objects;
create policy ritratti_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'ritratti'
    and (split_part(name, '/', 2) = auth.uid()::text or public.is_gm(public.campaign_from_path(name)))
  );

revoke execute on function public.new_invite_code() from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.transfer_gm(uuid, uuid) from public, anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_gm(uuid, uuid) to authenticated;
