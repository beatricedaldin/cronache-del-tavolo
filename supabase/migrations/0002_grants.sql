-- Permessi espliciti per gli utenti collegati.
--
-- I progetti Supabase recenti possono non dare in automatico i permessi sulle tabelle
-- ai ruoli dell'API. Qui li diamo SOLO al ruolo `authenticated`: chi non ha fatto
-- l'accesso (ruolo `anon`) non può leggere né scrivere niente.
-- Chi vede cosa resta deciso dalle policy RLS di 0001_init.sql.
-- Lo script si può rieseguire senza problemi.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.campaigns,
  public.campaign_members,
  public.characters,
  public.bonds,
  public.entries,
  public.entities,
  public.entry_mentions,
  public.threads
to authenticated;

-- Funzioni usate dentro le policy RLS.
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_gm(uuid) to authenticated;
grant execute on function public.is_gm_of_user(uuid) to authenticated;
