begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-logos','business-logos',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.business_logo_owner(p_name text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and not public.my_account_suspended()
 and p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
 and split_part(p_name,'/',2)=auth.uid()::text
 and exists(select 1 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
   join public.workspace_members m on m.workspace_id=w.id and m.user_id=auth.uid() and m.status='active' and m.role='business_owner'
   where w.id::text=split_part(p_name,'/',1) and w.workspace_type='business' and w.owner_id=auth.uid() and w.status='active'
   and s.status='active' and s.paid_through_at>now());
$$;
create or replace function public.business_logo_readable(p_name text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and not public.my_account_suspended() and exists(
 select 1 from public.business_profiles p join public.workspace_subscriptions s on s.workspace_id=p.workspace_id
 where p.logo_storage_path=p_name and public.is_business_workspace_member(p.workspace_id)
 and s.status='active' and s.paid_through_at>now());
$$;
revoke all on function public.business_logo_owner(text),public.business_logo_readable(text) from public,anon;
grant execute on function public.business_logo_owner(text),public.business_logo_readable(text) to authenticated;
drop policy if exists business_logos_owner_upload on storage.objects;
create policy business_logos_owner_upload on storage.objects for insert to authenticated
 with check(bucket_id='business-logos' and public.business_logo_owner(name));
drop policy if exists business_logos_member_read on storage.objects;
create policy business_logos_member_read on storage.objects for select to authenticated
 using(bucket_id='business-logos' and (public.business_logo_readable(name) or public.business_logo_owner(name)));
-- Replaced/unlinked files are private and can be cleaned up by their uploader.
drop policy if exists business_logos_owner_remove on storage.objects;
create policy business_logos_owner_remove on storage.objects for delete to authenticated
 using(bucket_id='business-logos' and public.business_logo_owner(name) and not public.business_logo_readable(name));

create or replace function public.save_business_branding(p_workspace_id uuid,p_trading_name text,p_logo_path text,p_expected_version integer)
returns public.business_profiles language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.business_profiles%rowtype;v_new public.business_profiles%rowtype;v_name text:=btrim(coalesce(p_trading_name,''));v_meta jsonb;
begin
 perform 1 from public.budget_workspaces where id=p_workspace_id for update;
 perform public.business_setup_owner_required(p_workspace_id);
 if char_length(v_name) not between 2 and 120 then raise exception 'INVALID_BUSINESS_BRANDING_NAME'; end if;
 select * into v_old from public.business_profiles where workspace_id=p_workspace_id for update;
 if not found or p_expected_version is distinct from v_old.version then raise exception 'BUSINESS_SETUP_CHANGED'; end if;
 if p_logo_path is not null and p_logo_path is distinct from v_old.logo_storage_path then
   if not public.business_logo_owner(p_logo_path) or split_part(p_logo_path,'/',1)<>p_workspace_id::text then raise exception 'INVALID_BUSINESS_LOGO'; end if;
   select metadata into v_meta from storage.objects where bucket_id='business-logos' and name=p_logo_path for share;
   if not found or coalesce(v_meta->>'mimetype','') not in ('image/png','image/jpeg','image/webp')
     or coalesce((v_meta->>'size')::bigint,(v_meta->>'contentLength')::bigint,0) not between 1 and 2097152 then raise exception 'INVALID_BUSINESS_LOGO'; end if;
 end if;
 update public.business_profiles set trading_name=v_name,logo_storage_path=p_logo_path,version=version+1,updated_at=now()
 where workspace_id=p_workspace_id returning * into v_new;
 update public.budget_workspaces set name=v_name where id=p_workspace_id;
 perform public.business_record_audit_event(p_workspace_id,'business.branding_updated','workspace',p_workspace_id,
   jsonb_build_object('name',v_old.trading_name,'has_logo',v_old.logo_storage_path is not null),
   jsonb_build_object('name',v_name,'has_logo',p_logo_path is not null));
 return v_new;
end;
$$;
revoke all on function public.save_business_branding(uuid,text,text,integer) from public,anon;
grant execute on function public.save_business_branding(uuid,text,text,integer) to authenticated;

-- First-time setup saves details and the selected logo in one transaction.
create or replace function public.save_business_setup_with_branding(p_workspace_id uuid,p_trading_name text,p_base_currency text,
 p_enabled_currencies text[],p_timezone text,p_financial_year_start_month integer,p_period_start_day integer,
 p_expected_profile_version integer,p_expected_settings_updated_at timestamptz,p_logo_path text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_saved jsonb;v_profile public.business_profiles%rowtype;
begin
 perform 1 from public.budget_workspaces where id=p_workspace_id for update;
 perform public.business_setup_owner_required(p_workspace_id);
 v_saved:=public.save_business_setup(p_workspace_id,p_trading_name,p_base_currency,p_enabled_currencies,p_timezone,
 p_financial_year_start_month,p_period_start_day,p_expected_profile_version,p_expected_settings_updated_at);
 v_profile:=public.save_business_branding(p_workspace_id,p_trading_name,p_logo_path,(v_saved->'profile'->>'version')::integer);
 return jsonb_set(v_saved,'{profile}',to_jsonb(v_profile));
end;
$$;
revoke all on function public.save_business_setup_with_branding(uuid,text,text,text[],text,integer,integer,integer,timestamptz,text) from public,anon;
grant execute on function public.save_business_setup_with_branding(uuid,text,text,text[],text,integer,integer,integer,timestamptz,text) to authenticated;
notify pgrst, 'reload schema';
commit;
