-- Il gruppo: nome e ritratto di ogni PG li vedono tutti quelli al tavolo.
-- Il resto della scheda (caratteristiche, legami, note…) resta privato: giocatore + Master.
-- Lo script si può rieseguire senza problemi.

-- I ritratti li vedono tutti i membri della campagna (li carica sempre e solo il proprietario).
drop policy if exists ritratti_select on storage.objects;
create policy ritratti_select on storage.objects for select to authenticated
  using (bucket_id = 'ritratti' and public.is_member(public.campaign_from_path(name)));

-- Chi gioca nella campagna: giocatore, nome del PG e ritratto. Nient'altro della scheda.
-- SECURITY DEFINER perché la tabella characters resta privata; il controllo is_member
-- fa sì che solo i membri della campagna ottengano qualcosa.
create or replace function public.campaign_party(p_campaign uuid)
returns table (user_id uuid, display_name text, character_name text, portrait_path text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.display_name, c.name, c.portrait_path
  from public.campaign_members m
  join public.profiles p on p.id = m.user_id
  left join public.characters c on c.campaign_id = m.campaign_id and c.owner_id = m.user_id
  where m.campaign_id = p_campaign
    and m.role = 'player'
    and public.is_member(p_campaign)
  order by m.joined_at;
$$;

revoke execute on function public.campaign_party(uuid) from public, anon;
grant execute on function public.campaign_party(uuid) to authenticated;
