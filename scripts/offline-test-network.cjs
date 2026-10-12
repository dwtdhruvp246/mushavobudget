// Default fetch/HTTP cannot contact services during offline regression.
// The existing native Agent test may run an injected lookup, but no successful
// address is passed back to Node's connector. This is not an OS sandbox.
const { syncBuiltinESMExports } = require('node:module');
const http = require('node:http');
const https = require('node:https');
const failure = () => new Error('OFFLINE_TEST_NETWORK_DISABLED');
const deny = () => { throw failure(); };
globalThis.fetch = deny;
http.request = http.get = deny;
const request = https.request;
https.request = function (options, ...args) {
  const lookup = options?.agent?.options?.lookup;
  if (typeof lookup !== 'function') return deny();
  // Exercise the real Agent's DNS rejection without allowing any address.
  options.agent.options.lookup = (host, settings, callback) => {
    lookup(host, settings, error => callback(error || failure()));
  };
  return request.call(this, options, ...args);
};
https.get = deny;
syncBuiltinESMExports();
