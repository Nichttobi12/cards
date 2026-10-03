alter table public.portal_accounts drop constraint if exists portal_accounts_username_check;
alter table public.portal_accounts add constraint portal_accounts_username_check check(username ~ '^[A-Za-z0-9_]{3,30}$');
create unique index if not exists portal_accounts_username_lower on public.portal_accounts(lower(username));
create or replace function public.portal_register_account(account_id uuid,account_username text,account_email text) returns void language plpgsql security invoker set search_path='' as $$
declare account_slot smallint;
begin
 perform pg_advisory_xact_lock(31415926);
 -- Only the server can call this after successful Auth Admin creation. The FK verifies the user ID.
 select coalesce(max(slot),0)+1 into account_slot from public.portal_accounts;
 insert into public.portal_accounts(slot,username,email,user_id,role,active) values(account_slot,account_username,account_email,account_id,'user',true);
 insert into public.collections(id,owner,name,created) values(gen_random_uuid()::text,account_id,'Sammlung',now()::text);
end $$;
revoke all on function public.portal_register_account(uuid,text,text) from public,anon,authenticated;
grant execute on function public.portal_register_account(uuid,text,text) to service_role;
