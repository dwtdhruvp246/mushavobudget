import { lookup as dnsLookup } from "node:dns";
import { Agent } from "node:https";
import { isIP } from "node:net";

const DNS_TIMEOUT_MS = 3000;
const SOCKET_TIMEOUT_MS = 10000;
const SEND_TIMEOUT_MS = 15000;
const SEND_OPTION_KEYS = new Set(["TTL", "urgency", "topic", "contentEncoding"]);

export class PushDestinationError extends Error {
  constructor() {
    super("PUSH_DESTINATION_BLOCKED");
    this.name = "PushDestinationError";
    this.code = "PUSH_DESTINATION_BLOCKED";
  }
}

export function isBlockedPushDestination(error) {
  return error instanceof PushDestinationError;
}

function knownProviderHost(hostname) {
  if (hostname.length > 253 || hostname.split(".").some(label => label.length > 63)) return false;
  if (hostname === "fcm.googleapis.com" || hostname === "android.googleapis.com") return true;
  if (hostname === "updates.push.services.mozilla.com"
    || hostname === "updates-push.services.mozaws.net") return true;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname)) return false;
  return hostname.endsWith(".push.apple.com") || hostname.endsWith(".notify.windows.com");
}

export function validatePushEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length < 20 || endpoint.length > 4096
    || /[\s\u0000-\u001f\u007f\\]/u.test(endpoint) || endpoint.includes("#")) {
    throw new PushDestinationError();
  }
  const match = /^https:\/\/([^/?#]+)(?:[/?]|$)/i.exec(endpoint);
  // Reject user-info, encoded/Unicode authorities and nonstandard ports before URL normalization.
  if (!match || !/^[a-z0-9.-]+(?::443)?$/i.test(match[1])) throw new PushDestinationError();
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new PushDestinationError();
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash
    || parsed.port || !knownProviderHost(parsed.hostname)) throw new PushDestinationError();
  // Preserve the opaque provider path/query and subscription keys.
  return { endpoint, hostname: parsed.hostname };
}

export function isPublicPushAddress(address) {
  if (typeof address !== "string" || address.includes("%")) return false;
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2))
      || (b === 88 && c === 99))) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family !== 6 || address.includes(".")) return false;
  const halves = address.toLowerCase().split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 1
    ? left
    : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  const [first, second] = groups.map(part => parseInt(part, 16));
  // Conservative globally-routable unicast only. Reject mapped/translation/tunnel and special-use space.
  if (first < 0x2000 || first > 0x3fff) return false;
  if (first === 0x2001 && (second < 0x0200 || second === 0x0db8)) return false;
  if (first === 0x2002 || (first === 0x3fff && second < 0x1000)) return false;
  return true;
}

function lookupFailure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function createPushLookup(expectedHostname, resolver = dnsLookup, timeoutMs = DNS_TIMEOUT_MS) {
  return function guardedLookup(hostname, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    if (typeof options === "number") options = { family: options };
    options ||= {};
    if (typeof hostname !== "string" || hostname.toLowerCase() !== expectedHostname
      || !knownProviderHost(hostname.toLowerCase())) {
      callback(new PushDestinationError());
      return;
    }
    let completed = false;
    const finish = (error, records) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      if (error) {
        callback(error);
        return;
      }
      const family = Number(options.family || 0);
      const candidates = records.filter(record => !family || record.family === family);
      if (!candidates.length) {
        callback(lookupFailure("PUSH_DNS_NO_COMPATIBLE_ADDRESS"));
      } else if (options.all) {
        callback(null, candidates.map(({ address, family }) => ({ address, family })));
      } else {
        callback(null, candidates[0].address, candidates[0].family);
      }
    };
    const timer = setTimeout(() => finish(lookupFailure("PUSH_DNS_TIMEOUT")), timeoutMs);
    try {
      resolver(hostname, { all: true, verbatim: true }, (error, records) => {
        if (completed) return;
        if (error || !Array.isArray(records) || !records.length) {
          finish(lookupFailure("PUSH_DNS_LOOKUP_FAILED"));
          return;
        }
        // Reject the entire answer if it contains any private/invalid address.
        if (records.some(record => !record || !isPublicPushAddress(record.address)
          || record.family !== isIP(record.address))) {
          finish(new PushDestinationError());
          return;
        }
        // The Agent connects using this exact vetted answer; no separate preflight/re-resolution.
        finish(null, records);
      });
    } catch {
      finish(lookupFailure("PUSH_DNS_LOOKUP_FAILED"));
    }
  };
}

export function createGuardedPushSender(webpush, resolver = dnsLookup) {
  return async function sendGuardedPush(subscription, payload, options = {}) {
    const { endpoint, hostname } = validatePushEndpoint(subscription?.endpoint);
    if (!options || typeof options !== "object" || Array.isArray(options)
      || Object.keys(options).some(key => !SEND_OPTION_KEYS.has(key))) {
      throw lookupFailure("PUSH_SEND_OPTIONS_INVALID");
    }
    const agent = new Agent({
      keepAlive: false,
      maxCachedSessions: 0,
      rejectUnauthorized: true,
      servername: hostname,
      // Deno/newer Node can inherit environment proxies; they would bypass this lookup.
      proxyEnv: {},
      lookup: createPushLookup(hostname, resolver),
    });
    let timer;
    try {
      return await Promise.race([
        webpush.sendNotification(
          { endpoint, keys: subscription.keys },
          payload,
          { ...options, timeout: SOCKET_TIMEOUT_MS, agent },
        ),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(lookupFailure("PUSH_SEND_TIMEOUT")), SEND_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      agent.destroy();
    }
  };
}
