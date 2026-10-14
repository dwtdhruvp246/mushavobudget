# FR.2.3: previous batch is paused after an incomplete role-archive run.
# Run the read-only security_fr_2_3_business_archive_state_review.sql from the current handoff.
$ErrorActionPreference = 'Stop'
throw 'Business API rerun paused. Return the archive-state review first; retain existing fixtures.'
