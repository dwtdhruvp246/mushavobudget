import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPublicMetadata, loadReviewedSources, parseCollectionArguments, validateContract } from './lib/stage-10-public-metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const contract = validateContract(JSON.parse(await readFile(resolve(root,
    'docs/security-audit/security-stage-10-operations-candidate-contract.json'), 'utf8')));
  parseCollectionArguments(process.argv.slice(2), contract.source_parent_commit);
  const reviewedSources = await loadReviewedSources(root, contract);
  const receipt = await collectPublicMetadata({ reviewedSources, sourcePin: contract.source_parent_commit });
  console.log(JSON.stringify(receipt, null, 2));
  process.exitCode = receipt.result === 'PUBLIC_STATIC_METADATA_PREREQUISITES_SCOPED_MATCH' ? 0 : 1;
} catch (error) {
  const codes = ['EXACT_PUBLIC_STAGING_ARGUMENTS_REQUIRED', 'REVIEWED_SOURCE_CONTRACT_REQUIRED',
    'FIXED_STAGING_TARGETS_REQUIRED', 'ORDINARY_SOURCE_ROOT_REQUIRED', 'ORDINARY_REVIEWED_SOURCE_REQUIRED',
    'REVIEWED_SOURCE_ENCODING_REQUIRED', 'REVIEWED_SOURCE_HASH_MISMATCH'];
  console.log(JSON.stringify({ stage_step: '10.2', result: 'COLLECTION_NOT_STARTED',
    error_code: codes.includes(error?.code) ? error.code : 'REVIEWED_LOCAL_INPUTS_REQUIRED',
    public_requests_started: 0, hosted_acceptance: false, findings_closed: [] }, null, 2));
  process.exitCode = 2;
}
