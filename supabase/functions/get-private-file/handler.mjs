// No signed URLs or provider bytes reach a caller before two current RLS checks.
const LIMITS = Object.freeze({
  'payment-proofs': 10485760, 'subscription-proofs': 10485760,
  'business-documents': 10485760, 'business-logos': 2097152,
});
const MEDIA = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf',
  'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const BODY_LIMIT = 1024;
const PATH = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp|pdf|csv|xlsx)$/;

export function validPrivateFileSelector(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 2 && Object.hasOwn(LIMITS, value.bucket)
    && typeof value.path === 'string' && value.path.length <= 512 && PATH.test(value.path);
}

function sameObject(a, b) {
  return b && ['object_id', 'bucket_id', 'object_name', 'object_version', 'size_bytes', 'mime_type']
    .every(key => a[key] === b[key]);
}

async function selectorBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('selector');
  if (Number(request.headers.get('content-length')) > BODY_LIMIT) throw new Error('selector');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('selector');
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) { await reader.cancel(); throw new Error('selector'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!validPrivateFileSelector(value)) throw new Error('selector');
  return value;
}

function safeContext(value, selector) {
  const row = Array.isArray(value) && value.length === 1 ? value[0] : null;
  return row && typeof row.object_id === 'string' && row.object_id.length > 0
    && typeof row.object_version === 'string' && row.object_version.length > 0
    && row.bucket_id === selector.bucket && row.object_name === selector.path
    && Number.isSafeInteger(row.size_bytes) && row.size_bytes > 0 && row.size_bytes <= LIMITS[selector.bucket]
    && MEDIA.has(row.mime_type)
    && (selector.bucket !== 'business-logos' || row.mime_type.startsWith('image/')) ? row : null;
}

export function createPrivateFileHandler({ createUserClient, createServiceClient, allowedOrigin, configured = () => true }) {
  return async request => {
    const origin = request.headers.get('origin') || '';
    const originAllowed = !origin || allowedOrigin(origin);
    const headers = {
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      'Surrogate-Control': 'no-store', 'Pragma': 'no-cache',
      'Vary': 'Origin, Authorization, apikey', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Expose-Headers': 'X-Mushavo-Media-Type',
      ...(origin && originAllowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    };
    const fail = (status, code) => new Response(JSON.stringify({ error: code }), {
      status, headers: { ...headers, 'Content-Type': 'application/json' },
    });
    if (!originAllowed) return fail(403, 'ORIGIN_NOT_ALLOWED');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED');
    if (!configured()) return fail(503, 'PRIVATE_FILE_UNAVAILABLE');
    const authorization = request.headers.get('authorization') || '';
    const match = /^Bearer ([A-Za-z0-9._-]{20,8192})$/i.exec(authorization);
    if (!match) return fail(401, 'AUTHENTICATION_REQUIRED');
    let selector;
    try { selector = await selectorBody(request); } catch { return fail(400, 'INVALID_FILE_SELECTOR'); }
    try {
      const client = createUserClient(match[1]);
      const { data: identity, error: identityError } = await client.auth.getUser();
      if (identityError || !identity?.user?.id) return fail(401, 'AUTHENTICATION_REQUIRED');
      const session = await client.rpc('app_session_status');
      if (session.error || session.data?.session_valid !== true) return fail(403, 'CURRENT_SESSION_REQUIRED');
      const context = async () => {
        const result = await client.rpc('private_file_download_context', { p_bucket_id: selector.bucket, p_object_name: selector.path });
        return result.error ? null : safeContext(result.data, selector);
      };
      const before = await context();
      if (!before) return fail(404, 'FILE_NOT_AVAILABLE');
      const result = await createServiceClient().storage.from(selector.bucket).download(selector.path);
      if (result.error || !(result.data instanceof Blob) || result.data.size !== before.size_bytes
        || result.data.size > LIMITS[selector.bucket]) return fail(404, 'FILE_NOT_AVAILABLE');
      const after = await context();
      if (!sameObject(before, after)) return fail(404, 'FILE_NOT_AVAILABLE');
      return new Response(result.data, { status: 200, headers: {
        ...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': String(result.data.size),
        'Content-Disposition': 'attachment; filename="private-file"', 'X-Mushavo-Media-Type': before.mime_type,
      } });
    } catch { return fail(503, 'PRIVATE_FILE_UNAVAILABLE'); }
  };
}
