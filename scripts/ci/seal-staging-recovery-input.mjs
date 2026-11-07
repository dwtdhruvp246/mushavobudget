// Operator-side helper. Only the encrypted envelope is printed. Secret input is
// accepted through a non-echoing terminal, never arguments, source, or files.
import { sealBridge } from './staging-recovery-bridge.mjs';
import { need } from './staging-access.mjs';
const [key, run, commit, phase] = process.argv.slice(2);
need(process.stdin.isTTY, 'PRIVATE_TERMINAL_REQUIRED');
process.stdin.setRawMode(true); process.stdin.resume();
process.stdout.write('PRIVATE_RECOVERY_INPUT_READY\n');
let value = '';
process.stdin.on('data', chunk => {
  for (const char of chunk.toString()) {
    if (char === '\u0003') process.exit(1);
    if (char === '\r' || char === '\n') {
      try { const sealed = sealBridge(key, { run, commit, phase }, JSON.parse(value)); value = '';
        process.stdout.write(JSON.stringify(sealed) + '\n'); process.stdin.setRawMode(false); process.exit(0); }
      catch { value = ''; process.stdout.write('PRIVATE_RECOVERY_INPUT_REFUSED\n'); process.exit(1); }
    } else if (char === '\u007f') value = value.slice(0, -1);
    else if (value.length < 6000) value += char;
    else process.exit(1);
  }
});
