// Minimal Phoenix text-frame fixture, not a real Supabase Realtime authorization service.
import {createHash} from 'node:crypto';
export function acceptFixtureSocket(req,socket,{origin,onMessage,onClose}){
 if(req.headers.origin!==origin||req.headers['sec-websocket-version']!=='13'||!/^[A-Za-z0-9+/]{22}==$/.test(req.headers['sec-websocket-key']||'')){socket.destroy();return;}
 const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');let buffer=Buffer.alloc(0),messages=0,sequence=Promise.resolve();
 const send=value=>{const b=Buffer.from(JSON.stringify(value));if(b.length>65535)throw Error('SOCKET_BOUND_REQUIRED');const h=b.length<126?Buffer.from([0x81,b.length]):Buffer.from([0x81,126,b.length>>8,b.length&255]);socket.write(Buffer.concat([h,b]));};
 socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);if(buffer.length>65536){socket.destroy();return;}
  while(buffer.length>=2){
   const first=buffer[0],masked=!!(buffer[1]&128),opcode=first&15;let n=buffer[1]&127,at=2;
   if(!(first&128)||!masked||n===127){socket.destroy();return;}if(n===126){if(buffer.length<4)return;n=buffer.readUInt16BE(2);at=4;}
   if(n>32768){socket.destroy();return;}if(buffer.length<at+4+n)return;
   const mask=buffer.subarray(at,at+4),bytes=Buffer.from(buffer.subarray(at+4,at+4+n));buffer=buffer.subarray(at+4+n);for(let i=0;i<bytes.length;i++)bytes[i]^=mask[i%4];
   if(opcode===8){socket.end(Buffer.from([0x88,0]));return;}if(opcode===9){socket.write(Buffer.concat([Buffer.from([0x8a,bytes.length]),bytes]));continue;}
   if(opcode!==1||++messages>128){socket.destroy();return;}
   let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{socket.destroy();return;}
   sequence=sequence.then(()=>onMessage(value,send)).catch(()=>socket.destroy());
  }
 });socket.on('error',()=>{});socket.on('close',onClose);
}
