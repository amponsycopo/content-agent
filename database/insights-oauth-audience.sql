-- Optional new Auth hook; do not apply or replace an existing hook without review.
-- Replace INSIGHTS_OAUTH_CLIENT_ID below with the registered client UUID before applying.
-- Only that client's grants for the dedicated admin receive the MCP audience.
create or replace function public.insights_oauth_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare claims jsonb := event->'claims';
begin
 if event->>'user_id'='ecf3f73c-b49f-45e0-88b0-42cd113c9577'
    and claims->>'client_id'='INSIGHTS_OAUTH_CLIENT_ID' then
   claims := jsonb_set(claims,'{aud}','"https://insight.erlandoski.com/mcp"'::jsonb);
 end if;
 return jsonb_build_object('claims',claims);
end;
$$;
revoke all on function public.insights_oauth_access_token_hook(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.insights_oauth_access_token_hook(jsonb) to supabase_auth_admin;
