# Outbox claim binding correction

The frozen Batch Y backend transaction reproduced a stale-result defect in the installed reminder queue. Attempt 1 expired, attempt 2 reclaimed the row, and the original worker's completion changed attempt 2 to sent. Twenty direct database-role denial calls passed. The full transaction rolled back; independent readback found zero fixture/outbox rows and a matching active catalog. No provider request or notification delivery occurred.

Both reminder and Admin queue result RPCs now accept the expected attempt number and claimed timestamp. They update only the same processing claim, within its 15-minute lease. Terminal replays and stale/mismatched claims return no row. The legacy five-argument signatures reject unbound calls with OUTBOX_CLAIM_REQUIRED. Their anonymous/authenticated denial and service-only access remain explicit.

Both dispatcher sources pass the full claim to a shared helper. Completion requires an acknowledged row; cancellation filters the exact attempt, claimed timestamp, processing status and lease deadline. A stale worker cannot report successful state mutation. These guards protect queue state. They do not establish exactly-once external push delivery.

Validation: 42 real PostgreSQL assertions across both queues, 10 shared-helper tests and eight affected dispatcher checks passed. The TypeScript modules parsed after type stripping. Hosted installation and recheck are recorded separately. The paired staging install refuses an unreviewed catalog and refreshes its stamp atomically. Production and actual scheduler/provider delivery remain outside this installation.
