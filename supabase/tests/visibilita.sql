-- Test delle regole di visibilità di Cronache del Tavolo.
--
-- Come si usa: incolla tutto nell'SQL Editor di Supabase ed esegui.
-- Crea un Master, due giocatori e un estraneo finti, prova chi vede cosa e poi
-- ANNULLA TUTTO: alla fine non resta nessun dato di prova nel database.
--
-- Risultato:
--   "✅ TUTTI I TEST SUPERATI"  -> va tutto bene (compare come "errore" solo
--                                  perché è il modo per annullare i dati di prova)
--   "❌ TEST FALLITO: …"        -> una regola non funziona: il messaggio dice quale

do $test$
declare
  gm       uuid := gen_random_uuid();
  p1       uuid := gen_random_uuid();
  p2       uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  camp     uuid;
  code     text;
  e_priv   uuid;
  e_pub    uuid;
  e_p2     uuid;
  ch1      uuid;
  note_pub uuid;
  quote1   uuid;
  rel_pub  uuid;
  n        int;
  failed   boolean;
begin
  -- Utenti finti (il trigger crea i profili) ---------------------------------
  insert into auth.users (id, email, raw_user_meta_data) values
    (gm,       'test-' || gm       || '@test.invalid', '{"display_name":"Master di prova"}'),
    (p1,       'test-' || p1       || '@test.invalid', '{"display_name":"Giocatore 1"}'),
    (p2,       'test-' || p2       || '@test.invalid', '{"display_name":"Giocatore 2"}'),
    (outsider, 'test-' || outsider || '@test.invalid', '{"display_name":"Estraneo"}');

  -- Il Master crea la campagna ------------------------------------------------
  perform set_config('role', 'authenticated', true);
  assert not has_table_privilege('authenticated', 'public.party_items', 'select'),
    '❌ TEST FALLITO: l’API utente espone ancora l’inventario condiviso';
  assert not has_table_privilege('authenticated', 'public.party_ledger', 'select'),
    '❌ TEST FALLITO: l’API utente espone ancora la cassa comune';
  perform set_config('request.jwt.claim.sub', gm::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', gm, 'role', 'authenticated')::text, true);
  camp := public.create_campaign('Campagna di prova');
  select invite_code into code from public.campaigns where id = camp;
  insert into public.entity_cards (campaign_id, kind, slug, name, description)
  values (camp, 'npc', 'velia', 'Velia', 'Descrizione del Master');
  insert into storage.objects (bucket_id, name) values ('compendio', camp || '/npc/velia-1.png');

  -- Giocatore 1: entra e scrive -------------------------------------------------
  perform set_config('request.jwt.claim.sub', p1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  perform public.join_campaign(code);
  e_priv := public.create_entry(camp, 1, 'Segreto su @Velia e @Ombra', '[{"kind":"npc","slug":"velia","name":"Velia"},{"kind":"npc","slug":"ombra","name":"Ombra"}]', array['Chi è Ombra?'], '{}', false);
  e_pub  := public.create_entry(camp, 1, 'Pubblico: @Velia a #Portocielo', '[{"kind":"npc","slug":"velia","name":"Velia"},{"kind":"place","slug":"portocielo","name":"Portocielo"}]', '{}', array['Trovare la bussola'], true);
  insert into public.characters (campaign_id, owner_id, name) values (camp, p1, 'PG di prova') returning id into ch1;
  insert into public.entity_notes (campaign_id, owner_id, kind, slug, name, body, is_public)
  values (camp, p1, 'npc', 'velia', 'Velia', 'Nota privata di G1', false);
  insert into public.entity_notes (campaign_id, owner_id, kind, slug, name, body, is_public)
  values (camp, p1, 'npc', 'velia', 'Velia', 'Nota pubblica di G1', true) returning id into note_pub;
  insert into storage.objects (bucket_id, name) values ('ritratti', camp || '/' || p1 || '/ritratto.png');
  insert into public.ai_recaps (campaign_id, user_id, session_number, content) values (camp, p1, 1, 'Riassunto personale di G1');
  insert into public.ai_chapters (campaign_id, user_id, session_number, title, content) values (camp, p1, 1, 'Capitolo', 'Capitolo personale di G1');
  insert into public.quotes (campaign_id, author_id, speaker, text, session_number)
  values (camp, p1, 'Mastro Odo', 'Non toccate la bussola!', 1) returning id into quote1;
  insert into public.entity_relations (campaign_id, owner_id, from_kind, from_slug, from_name, label, to_kind, to_slug, to_name, is_public)
  values (camp, p1, 'npc', 'velia', 'Velia', 'sorella di', 'npc', 'odo', 'Mastro Odo', true) returning id into rel_pub;
  insert into public.entity_relations (campaign_id, owner_id, from_kind, from_slug, from_name, label, to_kind, to_slug, to_name, is_public)
  values (camp, p1, 'npc', 'velia', 'Velia', 'nasconde qualcosa a', 'npc', 'ombra', 'Ombra', false);

  failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('ritratti', camp || '/' || p2 || '/finto.png');
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: un giocatore riesce a caricare un ritratto al posto di un altro';

  -- Le immagini di PNG e luoghi le carica chiunque nella campagna.
  insert into storage.objects (bucket_id, name) values ('compendio', camp || '/npc/velia-2.png');
  insert into public.entity_images (campaign_id, kind, slug, name, image_path, uploaded_by)
  values (camp, 'npc', 'velia', 'Velia', camp || '/npc/velia-2.png', p1);

  failed := false;
  begin
    insert into public.entity_cards (campaign_id, kind, slug, name) values (camp, 'place', 'portocielo', 'Portocielo');
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: un giocatore riesce a scrivere la scheda pubblica del compendio';

  -- Al massimo sei Legami
  insert into public.bonds (character_id, target, emotions)
  select ch1, 'Legame ' || i, array['Affetto'] from generate_series(1, 6) i;
  failed := false;
  begin
    insert into public.bonds (character_id, target, emotions) values (ch1, 'Settimo', array['Odio']);
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: si possono creare più di sei Legami';

  -- Giocatore 2: entra e scrive -------------------------------------------------
  perform set_config('request.jwt.claim.sub', p2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  perform public.join_campaign(code);
  e_p2 := public.create_entry(camp, 1, 'Diario privato di G2', '[]', '{}', '{}', false);

  select count(*) into n from public.entries where campaign_id = camp;
  assert n = 2, format('❌ TEST FALLITO: G2 dovrebbe vedere 2 voci (la sua + quella pubblica di G1), ne vede %s', n);
  select count(*) into n from public.entries where id = e_priv;
  assert n = 0, '❌ TEST FALLITO: G2 legge una voce privata di G1';
  select count(*) into n from public.entities where campaign_id = camp and slug = 'ombra';
  assert n = 0, '❌ TEST FALLITO: G2 vede un personaggio citato solo nel diario privato di G1';
  select count(*) into n from public.entities where campaign_id = camp and slug in ('velia', 'portocielo');
  assert n = 2, format('❌ TEST FALLITO: G2 dovrebbe vedere Velia e Portocielo dalla voce pubblica, ne vede %s', n);
  select count(*) into n from public.entry_mentions where entry_id = e_priv;
  assert n = 0, '❌ TEST FALLITO: G2 vede le citazioni di una voce privata di G1';
  select count(*) into n from public.threads where campaign_id = camp;
  assert n = 0, format('❌ TEST FALLITO: G2 vede %s fili/obiettivi di G1 (devono restare privati)', n);
  select count(*) into n from public.characters where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: G2 vede la scheda di G1';
  select count(*) into n from public.entity_notes where campaign_id = camp;
  assert n = 1, format('❌ TEST FALLITO: G2 dovrebbe vedere solo la nota pubblica di G1, ne vede %s', n);
  select count(*) into n from public.entity_cards where campaign_id = camp;
  assert n = 1, '❌ TEST FALLITO: G2 non vede la scheda pubblica del Master';
  select count(*) into n from public.profiles where id = p1;
  assert n = 1, '❌ TEST FALLITO: G2 non vede il nome di G1 (serve per firmare le voci pubbliche)';
  select count(*) into n from storage.objects where bucket_id = 'ritratti' and name like camp || '/%';
  assert n = 1, '❌ TEST FALLITO: G2 non vede il ritratto di G1 (i ritratti li vedono tutti al tavolo)';
  select count(*) into n from public.campaign_party(camp) where character_name = 'PG di prova';
  assert n = 1, '❌ TEST FALLITO: G2 non vede nome e ritratto del PG di G1 nel gruppo';
  select count(*) into n from storage.objects where bucket_id = 'compendio' and name like camp || '/%';
  assert n = 2, format('❌ TEST FALLITO: G2 dovrebbe vedere 2 immagini del compendio, ne vede %s', n);
  update public.entity_images set image_path = camp || '/npc/velia-3.png', uploaded_by = p2 where campaign_id = camp and slug = 'velia';
  get diagnostics n = row_count;
  assert n = 1, '❌ TEST FALLITO: G2 non riesce a cambiare l''immagine di un PNG';
  failed := false;
  begin
    update public.entity_images set uploaded_by = p1 where campaign_id = camp and slug = 'velia';
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: si può attribuire un''immagine a qualcun altro';

  select count(*) into n from public.quotes where campaign_id = camp;
  assert n = 1, '❌ TEST FALLITO: G2 non vede le frasi memorabili (sono di tutti)';
  select count(*) into n from public.ai_recaps where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: G2 legge il riassunto AI personale di G1';
  select count(*) into n from public.ai_chapters where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: G2 legge il Libro della Campagna personale di G1';
  select count(*) into n from public.entity_relations where campaign_id = camp;
  assert n = 1, format('❌ TEST FALLITO: G2 dovrebbe vedere solo la relazione pubblica di G1, ne vede %s', n);
  update public.quotes set text = 'Manomessa' where id = quote1;
  get diagnostics n = row_count;
  assert n = 0, '❌ TEST FALLITO: G2 riesce a modificare una frase trascritta da G1';
  delete from public.entity_relations where id = rel_pub;
  get diagnostics n = row_count;
  assert n = 0, '❌ TEST FALLITO: G2 riesce a cancellare una relazione di G1';

  -- Limite AI: è personale e si ferma al limite.
  n := public.consume_ai_quota(2);
  assert n = 1, format('❌ TEST FALLITO: dopo 1 richiesta su 2 ne dovrebbe restare 1, ne restano %s', n);
  n := public.consume_ai_quota(2);
  failed := false;
  begin
    perform public.consume_ai_quota(2);
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: il limite giornaliero di richieste AI non blocca';
  perform public.refund_ai_quota();
  n := public.consume_ai_quota(2);
  assert n = 0, '❌ TEST FALLITO: una richiesta AI restituita non torna disponibile';
  failed := false;
  begin
    insert into public.ai_usage (user_id, day, used) values (p2, public.ai_today(), 0)
    on conflict (user_id, day) do update set used = 0;
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: si può azzerare a mano il proprio contatore AI';

  update public.entity_notes set body = 'Manomessa' where id = note_pub;
  get diagnostics n = row_count;
  assert n = 0, '❌ TEST FALLITO: G2 riesce a modificare una nota di G1';
  update public.entries set body = 'Manomessa' where id = e_pub;
  get diagnostics n = row_count;
  assert n = 0, '❌ TEST FALLITO: G2 riesce a modificare una voce pubblica di G1';
  failed := false;
  begin
    perform public.update_entry(e_pub, 1, 'Manomessa', '[]', '{}', '{}', true);
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: G2 riesce a modificare una voce di G1 con update_entry';

  -- Estraneo: non vede niente --------------------------------------------------
  perform set_config('request.jwt.claim.sub', outsider::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  select count(*) into n from public.entries where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: un estraneo legge il diario della campagna';
  select count(*) into n from public.entity_cards where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: un estraneo legge il compendio della campagna';
  select count(*) into n from public.entity_notes where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: un estraneo legge le note pubbliche della campagna';
  select count(*) into n from public.profiles where id in (gm, p1, p2);
  assert n = 0, '❌ TEST FALLITO: un estraneo vede i nomi dei membri';
  select count(*) into n from storage.objects where name like camp || '/%';
  assert n = 0, '❌ TEST FALLITO: un estraneo vede le immagini della campagna';
  select count(*) into n from public.campaign_party(camp);
  assert n = 0, '❌ TEST FALLITO: un estraneo vede chi gioca nella campagna';
  select count(*) into n from public.quotes where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: un estraneo legge le frasi memorabili';
  select count(*) into n from public.entity_relations where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: un estraneo legge le relazioni';
  select count(*) into n from public.ai_usage where user_id = p2;
  assert n = 0, '❌ TEST FALLITO: un estraneo vede il contatore AI di un altro';
  select count(*) into n from public.entity_images where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: un estraneo vede le immagini dei PNG';
  failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('compendio', camp || '/npc/intruso.png');
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: un estraneo riesce a caricare immagini nel compendio della campagna';

  -- Master: vede tutto ----------------------------------------------------------
  perform set_config('request.jwt.claim.sub', gm::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', gm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.entries where campaign_id = camp;
  assert n = 3, format('❌ TEST FALLITO: il Master dovrebbe vedere 3 voci, ne vede %s', n);
  select count(*) into n from public.threads where campaign_id = camp;
  assert n = 2, format('❌ TEST FALLITO: il Master dovrebbe vedere 2 fili/obiettivi, ne vede %s', n);
  select count(*) into n from public.threads where campaign_id = camp and kind = 'goal';
  assert n = 1, '❌ TEST FALLITO: l''obiettivo "! Trovare la bussola" non è stato salvato come obiettivo';
  select count(*) into n from public.entity_notes where campaign_id = camp;
  assert n = 2, '❌ TEST FALLITO: il Master non vede tutte le note del compendio';
  select count(*) into n from public.characters where campaign_id = camp;
  assert n = 1, '❌ TEST FALLITO: il Master non vede la scheda di G1';
  select count(*) into n from storage.objects where bucket_id = 'ritratti' and name like camp || '/%';
  assert n = 1, '❌ TEST FALLITO: il Master non vede il ritratto di G1';
  update public.entries set body = 'Manomessa' where id = e_pub;
  get diagnostics n = row_count;
  assert n = 0, '❌ TEST FALLITO: il Master riesce a modificare una voce di un giocatore';
  select count(*) into n from public.entity_relations where campaign_id = camp;
  assert n = 2, '❌ TEST FALLITO: il Master non vede tutte le relazioni';
  select count(*) into n from public.ai_recaps where campaign_id = camp;
  assert n = 0, '❌ TEST FALLITO: il Master legge il riassunto AI personale di G1 (è scritto per lui solo)';
  delete from public.quotes where id = quote1;
  get diagnostics n = row_count;
  assert n = 1, '❌ TEST FALLITO: il Master non riesce a togliere una frase memorabile';
  -- Giocatore 1 modifica la sua voce pubblica e la rende privata ---------------
  perform set_config('request.jwt.claim.sub', p1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p1, 'role', 'authenticated')::text, true);
  perform public.update_entry(e_pub, 2, 'Ora privata: @Velia', '[{"kind":"npc","slug":"velia","name":"Velia"}]', array['Nuova domanda?'], '{}', false);
  select count(*) into n from public.threads where entry_id = e_pub and kind = 'goal';
  assert n = 0, '❌ TEST FALLITO: togliendo la riga "!" dalla voce, l''obiettivo non viene rimosso';
  select count(*) into n from public.threads where entry_id = e_pub and kind = 'question';
  assert n = 1, '❌ TEST FALLITO: aggiungendo una riga "?" alla voce, il filo non viene creato';
  select count(*) into n from public.entry_mentions where entry_id = e_pub;
  assert n = 1, '❌ TEST FALLITO: dopo la modifica le citazioni della voce non sono aggiornate';

  perform set_config('request.jwt.claim.sub', p2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.entries where campaign_id = camp;
  assert n = 1, '❌ TEST FALLITO: G2 vede ancora una voce che G1 ha reso privata';
  select count(*) into n from public.entities where campaign_id = camp and owner_id = p1;
  assert n = 0, '❌ TEST FALLITO: G2 vede ancora i personaggi di una voce tornata privata';

  -- Chi non ha fatto l'accesso non legge niente -------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  failed := false;
  begin
    select count(*) into n from public.entries;
    failed := n = 0;
  exception when others then failed := true;
  end;
  assert failed, '❌ TEST FALLITO: un utente non collegato legge il diario';

  raise exception '✅ TUTTI I TEST SUPERATI (i dati di prova sono stati annullati)';
end;
$test$;
