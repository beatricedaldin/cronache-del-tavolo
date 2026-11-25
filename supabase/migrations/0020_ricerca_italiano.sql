-- Ricerca in italiano (pagina Cerca).
--
-- Prima si cercava la frase esatta: "chi ci ha rubato le mappe" non trovava "Mancavano
-- le mappe di Kael". Ora si cercano le singole parole, riconoscendo le varianti
-- (rubato/rubare, mappa/mappe), ignorando accenti e parole vuote (il, di, chi…),
-- e i risultati più pertinenti vengono prima. La ricerca della frase esatta resta:
-- l'app mette in cima quei risultati.
--
-- search_ranked è "security invoker": valgono le stesse regole di visibilità di
-- sempre, si trova solo quello che si può già leggere.
-- Lo script si può rieseguire senza problemi.

create extension if not exists unaccent with schema extensions;

-- La configurazione italiana di Postgres, più la rimozione degli accenti.
do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'italiano' and cfgnamespace = 'public'::regnamespace) then
    create text search configuration public.italiano (copy = pg_catalog.italian);
    alter text search configuration public.italiano
      alter mapping for hword, hword_part, word with extensions.unaccent, italian_stem;
  end if;
end;
$$;

-- Il testo pronto per la ricerca. Sempre la stessa funzione negli indici e nelle query,
-- altrimenti Postgres non usa gli indici.
create or replace function public.testo_ricerca(p text)
returns tsvector language sql immutable parallel safe set search_path = public, extensions, pg_catalog as $$
  select to_tsvector('public.italiano'::regconfig, coalesce(p, ''));
$$;

-- La domanda: le sue parole in "oppure", così basta che ne compaia una. Il punteggio
-- premia le voci che ne contengono di più. Null se restano solo parole vuote.
create or replace function public.domanda_ricerca(p text)
returns tsquery language sql immutable parallel safe set search_path = public, extensions, pg_catalog as $$
  select to_tsquery(
    'public.italiano'::regconfig,
    nullif(replace(plainto_tsquery('public.italiano'::regconfig, coalesce(p, ''))::text, ' & ', ' | '), '')
  );
$$;

create index if not exists entries_ricerca on public.entries using gin (public.testo_ricerca(body));
create index if not exists entity_notes_ricerca on public.entity_notes using gin (public.testo_ricerca(body));
create index if not exists entity_cards_ricerca on public.entity_cards using gin (public.testo_ricerca(name || ' ' || coalesce(description, '')));
create index if not exists threads_ricerca on public.threads using gin (public.testo_ricerca(text));
create index if not exists quotes_ricerca on public.quotes using gin (public.testo_ricerca(speaker || ' ' || text));

-- Risultati per pertinenza: da dove vengono, chiave, punteggio.
-- (Per il compendio la chiave è "tipo:slug".)
create or replace function public.search_ranked(p_campaign uuid, p_query text)
returns table (source text, key text, rank real)
language sql stable security invoker set search_path = public, extensions, pg_catalog as $$
  with q as (select public.domanda_ricerca(left(p_query, 100)) as q)
  (select 'entry', e.id::text, ts_rank(public.testo_ricerca(e.body), q.q)
   from public.entries e, q
   where e.campaign_id = p_campaign and public.testo_ricerca(e.body) @@ q.q
   order by 3 desc limit 30)
  union all
  (select 'note', n.id::text, ts_rank(public.testo_ricerca(n.body), q.q)
   from public.entity_notes n, q
   where n.campaign_id = p_campaign and public.testo_ricerca(n.body) @@ q.q
   order by 3 desc limit 30)
  union all
  (select 'card', c.kind || ':' || c.slug, ts_rank(public.testo_ricerca(c.name || ' ' || coalesce(c.description, '')), q.q)
   from public.entity_cards c, q
   where c.campaign_id = p_campaign and public.testo_ricerca(c.name || ' ' || coalesce(c.description, '')) @@ q.q
   order by 3 desc limit 30)
  union all
  (select 'thread', t.id::text, ts_rank(public.testo_ricerca(t.text), q.q)
   from public.threads t, q
   where t.campaign_id = p_campaign and public.testo_ricerca(t.text) @@ q.q
   order by 3 desc limit 30)
  union all
  (select 'quote', x.id::text, ts_rank(public.testo_ricerca(x.speaker || ' ' || x.text), q.q)
   from public.quotes x, q
   where x.campaign_id = p_campaign and public.testo_ricerca(x.speaker || ' ' || x.text) @@ q.q
   order by 3 desc limit 30);
$$;

revoke execute on function public.search_ranked(uuid, text) from public, anon;
grant execute on function public.testo_ricerca(text) to authenticated;
grant execute on function public.domanda_ricerca(text) to authenticated;
grant execute on function public.search_ranked(uuid, text) to authenticated;
