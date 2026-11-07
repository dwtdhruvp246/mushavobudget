import {preparePrivatePacket, packetStage, packetProblems} from './lib/fr-2-email-private-packet.mjs';
const failure = code => ({receipt:{stage_step:packetStage,result:'LOCAL_PRIVATE_PACKET_REVIEW_REQUIRED',
  problem_code:packetProblems.includes(code)?code:'LOCAL_PRIVATE_INPUT_OR_PIPE_REVIEW_REQUIRED',actual_hosted_requests:0,email_dispatched:false,
  hosted_acceptance:false,exit_code:1},private_configuration:null});
let answer = failure();
try {
  if (process.argv.length !== 3 || process.argv[2] !== '--private-parent-pipe' || process.stdin.isTTY || process.stdout.isTTY) throw Error();
  let size = 0; const parts = [];
  for await (const part of process.stdin) {size += part.length; if (size > 65536) throw Error(); parts.push(part);}
  const input = JSON.parse(Buffer.concat(parts).toString('utf8'));
  if (input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).join(',') === 'preflight' && input.preflight === true) {
    answer = {receipt:{stage_step:packetStage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0},private_configuration:null};
  } else answer = preparePrivatePacket(input);
} catch (error) {answer = failure(error?.packetCode);}
process.stdout.write(JSON.stringify(answer)); process.exitCode = answer.receipt.exit_code;
