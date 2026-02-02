const http = require('http');
const https = require('https');
const { URL } = require('url');

let _cachedBase = null;

/**
 * Get Orthanc base URL with localhost normalized to 127.0.0.1 (IPv4)
 * so the proxy connects to Orthanc when it listens on 127.0.0.1 only.
 */
function getTargetBase() {
  if (_cachedBase) return _cachedBase;
  const raw = process.env.TARGET_SERVICE || 'http://localhost:8042';
  const url = new URL(raw);
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
  }
  _cachedBase = url.toString().replace(/\/$/, '');
  return _cachedBase;
}

/**
 * Make HTTP request to Orthanc. Uses Node built-in http/https only (no axios).
 * @param {string} method - GET, POST, DELETE, etc.
 * @param {string} path - path (e.g. /tools/find, /studies/xxx)
 * @param {object|null} body - optional JSON body for POST
 * @returns {Promise<{ statusCode: number, data: any }>}
 */
function request(method, path, body = null) {
  const base = getTargetBase();
  const url = new URL(path.startsWith('http') ? path : base + (path.startsWith('/') ? path : '/' + path));
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  const bodyStr = body != null ? JSON.stringify(body) : null;
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method,
    headers: {}
  };
  if (bodyStr) {
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let data;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) {
          try {
            data = JSON.parse(buf.toString('utf8'));
          } catch {
            data = buf.toString('utf8');
          }
        } else {
          data = buf.toString('utf8');
        }
        const result = { statusCode: res.statusCode, data };
        if (res.statusCode >= 400) {
          const err = new Error(`Orthanc responded with ${res.statusCode}`);
          err.response = { status: res.statusCode, data };
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function get(path) {
  return request('GET', path);
}

function post(path, body) {
  return request('POST', path, body);
}

function del(path) {
  return request('DELETE', path);
}

module.exports = {
  getTargetBase,
  request,
  get,
  post,
  delete: del
};
