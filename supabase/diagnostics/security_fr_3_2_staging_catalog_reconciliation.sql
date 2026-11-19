-- Staging only. Record the exact reconciled catalog fingerprint while keeping
-- the two upload gates and Supabase Storage migration 80 in place.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '1500ms';
set local statement_timeout = '20s';

do $reconcile$
begin
  perform pg_advisory_xact_lock(20261017, 2411);
  perform 1 from mushavo_email_install.rollout_control where singleton for update;
  if not exists (
    select 1 from mushavo_email_install.rollout_control
    where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
      and catalog_sha256 = 'cc122f36b6cc70e4fa88fe12a765cc83f24a586d495dfd3084f26edc2134e84f'
  ) or mushavo_email_install.catalog_identity() is distinct from
    'f1e6c35c005e72b1e21585d46c0279b0265f0e14ae70f3be32dcaac2b8e300ff'
  then raise exception 'EXACT_RECONCILED_STAGING_CATALOG_REQUIRED'; end if;

  if not exists (
    select 1 from storage.migrations where id = 80
      and name = 'revoke-extra-lifecycle-postgres-grants'
      and hash = '18cfbf5c5b356469e1e95f3aa1b59ba111d82a06'
  ) or (
    select count(*) from supabase_migrations.schema_migrations m
    join (values
      ('20261112183459', 'security_fr3_logo_fixture_guard', '984d9c3489a5bbf30a23b19b7ec423f7fc9ad12336177d5447b910bdf0e4b5ad'),
      ('20261113173135', 'security_fr3_personal_proof_fixture_guard', '3f191ec3cb4fe8bd14052853264c336e3f42c77e1868eb4984c7a7fc7901e425')
    ) expected(version, name, sha256)
      on m.version = expected.version and m.name = expected.name
      and encode(sha256(convert_to(m.statements[1], 'UTF8')), 'hex') = expected.sha256
    where cardinality(m.statements) = 1
  ) <> 2 then raise exception 'EXACT_REVIEWED_MIGRATIONS_REQUIRED'; end if;

  update mushavo_email_install.rollout_control
  set catalog_sha256 = 'f1e6c35c005e72b1e21585d46c0279b0265f0e14ae70f3be32dcaac2b8e300ff', changed_at = clock_timestamp()
  where singleton and target_project = 'dczlddwbtgvfdujgcitb' and mode = 'ACTIVE'
    and catalog_sha256 = 'cc122f36b6cc70e4fa88fe12a765cc83f24a586d495dfd3084f26edc2134e84f';
  if not found or mushavo_email_install.catalog_identity() is distinct from
    'f1e6c35c005e72b1e21585d46c0279b0265f0e14ae70f3be32dcaac2b8e300ff'
  then raise exception 'STAGING_CATALOG_CHANGED_DURING_RECONCILIATION'; end if;
end;
$reconcile$;

select mode, catalog_sha256, catalog_sha256 = mushavo_email_install.catalog_identity() as matches
from mushavo_email_install.rollout_control
where singleton and target_project = 'dczlddwbtgvfdujgcitb';
commit;
