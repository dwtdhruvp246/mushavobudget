"""Explicit opt-in: public synthetic ClickHouse SELECTs; never a Supabase request."""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
SQL_PATH = 'supabase/diagnostics/security_fr_2_4_operator_external_auth_logs.sql'
PRIOR = '2b841b213cb2137fd2da6aab687820a1d5162b22'
PUBLIC_URL = 'https://play.clickhouse.com/?user=explorer'
PRIMARY = 'primary@fixture.invalid'
RECOVERY = 'recovery@fixture.invalid'
SENTINEL = 'PRIVATE_SYNTHETIC_SENTINEL_NO_REAL_SECRET'
STAGE = 'Stage 3/10 | FR.2/8 | Batch V/Z'


def literal(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def row(time='14:03:03.118678', slot=RECOVERY, action='factor_in_progress',
        agent='node', source='auth_audit_logs', legacy=False, missing=False,
        extra=None):
    prefix = 'auth_event.' if legacy else 'auth_audit_event.'
    attributes = {} if missing else {
        prefix+'actor_username': slot, prefix+'action': action,
        prefix+'user_agent': agent,
    }
    attributes.update({'auth_audit_event.actor_id': SENTINEL,
                       'auth_audit_event.traits.factor_id': SENTINEL,
                       'ip_address': SENTINEL, 'raw_message': SENTINEL})
    attributes.update(extra or {})
    pairs = ','.join(literal(x) for pair in attributes.items() for x in pair)
    return ('tuple(toDateTime64('+literal('2026-10-25 '+time)+",6,'UTC'),"
            +literal(source)+',map('+pairs+'))')


def fixture_sql(rows):
    return ('(SELECT tupleElement(fixture_log_row,1) AS timestamp, '
            'tupleElement(fixture_log_row,2) AS source, '
            'tupleElement(fixture_log_row,3) AS log_attributes FROM '
            '(SELECT arrayJoin(['+','.join(rows)+']) AS fixture_log_row))')


def prepare(sql, rows):
    assert sql.count('FROM logs') == 1
    sql = sql.replace('PRIMARY_OPERATOR_EMAIL', PRIMARY)
    sql = sql.replace('RECOVERY_OPERATOR_EMAIL', RECOVERY)
    return sql.replace('FROM logs', 'FROM '+fixture_sql(rows)).strip().removesuffix(';')


def execute(query):
    request = urllib.request.Request(PUBLIC_URL,
        data=(query+' FORMAT JSON').encode('utf-8'), method='POST')
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            assert response.status == 200
            raw = response.read(2*1024*1024+1)
            assert len(raw) <= 2*1024*1024
            return json.loads(raw)
    except urllib.error.HTTPError as error:
        error.read(2048)  # Synthetic response is not printed or copied to the receipt.
        raise AssertionError('PUBLIC_ENGINE_HTTP_'+str(error.code)) from None


def validate_report(query, expected, wrap):
    if wrap:
        query = 'SELECT safe_json FROM (\n'+query+'\n) LIMIT 1'
    response = execute(query)
    assert response['rows'] == 1
    raw = response['data'][0]['safe_json']
    assert not any(private in raw for private in [PRIMARY, RECOVERY, SENTINEL,
                                                 'foreign@fixture.invalid'])
    report = json.loads(raw)
    assert report['progress_display'] == STAGE
    assert report['exit_code'] == 0
    assert report['human_or_client_origin_proven'] is False
    assert report['exact_pending_factor_reference_verified'] is False
    assert report['hosted_acceptance'] is False
    assert report['factor_changes_requested'] is False
    assert report['committed_mode_change_requests'] == 0
    assert report['quarantine_rechecked_by_this_log_query'] is False
    assert report['selected_username_matching_rows'] == expected['count']
    assert report['selected_auth_audit_rows'] == expected['audit']
    assert report['selected_auth_service_rows'] == expected['service']
    assert len(report['events']) == min(expected['count'],50)
    assert report['details_truncated'] is (expected['count'] > 50)
    assert report['event_columns'] == ['UTC','source','slot','action','client_class']
    assert report['events'] == sorted(report['events'], reverse=True)
    assert all(len(event)==5 and event[2] in ['PRIMARY','RECOVERY'] for event in report['events'])
    if 'actions' in expected:
        assert {event[3] for event in report['events']} == expected['actions']
    if 'clients' in expected:
        assert {event[4] for event in report['events']} == expected['clients']
    if 'slots' in expected:
        assert {event[2] for event in report['events']} == expected['slots']
    if 'latest' in expected:
        assert report['events'][0][0].endswith(expected['latest'])


def main():
    if sys.argv[1:] != ['--public-synthetic-clickhouse']:
        print('Explicit --public-synthetic-clickhouse required; no request sent.')
        return 1
    sql = (ROOT/SQL_PATH).read_text()
    # Keep the correction flat for the hosted pre-parser: no CTEs or nested SELECTs.
    without_comments = '\n'.join(line for line in sql.splitlines()
                                 if not line.lstrip().startswith('--'))
    assert len(re.findall(r'\bSELECT\b', without_comments, re.I)) == 1
    assert not re.search(r'\bWITH\b', without_comments, re.I)
    assert not re.search(r'\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|SETTINGS)\b', without_comments, re.I)
    assert 'log_attributes[\'auth_audit_event.actor_id\']' not in sql
    assert 'event_message' not in sql
    prior = subprocess.check_output(['git','show',PRIOR+':'+SQL_PATH],cwd=ROOT).decode()
    cases = [
        ('selected_privacy_and_source_filter', [row(),
          row(time='13:50:00',slot=PRIMARY,action='login',agent='Mozilla/5.0'),
          row(time='14:04:00',action='logout',agent=''),
          row(slot='foreign@fixture.invalid'), row(source='function_logs')],
          {'count':3,'audit':3,'service':0,'actions':{'factor_in_progress','login','logout'}}),
        ('empty_one_safe_row', [row(time='12:00:00')],
          {'count':0,'audit':0,'service':0,'actions':set()}),
        ('legacy_fields_case_insensitive_slot', [row(slot=PRIMARY.upper(),legacy=True,source='auth_logs')],
          {'count':1,'audit':0,'service':1,'slots':{'PRIMARY'},'clients':{'UNRECORDED'}}),
        ('missing_actor_metadata_is_not_origin_clearance', [row(missing=True)],
          {'count':0,'audit':0,'service':0}),
        ('latest50_and_truncation', [row(time='13:40:'+str(i).zfill(2)) for i in range(55)],
          {'count':55,'audit':55,'service':0,'latest':'13:40:54.000000'}),
        ('fixed_clients_unknown_actions_and_redaction', [
          row(time='13:50:01',agent=''), row(time='13:50:02',agent='NODE'),
          row(time='13:50:03',agent='undici'),
          row(time='13:50:04',agent='Mozilla/5.0 '+SENTINEL),
          row(time='13:50:05',agent='PowerShell '+SENTINEL),
          row(time='13:50:06',agent=SENTINEL,action=SENTINEL)],
          {'count':6,'audit':6,'service':0,'actions':{'factor_in_progress','OTHER_OR_UNRECORDED'},
           'clients':{'UNRECORDED','NODE_OR_UNDICI','BROWSER_LIKE','POWERSHELL','OTHER_RECORDED_CLIENT'}}),
        ('inclusive_start_exclusive_end', [row(time='13:34:59.999999'),
          row(time='13:35:00.000000'),row(time='14:09:59.999999'),row(time='14:10:00.000000')],
          {'count':2,'audit':2,'service':0}),
        ('audit_prefix_priority_and_legacy_action_fallback', [
          row(slot=PRIMARY,action='',extra={'auth_event.action':'login',
            'auth_event.actor_username':'foreign@fixture.invalid'})],
          {'count':1,'audit':1,'service':0,'slots':{'PRIMARY'},'actions':{'login'}}),
    ]
    tasks = [(name+('_wrapped' if wrap else '_direct'), prepare(sql,rows), expected,wrap)
             for name,rows,expected in cases for wrap in [False,True]]
    failures = []
    completed = []
    engine = execute('SELECT version() AS engine_version LIMIT 1')['data'][0]['engine_version']
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        pending = {executor.submit(validate_report,query,expected,wrap):name
                   for name,query,expected,wrap in tasks}
        for future in concurrent.futures.as_completed(pending):
            name=pending[future]
            try:
                future.result()
                completed.append(name)
            except Exception:
                failures.append(name)
    # The earlier SQL is valid in this public native engine, even parenthesized.
    # Therefore the screenshot does NOT establish a general ClickHouse CTE defect.
    prior_native = []
    for wrap in [False,True]:
        query = prepare(prior,[row()])
        if wrap: query='('+query+')'
        response=execute(query)
        report=json.loads(response['data'][0]['safe_json'])
        prior_native.append(response['rows']==1 and report['selected_username_matching_rows']==1)
    receipt = {
      'stage_step':'FR.2.4.E5.35_BATCH_V_ADMIN_MFA_OPERATOR_FACTOR_AND_CATALOG_REVIEW',
      'progress_display':STAGE,
      'result':('PUBLIC_SYNTHETIC_CLICKHOUSE16_PASS_SUPABASE_QUERY_PENDING'
                if not failures and all(prior_native) else 'PUBLIC_SYNTHETIC_QUERY_REVIEW_REQUIRED'),
      'source_parent_commit':PRIOR,'python_version':sys.version.split()[0],
      'public_engine_version':engine,'public_engine':'ClickHouse official read-only playground',
      'public_fixture_only_requests':19,'maximum_public_fixture_requests':19,
      'corrected_query_tests':16,'pass':len(completed),'fail':len(failures),
      'failed_cases':sorted(failures),'completed_cases':sorted(completed),
      'prior_query_native_and_parenthesized_both_accepted':all(prior_native),
      'exact_hosted_parser_or_formatter_root_cause_reproduced':False,
      'corrected_query_flat_single_SELECT':True,
      'corrected_source_SHA256':hashlib.sha256((ROOT/SQL_PATH).read_bytes()).hexdigest(),
      'fixture_substitutions':'Only two .invalid synthetic addresses and literal-row FROM source; no real user log data',
      'staging_hosted_requests':0,'real_credentials_packets_or_Auth_accessed':False,
      'actual_Supabase_Log_query_acceptance':False,'quarantine_rechecked':False,
      'factor_or_mode_or_setting_changes':False,'full_lettered_batch_V_complete':False,
      'hosted_acceptance':False,'production_or_native_changed':False,'APK_update_deferred':True,
      'findings_closed':[],'checked_UTC':datetime.now(timezone.utc).isoformat(),
      'exit_code':0 if not failures and all(prior_native) else 1,
    }
    print(json.dumps(receipt,indent=2))
    return receipt['exit_code']

if __name__ == '__main__':
    sys.exit(main())
