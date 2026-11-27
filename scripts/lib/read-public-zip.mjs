import {createPublicZIP} from './store-public-zip.mjs';
// Accept only canonical uncompressed archives produced by the pinned public writer.
export function readPublicZIP(bytes,expectedCount){
 if(!Number.isSafeInteger(expectedCount)||expectedCount<1||expectedCount>128||!Buffer.isBuffer(bytes)||bytes.length<22||bytes.length>8388608)throw Error('ZIP_FORMAT_REQUIRED');
 const end=bytes.length-22;if(bytes.readUInt32LE(end)!==0x06054b50||bytes.readUInt16LE(end+10)!==expectedCount)throw Error('ZIP_COUNT_REQUIRED');
 const entries=[];let offset=0;
 for(let i=0;i<expectedCount;i++){
  if(offset+30>end||bytes.readUInt32LE(offset)!==0x04034b50||bytes.readUInt16LE(offset+6)!==0||bytes.readUInt16LE(offset+8)!==0)throw Error('ZIP_FORMAT_REQUIRED');
  const size=bytes.readUInt32LE(offset+18),original=bytes.readUInt32LE(offset+22),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
  if(size!==original||size<1||size>2097152||extra!==0||length<1||length>256||offset+30+length+size>end)throw Error('ZIP_FORMAT_REQUIRED');
  const name=bytes.subarray(offset+30,offset+30+length);if(name.some(x=>x>127))throw Error('ZIP_FORMAT_REQUIRED');
  entries.push([name.toString('ascii'),bytes.subarray(offset+30+length,offset+30+length+size)]);offset+=30+length+size;
 }
 if(!createPublicZIP(entries).equals(bytes))throw Error('ZIP_CANONICAL_IDENTITY_REQUIRED');
 return new Map(entries);
}

