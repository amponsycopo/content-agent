-- All test fixtures roll back. Use the same database role as the server.
begin;
set local role service_role;
do $$
declare
  a uuid; b uuid; r uuid;
  test_slug text := 'codex-lifecycle-check-' || gen_random_uuid()::text;
begin
  insert into public.webinar_events(slug,title,starts_at,scalev_product_id)
    values(test_slug,'Lifecycle check',now(),412147) returning id into a;
  insert into public.webinar_events(slug,title,starts_at,scalev_product_id)
    values(test_slug || '-second','Lifecycle check',now(),412147) returning id into b;
  begin
    update public.webinar_events set slug=test_slug where id=b;
    raise exception 'FAIL: duplicate slug accepted';
  exception when unique_violation then null; end;
  delete from public.webinar_events where id=b;
  if exists(select 1 from public.webinar_events where id=b) then raise exception 'FAIL: empty draft not deleted'; end if;

  insert into public.webinar_registrations(event_id,email,full_name,whatsapp)
    values(a,'lifecycle-check@example.invalid','Lifecycle check','628000000000') returning id into r;
  begin
    delete from public.webinar_events where id=a;
    raise exception 'FAIL: draft with participant deleted';
  exception when check_violation then null; end;

  update public.webinar_events set status='open' where id=a;
  if not exists(select 1 from public.webinar_events where id=a and published_at is not null) then raise exception 'FAIL: publication not recorded'; end if;
  update public.webinar_events set archived_at=now(),status='closed' where id=a;
  if not exists(select 1 from public.webinar_registrations where id=r) then raise exception 'FAIL: archive removed participant'; end if;
  begin
    update public.webinar_events set status='open' where id=a;
    raise exception 'FAIL: archived event opened';
  exception when check_violation then null; end;
  update public.webinar_events set archived_at=null where id=a;
  if not exists(select 1 from public.webinar_events where id=a and status='closed' and archived_at is null) then raise exception 'FAIL: restore reopened registration'; end if;
  delete from public.webinar_registrations where id=r;
  update public.webinar_events set status='draft',published_at=null where id=a;
  begin
    delete from public.webinar_events where id=a;
    raise exception 'FAIL: previously published event deleted';
  exception when check_violation then null; end;
end;
$$;
rollback;
select 'PASS: duplicate title allowed; duplicate slug rejected; empty draft deletion allowed; participant draft protected; archive preserves participant; archived opening blocked; restore stays closed; publication history protects deletion. Fixtures rolled back.' as result;
