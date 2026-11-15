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

const VALIDATED_PDF_LEAF = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}[.]pdf$/;
const MAX_MANAGED_PDF_SIZE = 10 * 1024 * 1024;

export function usesManagedSubscriptionPdf(config, file) {
  return config?.supabaseUrl === 'https://dczlddwbtgvfdujgcitb.supabase.co' && file?.type === 'application/pdf';
}

export async function uploadManagedSubscriptionPdf(client, file, workspaceId, userId, isCurrent) {
  const changed = () => new Error('The workspace changed. Open the form again.');
  if (!isCurrent()) throw changed();
  const intent = crypto.randomUUID();
  const prefix = 'workspaces/' + workspaceId + '/' + userId + '/managed-proof-v1/' + intent + '/';
  const {data, error} = await client.functions.invoke('validate-managed-subscription-proof', {
    body: file,
    headers: {'Content-Type': file.type, 'x-mushavo-attachment': workspaceId + ':' + intent},
  });
  if (!isCurrent()) throw changed();
  if (error) {
    if (error.context?.status === 413) throw new Error('This PDF exceeds the proof size or processing limits.');
    if (error.context?.status === 422) throw new Error('Choose a static PDF receipt without forms or attached files.');
    if (error.context?.status === 429) throw new Error('Too many proof uploads are pending. Try again after earlier uploads finish.');
    throw error;
  }
  if (typeof data?.path !== 'string' || !data.path.startsWith(prefix)
    || !VALIDATED_PDF_LEAF.test(data.path.slice(prefix.length)) || data.type !== 'application/pdf'
    || !Number.isSafeInteger(data.size) || data.size < 1 || data.size > MAX_MANAGED_PDF_SIZE) {
    throw new Error('The validated payment proof could not be confirmed.');
  }
  return {path: data.path, type: data.type, size: data.size, name: file.name, managed: true};
}
