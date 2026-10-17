// Internal IPC entry point; output includes private values and MUST be captured by the PS wrapper.
import {prepareZohoSender} from './lib/fr-2-zoho-private-setup.mjs';
let answer;
try {
  if (process.argv.length !== 3 || process.argv[2] !== '--private-parent-pipe'
      || process.stdin.isTTY || process.stdout.isTTY) throw Error();
  const chunks = []; let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 32768) throw Error();
    chunks.push(chunk);
  }
  const text = new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks));
  answer = await prepareZohoSender(JSON.parse(text), globalThis.fetch);
} catch {
  answer = {receipt:{stage_step:'FR.2.4.E3.3_PRIVATE_ZOHO_SETUP',
    result:'PRIVATE_ZOHO_SETUP_REVIEW_REQUIRED', problem_code:'PRIVATE_INPUT_OR_PIPE_INVALID',
    requests_attempted:0, email_dispatched:false, hosted_acceptance:false, exit_code:1},
  private_configuration:null};
}
process.stdout.write(JSON.stringify(answer));
process.exitCode = answer.receipt.exit_code;
