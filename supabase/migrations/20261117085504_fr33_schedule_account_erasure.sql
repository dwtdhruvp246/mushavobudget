CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE mushavo_account_deletion.processor_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  confirmed_since timestamptz,
  fixture_request_id uuid REFERENCES mushavo_account_deletion.requests(id) ON DELETE RESTRICT,
  CHECK (fixture_request_id IS NULL OR confirmed_since IS NOT NULL)
);
INSERT INTO mushavo_account_deletion.processor_control DEFAULT VALUES;
ALTER TABLE mushavo_account_deletion.processor_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.processor_control FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE mushavo_account_deletion.processor_attempts (
  request_id uuid PRIMARY KEY REFERENCES mushavo_account_deletion.requests(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL,
  attempted_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  retry_at timestamptz,
  review_code text CHECK (review_code ~ '^FR33_[A-Z_]+$'),
  CHECK (retry_at IS NULL OR (review_code IS NULL AND retry_at > attempted_at))
);
ALTER TABLE mushavo_account_deletion.processor_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mushavo_account_deletion.processor_attempts FROM PUBLIC, anon, authenticated, service_role;

CREATE INDEX fr33_confirmed_deletion_queue_idx
  ON mushavo_account_deletion.requests(workspace_impact_confirmed_at,id)
  WHERE subject_id IS NOT NULL AND cancelled_at IS NULL AND completed_at IS NULL
    AND erasure_committed_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;

CREATE FUNCTION mushavo_account_deletion.process_confirmed_requests()
RETURNS jsonb LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
SET lock_timeout TO '2s'
AS $$
DECLARE
  control mushavo_account_deletion.processor_control%ROWTYPE;
  candidate record;
  outcome text;
  attempt_time timestamptz;
  retry_at timestamptz;
  review_code text;
  finished integer := 0;
  files_pending integer := 0;
  deferred integer := 0;
  review integer := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('fr33-confirmed-deletion-processor',0)) THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  SELECT * INTO STRICT control FROM mushavo_account_deletion.processor_control WHERE singleton FOR SHARE;
  IF control.confirmed_since IS NULL THEN
    RETURN jsonb_build_object('status','disabled');
  END IF;

  FOR candidate IN
    SELECT request.id, request.workspace_impact_confirmed_at AS confirmed_at,
      COALESCE(attempt.attempt_count,0)+1 AS attempt_count
    FROM mushavo_account_deletion.requests request
    LEFT JOIN mushavo_account_deletion.processor_attempts attempt
      ON attempt.request_id = request.id AND attempt.confirmed_at = request.workspace_impact_confirmed_at
    WHERE request.subject_id IS NOT NULL AND request.cancelled_at IS NULL AND request.completed_at IS NULL
      AND request.erasure_committed_at IS NULL AND request.workspace_impact_confirmed_at >= control.confirmed_since
      AND (control.fixture_request_id IS NULL OR request.id = control.fixture_request_id)
      AND (attempt.request_id IS NULL OR attempt.retry_at <= statement_timestamp())
    ORDER BY request.workspace_impact_confirmed_at,request.id
    LIMIT 3
  LOOP
    attempt_time := clock_timestamp();
    retry_at := NULL;
    review_code := NULL;
    BEGIN
      outcome := mushavo_account_deletion.execute_confirmed_request(candidate.id)->>'status';
      CASE outcome
        WHEN 'completed' THEN finished := finished+1;
        WHEN 'files_pending' THEN files_pending := files_pending+1;
        ELSE RAISE EXCEPTION 'FR33_UNEXPECTED_PROCESSOR_RESULT';
      END CASE;
    EXCEPTION
      WHEN lock_not_available OR serialization_failure OR deadlock_detected THEN
        IF candidate.attempt_count < 3 THEN
          retry_at := attempt_time+make_interval(mins => candidate.attempt_count);
          deferred := deferred+1;
        ELSE
          review_code := 'FR33_RETRY_LIMIT_REACHED';
        END IF;
      WHEN OTHERS THEN
        review_code := CASE WHEN SQLERRM ~ '^FR33_[A-Z_]{3,80}$' THEN SQLERRM ELSE 'FR33_PROCESSOR_REVIEW_REQUIRED' END;
    END;
    IF review_code IS NOT NULL THEN review := review+1; END IF;
    INSERT INTO mushavo_account_deletion.processor_attempts
      (request_id,confirmed_at,attempted_at,attempt_count,retry_at,review_code)
    VALUES (candidate.id,candidate.confirmed_at,attempt_time,candidate.attempt_count,retry_at,review_code)
    ON CONFLICT (request_id) DO UPDATE
    SET confirmed_at = excluded.confirmed_at, attempted_at = excluded.attempted_at,
        attempt_count = excluded.attempt_count, retry_at = excluded.retry_at, review_code = excluded.review_code;
  END LOOP;

  RETURN jsonb_build_object('status','processed','completed',finished,'files_pending',files_pending,
    'deferred',deferred,'review',review);
END;
$$;
REVOKE ALL ON FUNCTION mushavo_account_deletion.process_confirmed_requests()
  FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT cron.schedule(
    'mushavo-fr33-account-erasure', '* * * * *',
    'SELECT mushavo_account_deletion.process_confirmed_requests()'
  ) INTO job_id;
  PERFORM cron.alter_job(job_id,active := false);
END;
$$;
