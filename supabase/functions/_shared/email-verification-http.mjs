// Portable server utility. Error text never includes upstream bodies or credentials.
export class GateError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
export const requireGate = (condition, code = 'UNAVAILABLE', status = 503) => {
  if (!condition) throw new GateError(code, status);
};
export async function readBoundedJSON(source, maxBytes) {
  const size = source.headers.get('content-length');
  requireGate(!size || (/^\d+$/.test(size) && Number(size) <= maxBytes));
  requireGate(/^application\/json(?:\s*;|$)/i.test(source.headers.get('content-type') || ''));
  requireGate(source.body);
  const reader = source.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new GateError('UNAVAILABLE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(all)); }
  catch { throw new GateError('UNAVAILABLE'); }
}
export async function upstreamJSON(fetcher, url, init, maxBytes = 65536) {
  const controller = new AbortController(); let timer;
  const work = async () => {
    const response = await fetcher(url, {...init, redirect:'manual', signal:controller.signal});
    requireGate(!response.redirected && response.status >= 200 && response.status < 300,
      response.status === 401 || response.status === 403 ? 'SIGN_IN_REQUIRED' : 'UNAVAILABLE',
      response.status === 401 || response.status === 403 ? 401 : 503);
    return await readBoundedJSON(response, maxBytes);
  };
  try {
    return await Promise.race([work(), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new GateError('UNAVAILABLE')); }, 8000);
    })]);
  } catch (error) {
    if (error instanceof GateError) throw error;
    throw new GateError('UNAVAILABLE');
  } finally { clearTimeout(timer); }
}
