// Dashboard Reddit proxy.
//
// Reddit blocks unauthenticated requests from many server IPs (including the
// n8n container's). This dashboard server's WAN IP works fine, so we pass
// Reddit requests through this tiny sidecar.
//
// GET /reddit/<any-path>  →  https://www.reddit.com/<any-path>
//                            (preserves query string, returns body verbatim)
// GET /health             →  { ok: true }
//
// Configuration via env vars:
//   REDDIT_PROXY_PORT (default 8767)
//   REDDIT_PROXY_UA   (default 'HomeDashboard/1.0 (by /u/homedash)')

const http = require('http');
const https = require('https');

const PORT = Number(process.env.REDDIT_PROXY_PORT || 8767);
const UA = process.env.REDDIT_PROXY_UA || 'HomeDashboard/1.0 (by /u/homedash)';
const UPSTREAM = 'www.reddit.com';

function send(res, code, headers, body) {
  res.writeHead(code, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { 'Content-Type': 'application/json' }, '{"ok":true}');
  }

  if (req.method !== 'GET') return send(res, 405, {}, 'method not allowed');

  // Strip /reddit/ prefix; rest is the upstream path + query.
  const m = req.url.match(/^\/reddit(\/.*)?$/);
  if (!m) return send(res, 404, {}, 'not found');
  const upstreamPath = m[1] || '/';

  const upstreamReq = https.request({
    hostname: UPSTREAM,
    port: 443,
    path: upstreamPath,
    method: 'GET',
    headers: {
      'User-Agent': UA,
      'Accept': req.headers['accept'] || 'application/json,*/*',
      'Accept-Encoding': 'identity',
    },
    timeout: 15000,
  }, (upstreamRes) => {
    // Pass through status + content-type. Strip caching headers so n8n always
    // gets fresh content.
    const headers = {
      'Content-Type': upstreamRes.headers['content-type'] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    };
    res.writeHead(upstreamRes.statusCode || 502, headers);
    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    send(res, 502, { 'Content-Type': 'application/json' },
      JSON.stringify({ error: 'upstream', message: err.message }));
  });
  upstreamReq.on('timeout', () => {
    upstreamReq.destroy();
    send(res, 504, { 'Content-Type': 'application/json' },
      JSON.stringify({ error: 'upstream timeout' }));
  });
  upstreamReq.end();
});

server.listen(PORT, () => {
  console.log(`[reddit-proxy] listening on :${PORT}, upstream=${UPSTREAM}, UA="${UA}"`);
});
