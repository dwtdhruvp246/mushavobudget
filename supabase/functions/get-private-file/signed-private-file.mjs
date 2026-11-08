// The temporary retrieval capability is used only on the server. It is never
// returned, logged, or accepted as caller authority. User access is checked by
// the broker immediately before and after this fetch.
export async function readSignedPrivateObject({ bucket, path, maxBytes, mint, fetcher = fetch }) {
  let reader;
  try {
    const result = await mint(bucket, path, 15);
    if (result.error || typeof result.data?.signedUrl !== 'string') throw new Error('unavailable');
    const url = new URL(result.data.signedUrl);
    const expected = '/storage/v1/object/sign/' + encodeURIComponent(bucket) + '/' + path.split('/').map(encodeURIComponent).join('/');
    if (url.origin !== 'https://dczlddwbtgvfdujgcitb.supabase.co' || url.pathname !== expected
      || [...url.searchParams.keys()].join() !== 'token' || !url.searchParams.get('token') || url.hash) throw new Error('scope');
    const response = await fetcher(url, { method:'GET', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(15000) });
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
    return { data:new Blob(chunks) };
  } catch { return { error:{ code:'PRIVATE_FILE_FETCH_FAILED' } }; }
  finally { reader?.releaseLock(); }
}
