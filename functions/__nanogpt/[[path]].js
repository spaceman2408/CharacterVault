const UPSTREAM = 'https://nano-gpt.com';
const ALLOWED_PATH = '/api/subscription/v1/usage';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest(context) {
  const { request, params } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const rest = Array.isArray(params.path)
    ? params.path.join('/')
    : String(params.path || '');
  const targetPath = `/${rest.replace(/^\/+/, '')}`;
  if (targetPath !== ALLOWED_PATH) {
    return json(404, { error: 'Only GET /api/subscription/v1/usage is proxied' });
  }

  const auth = request.headers.get('Authorization') || '';
  const apiKey = request.headers.get('x-api-key') || '';
  if (!auth && !apiKey) {
    return json(401, { error: 'Missing API key' });
  }

  const upstreamHeaders = {};
  if (auth) upstreamHeaders.Authorization = auth;
  if (apiKey) upstreamHeaders['x-api-key'] = apiKey;

  const url = new URL(request.url);
  let upstream;
  try {
    upstream = await fetch(`${UPSTREAM}${ALLOWED_PATH}${url.search}`, {
      method: 'GET',
      headers: upstreamHeaders,
    });
  } catch {
    return json(502, { error: 'Upstream unreachable' });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
