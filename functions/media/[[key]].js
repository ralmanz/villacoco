/**
 * Public media delivery from the VILLA_COCO_MEDIA R2 bucket.
 * GET/HEAD /media/<key>
 *
 * CMS stores the canonical source path only: /media/<key>
 * Cloudflare image transformations can wrap that path later:
 *   /cdn-cgi/image/width=1600,quality=80/media/<key>
 * without rewriting stored CMS URLs. The bare /media/<key> always works.
 *
 * Repeat GETs are served from the edge Cache API (caches.default) so R2
 * is not read on every request. Keys are immutable, so cached entries
 * stay valid for the life of the object.
 */

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,240}$/;

function mediaKey(params) {
  const raw = params && params.key;
  const joined = Array.isArray(raw) ? raw.join('/') : String(raw || '');
  let decoded = joined;
  try {
    decoded = decodeURIComponent(joined);
  } catch (_) {
    return '';
  }
  if (!decoded || decoded.includes('..') || decoded.startsWith('/') || decoded.includes('\\')) {
    return '';
  }
  return SAFE_KEY.test(decoded) ? decoded : '';
}

function buildHeaders(object) {
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set(
    'Cache-Control',
    object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable'
  );
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

function cacheKeyFor(request) {
  return new Request(new URL(request.url).toString(), { method: 'GET' });
}

export async function onRequest(context) {
  const { request, env, params, waitUntil } = context;
  const method = request.method.toUpperCase();

  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const key = mediaKey(params);
  if (!key || !env.VILLA_COCO_MEDIA) {
    return new Response('Not found', { status: 404 });
  }

  const cache = caches.default;
  const cacheKey = cacheKeyFor(request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    if (method === 'HEAD') {
      return new Response(null, { status: cached.status, headers: cached.headers });
    }
    return cached;
  }

  if (method === 'HEAD') {
    const meta = await env.VILLA_COCO_MEDIA.head(key);
    if (!meta) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(null, { status: 200, headers: buildHeaders(meta) });
  }

  const object = await env.VILLA_COCO_MEDIA.get(key);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const response = new Response(object.body, {
    status: 200,
    headers: buildHeaders(object),
  });
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
