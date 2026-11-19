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

const PRIVATE_LEAF = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}[.](pdf|png|csv|xlsx)$/;
const MANAGED_PROOF_TYPES = new Set(PREVIEW_TYPES);
const MAX_MANAGED_PROOF_SIZE = 10 * 1024 * 1024;

export function usesManagedSubscriptionUpload(config, file) {
  return usesManagedPrivateUploads(config) && MANAGED_PROOF_TYPES.has(file?.type);
}

export async function uploadManagedSubscriptionProof(client, file, workspaceId, userId, isCurrent) {
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
  return verifyUploadReceipt(data, file, prefix, MAX_MANAGED_PROOF_SIZE);
}

export function usesManagedPrivateUploads(config) {
  return config?.supabaseUrl === 'https://dczlddwbtgvfdujgcitb.supabase.co';
}

export function isManagedPaymentProof(path) {
  const parts = typeof path === 'string' ? path.split('/') : [];
  return (parts[0] === 'personal' && parts[2] === 'managed-upload-v1')
    || (parts[0] === 'families' && parts[4] === 'managed-upload-v1');
}

function verifyUploadReceipt(data, file, prefix, limit, expectedLeaf = null) {
  const table = file.type === 'text/csv' ? 'csv'
    : file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ? 'xlsx' : null;
  const extension = file.type === 'application/pdf' ? 'pdf' : table || 'png';
  const mime = table || extension === 'pdf' ? file.type : 'image/png';
  const leaf = typeof data?.path === 'string' && data.path.startsWith(prefix) ? data.path.slice(prefix.length) : '';
  if (!PRIVATE_LEAF.test(leaf) || !leaf.endsWith('.' + extension) || (expectedLeaf && leaf !== expectedLeaf)
    || data.type !== mime || !Number.isSafeInteger(data.size) || data.size < 1 || data.size > limit) {
    throw new Error('The validated file could not be confirmed.');
  }
  const name = data.type === file.type ? file.name : (file.name.replace(/\.[^.]*$/, '').trim() || 'attachment') + '.' + extension;
  return {path:data.path,type:data.type,size:data.size,name,managed:true};
}

export async function uploadManagedPrivateFile(client, file, scope) {
  const {bucket, workspaceId, userId, parentType, parentId, familyId, familyOwner, isCurrent} = scope;
  const changed = () => new Error('The workspace changed. Open the form again.');
  if (!isCurrent()) throw changed();

  const logo = bucket === 'business-logos';
  const document = bucket === 'business-documents';
  const attachment = scope.attachment || (logo ? 'f3320000' + crypto.randomUUID().slice(8) : crypto.randomUUID());
  const header = [bucket,workspaceId,attachment,...(document ? [parentType,parentId] : [])].join(':');
  const prefix = logo ? [workspaceId,userId,''].join('/')
    : document ? ['workspaces',workspaceId,userId,attachment,'managed-upload-v1',''].join('/')
    : [...(familyId ? ['families',familyId,familyOwner,userId] : ['personal',userId]),'managed-upload-v1',attachment,''].join('/');
  const {data, error} = await client.functions.invoke('validate-ordinary-private-upload', {
    body:file,headers:{'Content-Type':file.type,'x-mushavo-attachment':header}
  });
  if (!isCurrent()) throw changed();
  if (error) {
    const status = error.context?.status;
    if (status === 413) throw new Error('This file exceeds the size or processing limits.');
    if (status === 415 || status === 422) throw new Error('The file format could not be validated. Choose a supported image or static document.');
    if (status === 429) throw new Error('Too many uploads are pending. Try again after earlier uploads finish.');
    throw error;
  }
  return verifyUploadReceipt(data,file,prefix,logo ? 2097152 : MAX_MANAGED_PROOF_SIZE,logo ? attachment + '.png' : null);
}
