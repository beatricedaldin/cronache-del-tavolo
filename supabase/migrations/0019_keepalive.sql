-- Tiene sveglio il progetto Supabase gratuito, che va in pausa dopo una settimana senza attività.
-- La chiama ogni 6 giorni la GitHub Action .github/workflows/keepalive.yml.
-- Fa una vera lettura sul database ma non restituisce nessun dato: per questo la può
-- chiamare anche chi non ha fatto l'accesso (ruolo anon), con la sola chiave pubblica.
-- Lo script si può rieseguire senza problemi.

create or replace function public.keepalive()
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= 0 from (select 1 from public.campaigns limit 1) x;
$$;

revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
