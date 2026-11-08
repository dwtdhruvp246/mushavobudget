// Supabase's S3 endpoint avoids the CDN populated by ordinary Storage downloads.
// Credential-bearing requests stay server-side and may never follow redirects.
export async function readS3PrivateObject({ bucket, path, maxBytes, sign, fetcher = fetch }) {
  let reader;
  try {
    const url = 'https://dczlddwbtgvfdujgcitb.storage.supabase.co/storage/v1/s3/'
      + encodeURIComponent(bucket) + '/' + path.split('/').map(encodeURIComponent).join('/');
    const request = await sign(new Request(url, { method: 'GET', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-store' } }));
    if (request.url !== url || request.method !== 'GET' || request.redirect !== 'error') throw new Error('scope');
    const response = await fetcher(request);
    if (response.status !== 200 || !response.body || Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel(); throw new Error('unavailable');
    }
    reader = response.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('limit'); }
      chunks.push(value);
    }
    if (!size) throw new Error('empty');
    return { data: new Blob(chunks) };
  } catch { return { error: { code: 'PRIVATE_FILE_FETCH_FAILED' } }; }
  finally { reader?.releaseLock(); }
}
