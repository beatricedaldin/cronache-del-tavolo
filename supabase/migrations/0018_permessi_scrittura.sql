-- Permessi di scrittura più stretti.
--
--   * Ognuno modifica e cancella le proprie cose SOLO finché è membro della campagna:
--     chi viene tolto o esce non può più riscrivere le voci pubbliche, le frasi o le
--     note che gli altri leggono (prima poteva, perché si controllava solo l'autore).
--   * Niente si sposta in un'altra campagna: campaign_id non cambia più dopo la creazione
--     (prima un autore poteva spostare una voce o una frase in una campagna altrui).
--   * Una citazione (@, #) collega solo le proprie entità della stessa campagna della voce:
--     non si può più "citare" l'entità privata di un altro per renderla visibile.
--   * Immagini del compendio: il file lo sostituisce o lo cancella chi l'ha caricato o il
--     Master. Gli altri membri possono cancellare solo i file non più in uso (quello vecchio,
--     quando cambiano l'immagine di un PNG o luogo: lo prevede la regola di 0009).
--
-- Le regole di lettura non cambiano. Lo script si può rieseguire senza problemi.

-- ---------------------------------------------------------------------------
-- 1. campaign_id non si cambia
-- ---------------------------------------------------------------------------
create or replace function public.keep_campaign_id()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'Non si può spostare in un''altra campagna';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['characters', 'entries', 'entities', 'threads', 'entity_notes', 'quotes', 'entity_relations', 'entity_images']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_keep_campaign', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.keep_campaign_id()',
      t || '_keep_campaign', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Modificare e cancellare le proprie cose: solo da membri
-- ---------------------------------------------------------------------------
drop policy if exists characters_update on public.characters;
drop policy if exists characters_delete on public.characters;
create policy characters_update on public.characters for update
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id))
  with check (owner_id = (select auth.uid()) and public.is_member(campaign_id));
create policy characters_delete on public.characters for delete
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id));

drop policy if exists bonds_write on public.bonds;
create policy bonds_write on public.bonds for all
  using (exists (
    select 1 from public.characters c
    where c.id = character_id and c.owner_id = (select auth.uid()) and public.is_member(c.campaign_id)
  ))
  with check (exists (
    select 1 from public.characters c
    where c.id = character_id and c.owner_id = (select auth.uid()) and public.is_member(c.campaign_id)
  ));

drop policy if exists entries_update on public.entries;
drop policy if exists entries_delete on public.entries;
create policy entries_update on public.entries for update
  using (author_id = (select auth.uid()) and public.is_member(campaign_id))
  with check (author_id = (select auth.uid()) and public.is_member(campaign_id));
create policy entries_delete on public.entries for delete
  using (author_id = (select auth.uid()) and public.is_member(campaign_id));

drop policy if exists entities_update on public.entities;
drop policy if exists entities_delete on public.entities;
create policy entities_update on public.entities for update
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id))
  with check (owner_id = (select auth.uid()) and public.is_member(campaign_id));
create policy entities_delete on public.entities for delete
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id));

drop policy if exists threads_update on public.threads;
drop policy if exists threads_delete on public.threads;
create policy threads_update on public.threads for update
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id))
  with check (owner_id = (select auth.uid()) and public.is_member(campaign_id));
create policy threads_delete on public.threads for delete
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id));

drop policy if exists notes_update on public.entity_notes;
drop policy if exists notes_delete on public.entity_notes;
create policy notes_update on public.entity_notes for update
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id))
  with check (owner_id = (select auth.uid()) and public.is_member(campaign_id));
create policy notes_delete on public.entity_notes for delete
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id));

drop policy if exists quotes_update on public.quotes;
drop policy if exists quotes_delete on public.quotes;
create policy quotes_update on public.quotes for update
  using (author_id = (select auth.uid()) and public.is_member(campaign_id))
  with check (author_id = (select auth.uid()) and public.is_member(campaign_id));
-- Il Master può togliere una frase (come prima).
create policy quotes_delete on public.quotes for delete
  using ((author_id = (select auth.uid()) and public.is_member(campaign_id)) or public.is_gm(campaign_id));

drop policy if exists relations_update on public.entity_relations;
drop policy if exists relations_delete on public.entity_relations;
create policy relations_update on public.entity_relations for update
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id))
  with check (owner_id = (select auth.uid()) and public.is_member(campaign_id));
create policy relations_delete on public.entity_relations for delete
  using (owner_id = (select auth.uid()) and public.is_member(campaign_id));

drop policy if exists images_delete on public.entity_images;
create policy images_delete on public.entity_images for delete
  using ((uploaded_by = (select auth.uid()) and public.is_member(campaign_id)) or public.is_gm(campaign_id));

-- ---------------------------------------------------------------------------
-- 3. Citazioni: solo le proprie entità, nella campagna della voce
-- ---------------------------------------------------------------------------
-- In una funzione a parte: la policy di lettura di entities guarda entry_mentions, quindi
-- leggere entities dalla policy di entry_mentions andrebbe in ricorsione.
create or replace function public.can_mention(p_entry uuid, p_entity uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.entries e
    join public.entities en on en.id = p_entity
    where e.id = p_entry
      and e.author_id = auth.uid()
      and en.owner_id = auth.uid()
      and en.campaign_id = e.campaign_id
      and public.is_member(e.campaign_id)
  );
$$;
revoke execute on function public.can_mention(uuid, uuid) from public, anon;
grant execute on function public.can_mention(uuid, uuid) to authenticated;

drop policy if exists mentions_insert on public.entry_mentions;
drop policy if exists mentions_delete on public.entry_mentions;
create policy mentions_insert on public.entry_mentions for insert
  with check (public.can_mention(entry_id, entity_id));
create policy mentions_delete on public.entry_mentions for delete
  using (exists (
    select 1 from public.entries e
    where e.id = entry_id and e.author_id = (select auth.uid()) and public.is_member(e.campaign_id)
  ));

-- ---------------------------------------------------------------------------
-- 4. File del compendio
-- ---------------------------------------------------------------------------
-- Il file è in uso se è l'immagine attuale di un PNG o luogo (o di una vecchia scheda del Master).
create or replace function public.compendio_file_in_use(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.entity_images where image_path = p_name)
      or exists (select 1 from public.entity_cards where image_path = p_name);
$$;
revoke execute on function public.compendio_file_in_use(text) from public, anon;
grant execute on function public.compendio_file_in_use(text) to authenticated;

drop policy if exists compendio_update on storage.objects;
drop policy if exists compendio_delete on storage.objects;
-- L'app non sovrascrive mai un file (ogni immagine ha un nome nuovo): lo può fare solo chi l'ha caricato.
create policy compendio_update on storage.objects for update to authenticated
  using (
    bucket_id = 'compendio'
    and owner_id = (select auth.uid())::text
    and public.is_member(public.campaign_from_path(name))
  );
create policy compendio_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'compendio'
    and public.is_member(public.campaign_from_path(name))
    and (
      owner_id = (select auth.uid())::text
      or public.is_gm(public.campaign_from_path(name))
      or not public.compendio_file_in_use(name)
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Indici che mancavano sui percorsi usati dalle policy e dalle cancellazioni
-- ---------------------------------------------------------------------------
create index if not exists entry_mentions_entity_idx on public.entry_mentions (entity_id);
create index if not exists threads_entry_idx on public.threads (entry_id);
create index if not exists threads_campaign_idx on public.threads (campaign_id);
create index if not exists bonds_character_idx on public.bonds (character_id);
create index if not exists entity_images_path_idx on public.entity_images (image_path);
