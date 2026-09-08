-- Stage 9 rollback. Run only when intentionally removing test-push delivery.
-- This does not remove push subscriptions or browser permission.

drop function if exists public.claim_push_test_rate_limit(uuid, integer);
drop table if exists public.push_test_rate_limits;
