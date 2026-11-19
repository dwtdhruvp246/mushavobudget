import {emitKeypressEvents} from 'node:readline';
import {runOperatorMfa, PROJECT, validateEmails, SetupError} from './lib/fr-2-operator-mfa.mjs';

const input=process.stdin, output=process.stdout;
let alternate=false;
const closePrivate=()=>{ if(alternate) { output.write('\x1b[2J\x1b[H\x1b[?1049l'); alternate=false; } };
function prompt(label,hidden=false) {
  return new Promise((resolve,reject)=>{
    let value=''; output.write(label+' ');
    input.setRawMode(true); input.resume();
    function finish(error) {
      input.off('keypress',key);input.setRawMode(false);input.pause();output.write('\n');
      if(error)reject(new SetupError('OWNER_CANCELLED'));else resolve(value);
      value='';
    }
    function key(text,k={}) {
      if((k.ctrl&&['c','d'].includes(k.name))||k.name==='escape')return finish(true);
      if(k.name==='return')return finish(false);
      if(k.name==='backspace') {if(value.length){value=value.slice(0,-1);if(!hidden)output.write('\b \b');}return;}
      if(k.ctrl||k.meta||!text||/[\x00-\x1f\x7f]/.test(text))return;
      if(value.length+text.length>1024)return;
      value+=text;if(!hidden)output.write(text);
    }
    input.on('keypress',key);
  });
}
try {
  if(process.argv.length!==3||process.argv[2]!==`--confirm-staging=${PROJECT}`)
    throw new SetupError('EXACT_STAGING_ARGUMENT_REQUIRED');
  if(!input.isTTY||!output.isTTY||typeof input.setRawMode!=='function')
    throw new SetupError('PRIVATE_INTERACTIVE_TERMINAL_REQUIRED');
  emitKeypressEvents(input);
  output.write('STAGING ONLY. Two isolated ordinary accounts; TOTP enrollment and fresh MFA sign-ins. No Admin role assignment.\n');
  output.write('Use your authenticator app and keep both entries. Do not use Start-Transcript, screen sharing or terminal logging.\n');
  output.write('No password, code, setup key or token belongs in chat. Only return the final JSON summary.\n');
  const emails=validateEmails([await prompt('PRIMARY staging email:'),await prompt('RECOVERY staging email:')]);
  if(await prompt('Type SETUP to enroll/reuse TOTP for these two staging accounts:')!=='SETUP')throw new SetupError('OWNER_CANCELLED');
  const receipt=await runOperatorMfa({emails,io:{
    password:slot=>{closePrivate();return prompt(slot+' staging app password (hidden):',true);},
    code:(slot,{fresh,retry})=>prompt(slot+(fresh?' NEW current authenticator code': ' current authenticator code')+(retry?' (retry)':'')+' (hidden):',true),
    notice:code=>{closePrivate();output.write(code+'\n');},
    setup:async(slot,secret)=>{
      alternate=true;output.write('\x1b[?1049h\x1b[2J\x1b[H');
      output.write('PRIVATE AUTHENTICATOR SETUP - '+slot+'\n\n');
      output.write('In your authenticator app choose manual setup / enter a setup key.\n');
      output.write('Name: Mushavo STAGING '+slot+'\nType: Time based (TOTP), 6 digits, 30 seconds\n\n');
      output.write('SETUP KEY: '+secret+'\n\n');
      output.write('Keep this entry in your authenticator. Never send this screen or key to chat.\n');
      if(await prompt('After adding it, type ADDED:')!=='ADDED')throw new SetupError('OWNER_CANCELLED');
      closePrivate();
    }
  }});
  closePrivate();output.write('\nBEGIN SAFE MFA RESULT\n'+JSON.stringify(receipt,null,2)+'\nEND SAFE MFA RESULT\n');
  process.exitCode=receipt.result==='STAGING_TWO_OPERATOR_TOTP_AND_FRESH_AUTH_SESSIONS_SCOPED_PASS'?0:1;
} catch(e) {
  closePrivate();output.write(JSON.stringify({stage_step:'FR.2.4_OPERATOR_MFA_SETUP',result:'NOT_STARTED',problem_code:e instanceof SetupError?e.code:'LOCAL_TERMINAL_ERROR',hosted_acceptance:false})+'\n');process.exitCode=1;
} finally {closePrivate();if(input.isTTY)input.setRawMode(false);input.pause();}
