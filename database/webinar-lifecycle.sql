-- Additive changes limited to webinar tables. Run through Supabase migrations.
alter table public.webinar_events
  add column archived_at timestamptz,
  add column published_at timestamptz;

update public.webinar_events set published_at = created_at where status in ('open','closed');

alter table public.webinar_events add constraint webinar_events_archive_closed
  check (archived_at is null or status = 'closed');

create function public.webinar_event_lifecycle_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.status <> 'draft' or OLD.published_at is not null or OLD.archived_at is not null
       or exists (select 1 from public.webinar_registrations where event_id = OLD.id) then
      raise exception using errcode = '23514', message = 'WEBINAR_DELETE_FORBIDDEN';
    end if;
    return OLD;
  end if;
  if TG_OP = 'UPDATE' then
    NEW.published_at := OLD.published_at;
  else
    NEW.published_at := null;
  end if;
  if NEW.status in ('open','closed') and NEW.published_at is null then
    NEW.published_at := now();
  end if;
  return NEW;
end;
$$;
revoke all on function public.webinar_event_lifecycle_guard() from public, anon, authenticated;

create trigger webinar_event_lifecycle
before insert or update or delete on public.webinar_events
for each row execute function public.webinar_event_lifecycle_guard();
