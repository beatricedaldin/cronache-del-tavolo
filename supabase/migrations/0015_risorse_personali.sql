-- Risorse e inventario sono personali. I dati precedenti restano conservati
-- nelle tabelle storiche, ma non sono più accessibili tramite l'API utente.

create or replace function public.record_character_equipment(
  p_character_id uuid,
  p_name text,
  p_slot text,
  p_quantity int,
  p_cost int,
  p_acquisition text,
  p_payment_source text,
  p_session_number int,
  p_acquired_on date,
  p_defense int,
  p_magic_defense int,
  p_initiative int,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign uuid;
  v_owner uuid;
  v_sheet jsonb;
  v_equipment jsonb;
  v_entry jsonb;
  v_zenit int;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato';
  end if;

  if length(trim(coalesce(p_name, ''))) = 0 or length(p_name) > 80 then
    raise exception 'Inserisci un nome valido per l’oggetto';
  end if;
  if p_slot is null or p_slot not in ('arma', 'armatura', 'scudo', 'accessorio', 'altro') then
    raise exception 'Tipo di equipaggiamento non valido';
  end if;
  if p_quantity is null or p_quantity not between 1 and 999 then
    raise exception 'La quantità deve essere compresa tra 1 e 999';
  end if;
  if p_cost is null or p_cost < 0 or p_cost > 9999999 then
    raise exception 'Costo non valido';
  end if;
  if p_session_number is not null and p_session_number not between 1 and 999 then
    raise exception 'Il numero della sessione deve essere compreso tra 1 e 999';
  end if;
  if p_defense is null or p_magic_defense is null or p_initiative is null
    or p_defense not between -10 and 20 or p_magic_defense not between -10 and 20
    or p_initiative not between -10 and 20 then
    raise exception 'Bonus dell’equipaggiamento non validi';
  end if;
  if length(coalesce(p_summary, '')) > 2000 then
    raise exception 'Promemoria troppo lungo';
  end if;

  if p_acquisition is null or p_acquisition not in ('purchase', 'found', 'reward', 'gift') then
    raise exception 'Tipo di acquisizione non valido';
  end if;
  if p_acquisition = 'purchase' then
    if p_cost < 1 or p_payment_source is distinct from 'personal' then
      raise exception 'Per un acquisto indica il costo da pagare con Zenit personali';
    end if;
  elsif p_cost <> 0 or p_payment_source is not null then
    raise exception 'Un oggetto trovato o ricevuto non deve addebitare Zenit';
  end if;

  select campaign_id, owner_id, sheet
    into v_campaign, v_owner, v_sheet
    from public.characters
    where id = p_character_id
    for update;

  if not found or v_owner <> auth.uid() or not public.is_member(v_campaign) then
    raise exception 'Personaggio non disponibile';
  end if;

  if v_sheet is null then
    v_sheet := '{}'::jsonb;
  elsif jsonb_typeof(v_sheet) <> 'object' then
    raise exception 'La scheda del personaggio non è valida';
  end if;
  v_equipment := case
    when jsonb_typeof(v_sheet -> 'equipment') = 'array' then v_sheet -> 'equipment'
    else '[]'::jsonb
  end;
  if jsonb_array_length(v_equipment) >= 60 then
    raise exception 'La scheda può contenere al massimo 60 oggetti';
  end if;
  v_entry := jsonb_build_object(
    'name', trim(p_name),
    'slot', p_slot,
    'quantity', p_quantity,
    'cost', p_cost,
    'acquisition', p_acquisition,
    'paymentSource', p_payment_source,
    'sessionNumber', p_session_number,
    'date', coalesce(p_acquired_on, current_date),
    'defense', p_defense,
    'magicDefense', p_magic_defense,
    'initiative', p_initiative,
    'summary', coalesce(p_summary, '')
  );

  if p_acquisition = 'purchase' then
    v_zenit := coalesce(nullif(v_sheet ->> 'zenit', '')::int, 0);
    if v_zenit < p_cost then
      raise exception 'Zenit personali insufficienti: disponibili %, necessari %', v_zenit, p_cost;
    end if;
    v_sheet := jsonb_set(v_sheet, '{zenit}', to_jsonb(v_zenit - p_cost), true);
  end if;

  v_sheet := jsonb_set(v_sheet, '{equipment}', v_equipment || jsonb_build_array(v_entry), true);
  update public.characters
    set sheet = v_sheet, updated_at = now()
    where id = p_character_id;
end;
$$;

revoke execute on function public.record_character_equipment(uuid, text, text, int, int, text, text, int, date, int, int, int, text) from public, anon;
grant execute on function public.record_character_equipment(uuid, text, text, int, int, text, text, int, date, int, int, int, text) to authenticated;

revoke all privileges on table public.party_ledger, public.party_items
  from public, anon, authenticated;

drop policy if exists ledger_select on public.party_ledger;
drop policy if exists ledger_insert on public.party_ledger;
drop policy if exists ledger_delete on public.party_ledger;
drop policy if exists items_select on public.party_items;
drop policy if exists items_insert on public.party_items;
drop policy if exists items_update on public.party_items;
drop policy if exists items_delete on public.party_items;
