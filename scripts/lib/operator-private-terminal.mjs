// Existing raw key handling: public email inputs visible, private values masked with stars.
import {emitKeypressEvents} from 'node:readline';
export function privateTerminal(input=process.stdin,output=process.stdout){
 if(!input.isTTY||!output.isTTY||typeof input.setRawMode!=='function')throw Error('PRIVATE_INTERACTIVE_TERMINAL_REQUIRED');
 emitKeypressEvents(input);let alternate=false;
 const clear=()=>{if(alternate){output.write('\x1b[2J\x1b[H\x1b[?1049l');alternate=false;}};
 const prompt=(label,hidden=true)=>new Promise((resolve,reject)=>{
  let value='';output.write(label+' ');input.setRawMode(true);input.resume();
  function finish(cancel){input.off('keypress',key);input.setRawMode(false);input.pause();output.write('\n');if(cancel)reject(Error('OWNER_CANCELLED'));else resolve(value);value='';}
  function key(text,k={}){if(k.ctrl&&['c','d'].includes(k.name)||k.name==='escape')return finish(true);if(k.name==='return')return finish(false);if(k.name==='backspace'){if(value.length){value=Array.from(value).slice(0,-1).join('');output.write('\b \b');}return;}if(k.ctrl||k.meta||!text||/[\x00-\x1f\x7f]/.test(text)||value.length+text.length>4096)return;value+=text;output.write(hidden?'*'.repeat(Array.from(text).length):text);}
  input.on('keypress',key);
 });
 return {prompt,clear,notice:code=>{clear();output.write(code+'\n');},setup:async(slot,secret)=>{alternate=true;output.write('\x1b[?1049h\x1b[2J\x1b[H');try{output.write('PRIVATE AUTHENTICATOR SETUP — '+slot+'\n\nAdd a manual entry in your EXISTING authenticator.\nName: Mushavo STAGING '+slot+'\nType: Time based (TOTP), 6 digits, 30 seconds\n\nSETUP KEY: '+secret+'\n\nKeep this entry. Never send this screen/key to chat.\n');if(await prompt('After saving the entry, type ADDED:',false)!=='ADDED')throw Error('OWNER_CANCELLED');}finally{secret='';clear();}},close:()=>{clear();input.setRawMode(false);input.pause();}};
}
