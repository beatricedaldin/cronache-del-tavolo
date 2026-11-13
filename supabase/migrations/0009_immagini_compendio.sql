-- Immagini di PNG e luoghi del compendio: le carica CHIUNQUE nella campagna.
--
--   * l'immagine la vedono tutti i membri, la può caricare o cambiare chiunque
--   * la può togliere chi l'ha caricata oppure il Master
--   * la descrizione (entity_cards) resta scritta solo dal Master
--
-- Le immagini già caricate dal Master nella scheda vengono copiate qui.
-- Lo script si può rieseguire senza problemi.

create table if not exists public.entity_images (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind        public.entity_kind not null,
  slug        text not null,
  name        text not null,
  image_path  text not null,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (campaign_id, kind, slug)
);

alter table public.entity_images enable row level security;

drop policy if exists images_select on public.entity_images;
drop policy if exists images_insert on public.entity_images;
drop policy if exists images_update on public.entity_images;
drop policy if exists images_delete on public.entity_images;
create policy images_select on public.entity_images for select using (public.is_member(campaign_id));
create policy images_insert on public.entity_images for insert
  with check (uploaded_by = auth.uid() and public.is_member(campaign_id));
-- Chi cambia l'immagine ne diventa l'autore.
create policy images_update on public.entity_images for update
  using (public.is_member(campaign_id)) with check (uploaded_by = auth.uid() and public.is_member(campaign_id));
create policy images_delete on public.entity_images for delete
  using (uploaded_by = auth.uid() or public.is_gm(campaign_id));

-- Le immagini già nella scheda del Master.
insert into public.entity_images (campaign_id, kind, slug, name, image_path, uploaded_by, updated_at)
select c.campaign_id, c.kind, c.slug, c.name, c.image_path, camp.gm_id, c.updated_at
from public.entity_cards c
join public.campaigns camp on camp.id = c.campaign_id
where c.image_path is not null
on conflict do nothing;

-- I file nel bucket "compendio": ora li caricano e sostituiscono tutti i membri.
drop policy if exists compendio_insert on storage.objects;
drop policy if exists compendio_update on storage.objects;
drop policy if exists compendio_delete on storage.objects;
create policy compendio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'compendio' and public.is_member(public.campaign_from_path(name)));
create policy compendio_update on storage.objects for update to authenticated
  using (bucket_id = 'compendio' and public.is_member(public.campaign_from_path(name)));
create policy compendio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'compendio' and public.is_member(public.campaign_from_path(name)));

grant select, insert, update, delete on public.entity_images to authenticated;
