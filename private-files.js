const PREVIEW_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

// The callback binds an asynchronous response to the current user, workspace
// and listed object. It must not be replaced by a caller-supplied authority ID.
export async function fetchPrivateFile(client, bucket, path, isCurrent) {
  if (!isCurrent()) return null;
  const { data, error, response } = await client.functions.invoke('get-private-file', { body: { bucket, path } });
  if (!isCurrent()) return null;
  if (error || !(data instanceof Blob) || !data.size) throw new Error('This file is unavailable. Refresh your workspace and try again.');
  const mediaType = response?.headers.get('X-Mushavo-Media-Type') || '';
  return { blob: new Blob([data], { type: PREVIEW_TYPES.has(mediaType) ? mediaType : 'application/octet-stream' }), mediaType };
}

export function revokePrivateFileUrl(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export async function openPrivateFile(client, bucket, path, isCurrent, name = 'private-file') {
  const file = await fetchPrivateFile(client, bucket, path, isCurrent);
  if (!file || !isCurrent()) return;
  const url = URL.createObjectURL(file.blob);
  try {
    if (!isCurrent()) return;
    const link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.referrerPolicy = 'no-referrer';
    if (!PREVIEW_TYPES.has(file.mediaType)) link.download = String(name).replace(/[^a-z0-9._-]/gi, '_').slice(0, 128) || 'private-file';
    link.click();
  } finally {
    // Give an opened preview time to consume its local bytes, then release them.
    setTimeout(() => revokePrivateFileUrl(url), 60000);
  }
}
