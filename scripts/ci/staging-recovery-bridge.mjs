import { generateKeyPairSync, createPublicKey, diffieHellman, hkdfSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { need } from './staging-access.mjs';

const PROTOCOL = 'mushavo-staging-recovery-v1';
const BRANCH = 'security/stage-3-authorization';
const REPO = 'dwtdhruvp246/mushavobudget';
const PHASES = new Set(['CONFIRM_A', 'RECOVER_A', 'EXPIRE_A', 'RESTORE_A', 'LEGACY_A', 'CLEANUP']);
export function bridgeKey() { return generateKeyPairSync('x25519'); }
export function publicBridgeKey(key) { return key.export({ type: 'spki', format: 'der' }).toString('base64url'); }
function aad(binding) {
  need(/^\d+$/.test(binding.run) && /^[0-9a-f]{40}$/.test(binding.commit) && PHASES.has(binding.phase), 'BRIDGE_BINDING_REQUIRED');
  return Buffer.from(JSON.stringify({ protocol: PROTOCOL, run: binding.run, commit: binding.commit, phase: binding.phase }));
}
function symmetric(privateKey, publicKey, binding) {
  const peer = createPublicKey({ key: Buffer.from(publicKey, 'base64url'), type: 'spki', format: 'der' });
  need(peer.asymmetricKeyType === 'x25519', 'BRIDGE_KEY_TYPE_REQUIRED');
  return Buffer.from(hkdfSync('sha256', diffieHellman({ privateKey, publicKey: peer }), Buffer.alloc(32), aad(binding), 32));
}
export function sealBridge(publicKey, binding, payload) {
  const pair = bridgeKey(), iv = randomBytes(12);
  const key = symmetric(pair.privateKey, publicKey, binding), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(binding));
  const bytes = Buffer.from(JSON.stringify(payload));
  need(bytes.length <= 6000, 'BRIDGE_PAYLOAD_BOUND_REQUIRED');
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]); key.fill(0);
  return { protocol: PROTOCOL, ...binding, ephemeral_key: publicBridgeKey(pair.publicKey), iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
}
export function openBridge(privateKey, binding, sealed) {
  need(sealed?.protocol === PROTOCOL && ['run','commit','phase'].every(k => sealed[k] === binding[k]), 'BRIDGE_REPLAY_OR_BINDING_REFUSED');
  need(typeof sealed.ciphertext === 'string' && sealed.ciphertext.length <= 8200, 'BRIDGE_PAYLOAD_BOUND_REQUIRED');
  const key = symmetric(privateKey, sealed.ephemeral_key, binding);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64url'));
  decipher.setAAD(aad(binding)); decipher.setAuthTag(Buffer.from(sealed.tag, 'base64url'));
  try { return JSON.parse(Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, 'base64url')), decipher.final()]).toString()); }
  finally { key.fill(0); }
}
export function createMailbox(env, fetcher = fetch) {
  need(env.GITHUB_REPOSITORY === REPO && env.GITHUB_REF === 'refs/heads/' + BRANCH
    && typeof env.GITHUB_TOKEN === 'string' && env.GITHUB_TOKEN.length > 10, 'BRIDGE_STAGING_WORKFLOW_REQUIRED');
  const pair = bridgeKey(), publicKey = publicBridgeKey(pair.publicKey), commit = env.GITHUB_SHA, run = env.GITHUB_RUN_ID;
  const base = 'https://api.github.com/repos/' + REPO;
  const headers = { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' };
  let polls = 0;
  async function status(description, state = 'pending') {
    const result = await fetcher(base + '/statuses/' + commit, { method: 'POST', headers,
      redirect: 'error', signal: AbortSignal.timeout(20000), body: JSON.stringify({ state, context: 'mushavo/recovery-mailbox',
        description, target_url: 'https://github.com/' + REPO + '/actions/runs/' + run }) });
    need(result.status === 201, 'BRIDGE_STATUS_PUBLICATION_REQUIRED');
  }
  return { publicKey, status, get polls() { return polls; }, async receive(phase) {
    const binding = { run, commit, phase }; aad(binding);
    await status(phase + '|' + publicKey);
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      need(++polls <= 420, 'BRIDGE_POLL_BOUND_REACHED');
      const response = await fetcher(base + '/contents/scripts/ci/staging-recovery-mailbox.json?ref=' + encodeURIComponent(BRANCH), {
        headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
      need([200,404].includes(response.status), 'BRIDGE_INPUT_READ_REQUIRED');
      if (response.status === 200) {
        const data = await response.json();
        need(data.encoding === 'base64' && data.size <= 12000, 'BRIDGE_INPUT_FORMAT_REQUIRED');
        const sealed = JSON.parse(Buffer.from(data.content, 'base64').toString());
        if (sealed.run === run && sealed.commit === commit && sealed.phase === phase) return openBridge(pair.privateKey, binding, sealed);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    need(false, 'BRIDGE_INPUT_TIMEOUT_' + phase);
  }};
}
