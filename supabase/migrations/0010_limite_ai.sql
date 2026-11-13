-- Limite giornaliero di richieste AI per persona.
--
-- La quota gratuita di Gemini è una sola per tutta l'app: il limite evita che una
-- persona la consumi per tutti. Il giorno cambia a mezzanotte, ora italiana.
-- Il contatore si tocca solo tramite le funzioni qui sotto (niente scritture dirette).
-- Lo script si può rieseguire senza problemi.

create table if not exists public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day     date not null,
  used    int  not null default 0 check (used >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_own on public.ai_usage;
create policy ai_usage_own on public.ai_usage for select using (user_id = auth.uid());

grant select on public.ai_usage to authenticated;

create or replace function public.ai_today()
returns date language sql stable as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- Prenota una richiesta: se il limite di oggi è raggiunto, blocca con un messaggio chiaro.
-- Restituisce quante richieste restano oggi dopo questa.
create or replace function public.consume_ai_quota(p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_used int;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato';
  end if;

  insert into public.ai_usage (user_id, day, used)
  values (auth.uid(), public.ai_today(), 1)
  on conflict (user_id, day) do update set used = public.ai_usage.used + 1
  where public.ai_usage.used < p_limit
  returning used into v_used;

  if v_used is null then
    raise exception 'Hai usato tutte le % richieste AI di oggi: domani si ricomincia.', p_limit;
  end if;
  return p_limit - v_used;
end;
$$;

-- Restituisce una richiesta prenotata (quando l'AI non ha risposto).
create or replace function public.refund_ai_quota()
returns void language sql security definer set search_path = public as $$
  update public.ai_usage set used = greatest(used - 1, 0)
  where user_id = auth.uid() and day = public.ai_today();
$$;

revoke execute on function public.consume_ai_quota(int) from public, anon;
revoke execute on function public.refund_ai_quota() from public, anon;
grant execute on function public.ai_today() to authenticated;
grant execute on function public.consume_ai_quota(int) to authenticated;
grant execute on function public.refund_ai_quota() to authenticated;
