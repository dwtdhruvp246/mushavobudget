// Portable ZIP/STORE writer: literal POSIX paths, no extraction or transport.
import fs from 'node:fs';
const table = Uint32Array.from({length:256},(_,n)=>{
  let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
function crc32(bytes) {
  let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;
}
export function createPublicZIP(entries) {
  if(!Array.isArray(entries)||!entries.length||entries.length>128)throw Error('ZIP_ENTRY_COUNT');
  const seen=new Set(),locals=[],central=[];let offset=0;
  for(const [name,data]of entries) {
    if(typeof name!=='string'||! /^(?:_headers|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|assets\/[A-Za-z0-9_.-]+)$/.test(name)||
      name.includes('..')||seen.has(name)||!Buffer.isBuffer(data)||!data.length||data.length>2*1024*1024)throw Error('ZIP_ENTRY_SHAPE');
    seen.add(name);const filename=Buffer.from(name,'ascii'),crc=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);
    local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);
    local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
    const row=Buffer.alloc(46);row.writeUInt32LE(0x02014b50);row.writeUInt16LE(0x0314,4);row.writeUInt16LE(20,6);
    row.writeUInt16LE(33,14);row.writeUInt32LE(crc,16);row.writeUInt32LE(data.length,20);row.writeUInt32LE(data.length,24);
    row.writeUInt16LE(filename.length,28);row.writeUInt32LE((0o100644*65536)>>>0,38);row.writeUInt32LE(offset,42);
    locals.push(local,filename,data);central.push(row,filename);offset+=local.length+filename.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
export function writePublicZIP(filename,entries) {
  const bytes=createPublicZIP(entries);fs.writeFileSync(filename,bytes,{flag:'wx'});return bytes;
}
