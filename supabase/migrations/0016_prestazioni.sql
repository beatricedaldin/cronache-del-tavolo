-- Prestazioni: policy RLS con auth.uid() calcolato una sola volta per query e indici per la ricerca.

-- ---------------------------------------------------------------------------
-- 1. auth.uid() → (select auth.uid())
-- Scritto "nudo" nelle policy, Postgres lo rivaluta riga per riga. Avvolto in una
-- sub-select diventa un InitPlan, calcolato una volta sola. Il risultato è identico.
-- Si riscrivono tutte le policy di public e storage che lo usano ancora nudo
-- (idempotente: quelle già avvolte non vengono toccate).
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (qual ~* '(?<!select )auth\.uid\(\)' or with_check ~* '(?<!select )auth\.uid\(\)')
  loop
    v_using := case when p.qual is null then null
      else regexp_replace(p.qual, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi') end;
    v_check := case when p.with_check is null then null
      else regexp_replace(p.with_check, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi') end;
    v_sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if v_using is not null then v_sql := v_sql || format(' using (%s)', v_using); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Indici
-- ---------------------------------------------------------------------------
-- "Le mie campagne": la chiave primaria parte da campaign_id, non aiuta cercando per utente.
create index if not exists campaign_members_user_idx on public.campaign_members (user_id);

-- Ricerca con ILIKE '%testo%' (pagina Cerca): senza indici legge tutte le righe.
create extension if not exists pg_trgm with schema extensions;

create index if not exists entries_body_trgm on public.entries using gin (body extensions.gin_trgm_ops);
create index if not exists entity_notes_body_trgm on public.entity_notes using gin (body extensions.gin_trgm_ops);
create index if not exists entity_cards_name_trgm on public.entity_cards using gin (name extensions.gin_trgm_ops);
create index if not exists entity_cards_description_trgm on public.entity_cards using gin (description extensions.gin_trgm_ops);
create index if not exists entities_name_trgm on public.entities using gin (name extensions.gin_trgm_ops);
create index if not exists threads_text_trgm on public.threads using gin (text extensions.gin_trgm_ops);
create index if not exists quotes_text_trgm on public.quotes using gin (text extensions.gin_trgm_ops);
create index if not exists quotes_speaker_trgm on public.quotes using gin (speaker extensions.gin_trgm_ops);
