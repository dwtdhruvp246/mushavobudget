-- Read-only checks: apply the branding migration, then run this before release.
with signatures as (
 select unnest(array['public.business_logo_owner(text)','public.business_logo_readable(text)',
 'public.save_business_branding(uuid,text,text,integer)',
 'public.save_business_setup_with_branding(uuid,text,text,text[],text,integer,integer,integer,timestamp with time zone,text)']) signature
), checks as (
 select 1 n,'Business logo bucket exists and is private' check_name,exists(select 1 from storage.buckets where id='business-logos' and not public) ok
 union all select 2,'Logo uploads are capped at 2 MB',exists(select 1 from storage.buckets where id='business-logos' and file_size_limit=2097152)
 union all select 3,'Only PNG, JPEG and WebP uploads allowed',exists(select 1 from storage.buckets where id='business-logos' and allowed_mime_types @> array['image/png','image/jpeg','image/webp'] and allowed_mime_types <@ array['image/png','image/jpeg','image/webp'])
 union all select 4,'All four branding functions exist',(select count(*)=4 from signatures where to_regprocedure(signature) is not null)
 union all select 5,'Branding functions use protected execution',(select count(*)=4 from signatures s join pg_proc p on p.oid=to_regprocedure(s.signature) where p.prosecdef)
 union all select 6,'Branding functions use a fixed search path',(select count(*)=4 from signatures s join pg_proc p on p.oid=to_regprocedure(s.signature) where p.proconfig @> array['search_path=public, pg_temp'])
 union all select 7,'Authenticated members can call the branding API',(select count(*)=4 from signatures where has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE'))
 union all select 8,'Anonymous branding API access is denied',(select count(*)=4 from signatures where not has_function_privilege('anon',to_regprocedure(signature),'EXECUTE'))
 union all select 9,'Storage row security is enabled',(select relrowsecurity from pg_class where oid=to_regclass('storage.objects'))
 union all select 10,'Owner upload policy is installed',exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='business_logos_owner_upload' and cmd='INSERT' and with_check like '%business_logo_owner(name)%' and with_check like '%business-logos%')
 union all select 11,'Member read and owner cleanup read policy is installed',exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='business_logos_member_read' and cmd='SELECT' and qual like '%business_logo_readable(name)%' and qual like '%business_logo_owner(name)%')
 union all select 12,'Delete policy protects attached logos',exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='business_logos_owner_remove' and cmd='DELETE' and qual like '%business_logo_owner(name)%' and qual like '%NOT business_logo_readable(name)%')
 union all select 13,'Upload guard verifies active Owner membership',pg_get_functiondef(to_regprocedure('public.business_logo_owner(text)')) like '%business_owner%' and pg_get_functiondef(to_regprocedure('public.business_logo_owner(text)')) like '%paid_through_at%'
 union all select 14,'Logo read guard checks membership and active subscription',pg_get_functiondef(to_regprocedure('public.business_logo_readable(text)')) like '%is_business_workspace_member%' and pg_get_functiondef(to_regprocedure('public.business_logo_readable(text)')) like '%paid_through_at%'
 union all select 15,'Save verifies owner and stale profile version',pg_get_functiondef(to_regprocedure('public.save_business_branding(uuid,text,text,integer)')) like '%business_setup_owner_required%' and pg_get_functiondef(to_regprocedure('public.save_business_branding(uuid,text,text,integer)')) like '%BUSINESS_SETUP_CHANGED%'
 union all select 16,'Save validates stored object and workspace path',pg_get_functiondef(to_regprocedure('public.save_business_branding(uuid,text,text,integer)')) like '%storage.objects%' and pg_get_functiondef(to_regprocedure('public.save_business_branding(uuid,text,text,integer)')) like '%p_workspace_id::text%'
 union all select 17,'Branding changes write the audit log',pg_get_functiondef(to_regprocedure('public.save_business_branding(uuid,text,text,integer)')) like '%business.branding_updated%'
 union all select 18,'First setup saves details and logo in one transaction',pg_get_functiondef(to_regprocedure('public.save_business_setup_with_branding(uuid,text,text,text[],text,integer,integer,integer,timestamp with time zone,text)')) like '%public.save_business_setup(%' and pg_get_functiondef(to_regprocedure('public.save_business_setup_with_branding(uuid,text,text,text[],text,integer,integer,integer,timestamp with time zone,text)')) like '%public.save_business_branding(%'
 union all select 19,'Business profile version trigger is enabled',exists(select 1 from pg_trigger where tgrelid=to_regclass('public.business_profiles') and tgname='business_profiles_touch_updated_at' and tgenabled<>'D' and not tgisinternal)
 union all select 20,'Every attached business logo has a stored object',not exists(select 1 from public.business_profiles p where p.logo_storage_path is not null and not exists(select 1 from storage.objects o where o.bucket_id='business-logos' and o.name=p.logo_storage_path))
)
select check_name,case when coalesce(ok,false) then 'PASS' else 'FAIL' end result from checks order by n;
