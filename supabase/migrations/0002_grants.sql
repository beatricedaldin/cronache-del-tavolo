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
  public.campaign_members,
  public.characters,
  public.bonds,
  public.entries,
  public.entities,
  public.entry_mentions,
  public.threads
to authenticated;

-- Campagne: si cambia solo il nome. Codice invito e Master si cambiano con le funzioni
-- di 0011, che controllano le regole (rieseguire questo file non deve riaprire il resto).
grant select, insert, delete on public.campaigns to authenticated;
revoke update on public.campaigns from authenticated;
grant update (name) on public.campaigns to authenticated;

-- Funzioni usate dentro le policy RLS.
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_gm(uuid) to authenticated;
grant execute on function public.is_gm_of_user(uuid) to authenticated;
