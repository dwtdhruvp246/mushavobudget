// Supabase's S3 endpoint avoids the CDN populated by ordinary Storage downloads.
// Credential-bearing requests stay server-side and may never follow redirects.
export async function readS3PrivateObject({ bucket, path, maxBytes, sign, fetcher = fetch, onFailure = (_failure) => {} }) {
  let reader, stage = 'sign';
  try {
    const url = 'https://dczlddwbtgvfdujgcitb.supabase.co/storage/v1/s3/'
      + encodeURIComponent(bucket) + '/' + path.split('/').map(encodeURIComponent).join('/');
    const request = await sign(new Request(url, { method: 'GET', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(15000) }));
    stage = 'scope';
    if (request.url !== url || request.method !== 'GET' || request.redirect !== 'error') throw new Error('scope');
    if (!request.headers.get('authorization')?.startsWith('AWS4-HMAC-SHA256 ')
      || !request.headers.get('x-amz-security-token')) throw new Error('signed_headers');
    stage = 'fetch';
    const response = await fetcher(url, { method:'GET', headers:new Headers(request.headers),
      redirect:'error', cache:'no-store', signal:request.signal });
    if (response.status !== 200) {
      const prefix = (await response.text()).slice(0, 8192);
      const code = prefix.match(/<Code>([A-Za-z][A-Za-z0-9_]{0,63})<\/Code>/)?.[1] || 'UNKNOWN';
      onFailure({ stage:'HTTP', status:response.status, provider_code:code });
      return { error: { code:'PRIVATE_FILE_FETCH_FAILED' } };
    }
    stage = 'size';
    if (!response.body || Number(response.headers.get('content-length')) > maxBytes) {
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
  } catch { onFailure({ stage }); return { error: { code: 'PRIVATE_FILE_FETCH_FAILED' } }; }
  finally { reader?.releaseLock(); }
}
