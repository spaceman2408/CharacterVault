/**
 * Minimal CORS proxy for NanoGPT subscription usage.
 *
 * Why: GET https://nano-gpt.com/api/subscription/v1/usage has no browser CORS
 * headers (models + check-balance do). The official CharacterVault host already
 * serves a proxy for end users. This worker is for people who self-host their
 * own production build of CharacterVault.
 *
 * Security:
 * - Allowlists a single upstream path
 * - Does not log Authorization / x-api-key
 * - Does not store keys; pass-through only
 *
 * Deploy (free Workers tier is enough) only if you self-host production.
 * Full guide: docs/configuration/nanogpt-usage-proxy.md
 *
 *   cd workers/nanogpt-usage-proxy
 *   npx wrangler deploy
 *   VITE_NANOGPT_PROXY=https://<your-worker>.workers.dev  (at build time)
 */

const UPSTREAM = 'https://nano-gpt.com';
const ALLOWED_PATH = '/api/subscription/v1/usage';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-key',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
};

function corsResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(body, { ...init, headers });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return corsResponse(null, { status: 204 });
    }

    if (request.method !== 'GET') {
      return corsResponse(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    // Accept either exact path or root → usage (for short proxy bases)
    let targetPath = url.pathname;
    if (targetPath === '/' || targetPath === '') {
      targetPath = ALLOWED_PATH;
    }
    if (targetPath !== ALLOWED_PATH) {
      return corsResponse(
        JSON.stringify({
          error: 'Only GET /api/subscription/v1/usage is proxied',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const auth = request.headers.get('Authorization') || '';
    const apiKey = request.headers.get('x-api-key') || '';
    if (!auth && !apiKey) {
      return corsResponse(JSON.stringify({ error: 'Missing API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const upstreamHeaders = {};
    if (auth) upstreamHeaders['Authorization'] = auth;
    if (apiKey) upstreamHeaders['x-api-key'] = apiKey;

    let upstream;
    try {
      upstream = await fetch(`${UPSTREAM}${ALLOWED_PATH}${url.search}`, {
        method: 'GET',
        headers: upstreamHeaders,
      });
    } catch {
      return corsResponse(JSON.stringify({ error: 'Upstream unreachable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await upstream.arrayBuffer();
    const headers = new Headers();
    const contentType = upstream.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);

    return corsResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};
