-- Scheda completa di Fabula Ultima.
--
-- Caratteristiche, classi, abilità, incantesimi, equipaggiamento, PE e Zenit
-- stanno in un'unica colonna JSON `sheet`. La sua forma è definita e validata
-- dall'app (src/lib/fabula.ts). La riga resta la stessa, quindi valgono le
-- policy RLS già esistenti: la modifica solo il proprietario, la legge anche il Master.
-- Lo script si può rieseguire senza problemi.

alter table public.characters
  add column if not exists sheet jsonb not null default '{}'::jsonb;

-- Il livello del personaggio arriva al massimo a 50.
alter table public.characters drop constraint if exists characters_level_check;
alter table public.characters add constraint characters_level_check check (level between 1 and 50);

-- Al massimo sei Legami per personaggio.
create or replace function public.check_bond_limit()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.bonds where character_id = new.character_id) >= 6 then
    raise exception 'Un personaggio può avere al massimo sei Legami';
  end if;
  return new;
end;
$$;

drop trigger if exists bonds_limit on public.bonds;
create trigger bonds_limit
  before insert on public.bonds
  for each row execute function public.check_bond_limit();
