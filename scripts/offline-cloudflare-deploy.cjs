// Local preparation only. No address, request body or environment value is logged.
const fs = require('node:fs');
const {syncBuiltinESMExports} = require('node:module');
const report = process.env.MUSHAVO_LIMITER_NETWORK_REPORT;
if (!report) throw new Error('LOCAL_NETWORK_REPORT_REQUIRED');
fs.appendFileSync(report, 'L');
const deny = () => {
  fs.appendFileSync(report, 'B');
  throw new Error('LOCAL_DEPLOY_NETWORK_DISABLED');
};
globalThis.fetch = deny;
for (const module of ['node:http','node:https']) {
  const api = require(module); api.request = deny; api.get = deny;
}
require('node:net').Socket.prototype.connect = deny;
require('node:tls').connect = deny;
require('node:dgram').Socket.prototype.send = deny;
require('node:dns').lookup = deny;
require('node:dns').resolve = deny;
syncBuiltinESMExports();
