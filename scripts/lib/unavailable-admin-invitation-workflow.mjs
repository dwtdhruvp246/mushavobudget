import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
export const stepFiles = { expired: '01-expired.sql', cancelled: '02-cancelled.sql', replaced: '03-replaced-state.sql', cleanup: '04-cleanup.sql' };
export const stepResults = { expired: 'EXPIRED_FIXTURE_READY', cancelled: 'CANCELLED_FIXTURE_READY', replaced: 'REPLACED_STATE_FIXTURE_READY', cleanup: 'TEMPORARY_INVITATION_FIXTURE_ABSENT' };

export function stagedSQLFiles(output) {
  const directory = path.resolve(output); let prepared;
  return {
    prepare(pack) {
      if (prepared || Object.keys(pack).sort().join('|') !== Object.keys(stepFiles).sort().join('|')
        || !Object.values(pack).every(sql => typeof sql === 'string' && sql.length > 0)) throw Error('COMPLETE_SQL_PACK_REQUIRED');
      fs.mkdirSync(directory, { recursive: false });
      // Emergency cleanup exists before any fixture action; later phases are created only when requested.
      fs.writeFileSync(path.join(directory, stepFiles.cleanup), pack.cleanup, { encoding: 'utf8', flag: 'wx' });
      if (fs.readFileSync(path.join(directory, stepFiles.cleanup), 'utf8') !== pack.cleanup) throw Error('SQL_FILE_READBACK_REQUIRED');
      prepared = pack;
    },
    materialize(phase, sql) {
      if (!prepared || !Object.hasOwn(stepFiles, phase) || sql !== prepared[phase]) throw Error('REQUESTED_SQL_STEP_REQUIRED');
      const filename = path.join(directory, stepFiles[phase]);
      if (!fs.existsSync(filename)) fs.writeFileSync(filename, sql, { encoding: 'utf8', flag: 'wx' });
      if (fs.readFileSync(filename, 'utf8') !== sql) throw Error('SQL_FILE_READBACK_REQUIRED');
      return filename;
    }
  };
}

// SQL travels only through stdin into a string variable, never as PowerShell command text.
const clipboardCommand = [
  "$ErrorActionPreference = 'Stop';",
  '[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false);',
  '$SqlText = [Console]::In.ReadToEnd();',
  'Set-Clipboard -Value $SqlText;',
  '$Back = Get-Clipboard -Raw;',
  "if ($null -eq $Back -or $Back.Replace([string][char]13, '').TrimEnd([char]10) -cne $SqlText.Replace([string][char]13, '').TrimEnd([char]10)) { exit 2 };",
  "[Console]::Out.Write('COPIED');"
].join(' ');
export async function copySQLToClipboard(sql, options = {}) {
  if ((options.platform || process.platform) !== 'win32') return false;
  return new Promise(resolve => {
    let child, done = false, timer, output = '';
    const finish = value => { if (done) return; done = true; clearTimeout(timer); resolve(value); };
    try {
      child = (options.spawn || spawn)('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', clipboardCommand], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      timer = setTimeout(() => { child.kill(); finish(false); }, 5000);
      child.once('error', () => finish(false));
      child.stdout.on('data', bytes => { output = (output + bytes.toString('utf8')).slice(0, 32); });
      child.once('close', code => finish(code === 0 && output === 'COPIED'));
      child.stdin.on('error', () => finish(false));
      child.stdin.end(sql, 'utf8');
    } catch { finish(false); }
  });
}
