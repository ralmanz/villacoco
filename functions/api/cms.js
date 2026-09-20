/**
 * Villa Coco CMS API
 * Cloudflare Pages Function
 *
 * GET  /api/cms        → public read of live content
 * GET  /api/cms?action=stats  → read analytics summary (auth required)
 * GET  /api/cms?action=seo-health → read SEO integration/health checks (auth required)
 * GET  /api/cms?action=auth   → verify admin password (fallback for restricted hosts)
 * POST /api/cms?action=auth   → verify admin password
 * POST /api/cms?action=track  → track pageview/click event
 * POST /api/cms        → save new content (auth required)
 * POST /api/cms?action=revert → revert to previous save (auth required)
 * POST /api/cms?action=upload-media → upload an image to R2 (auth required)
 */

const MAX_JSON_CHARS = 300_000;
const MAX_TEXT_CHARS = 8_000;
const MAX_ITEMS = 50;
const MAX_DEPTH = 8;
const MAX_ANALYTICS_FIELD = 120;
const MAX_VISITOR_ID = 64;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const ANALYTICS_KEY = 'cms_analytics';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const headers = corsHeaders(request, env);
  const action = url.searchParams.get('action');

  if (action === 'health') {
    return json({ ok: true, service: 'villacoco-cms-api' }, 200, headers);
  }

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (!env.ADMIN_PASSWORD) {
    return json({ error: 'Server missing ADMIN_PASSWORD' }, 500, headers);
  }
  if (!env.VILLA_COCO_CMS) {
    return json({ error: 'Server missing VILLA_COCO_CMS binding' }, 500, headers);
  }

  if (!isOriginAllowed(request, env)) {
    return json({ error: 'Origin not allowed' }, 403, headers);
  }

  const isAuthRoute = action === 'auth' || url.pathname.endsWith('/auth');
  const isRevertRoute = action === 'revert' || url.pathname.endsWith('/revert');

  if (method === 'GET' && action === 'stats') {
    if (!isAuthorized(request, env)) {
      return json({ error: 'Unauthorized' }, 401, headers);
    }
    try {
      const analytics = await readAnalytics(env);
      return json(formatAnalytics(analytics), 200, headers);
    } catch (e) {
      return json({ error: 'Failed to read analytics' }, 500, headers);
    }
  }

  if (method === 'GET' && action === 'seo-health') {
    if (!isAuthorized(request, env)) {
      return json({ error: 'Unauthorized' }, 401, headers);
    }
    try {
      const health = await buildSeoHealth(env, request.url);
      return json(health, 200, headers);
    } catch (e) {
      return json({ error: 'Failed to read seo health' }, 500, headers);
    }
  }

  if (method === 'GET' && isAuthRoute) {
    if (!isAuthorized(request, env)) {
      return json({ error: 'Unauthorized' }, 401, headers);
    }
    return json({ success: true }, 200, headers);
  }

  if (method === 'GET') {
    try {
      const raw = await env.VILLA_COCO_CMS.get('cms_current');
      if (!raw) return json({}, 200, headers);
      return json(JSON.parse(raw), 200, headers);
    } catch (e) {
      return json({ error: 'Failed to read content' }, 500, headers);
    }
  }

  if (method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, headers);
  }

  if (action === 'track') {
    try {
      const payload = await request.json();
      const eventType = payload?.type === 'click' ? 'click' : payload?.type === 'pageview' ? 'pageview' : '';
      if (!eventType) {
        return json({ error: 'Invalid analytics event type' }, 400, headers);
      }

      const analytics = await readAnalytics(env);
      const dayKey = new Date().toISOString().slice(0, 10);
      const path = normalizeAnalyticsField(payload?.path, '/');
      const label = normalizeAnalyticsField(payload?.label, 'Unknown');
      const visitorId = normalizeVisitorId(payload?.visitorId);
      const device = normalizeDevice(payload?.device);

      analytics.totals.views += eventType === 'pageview' ? 1 : 0;
      analytics.totals.clicks += eventType === 'click' ? 1 : 0;
      analytics.totals.uniqueVisitors = Number(analytics.totals.uniqueVisitors) || 0;

      if (eventType === 'pageview') {
        analytics.byPath[path] = (analytics.byPath[path] || 0) + 1;
        analytics.byDevice[device] = (analytics.byDevice[device] || 0) + 1;
      }
      if (eventType === 'click') {
        analytics.byClickLabel[label] = (analytics.byClickLabel[label] || 0) + 1;
      }

      if (!analytics.daily[dayKey]) {
        analytics.daily[dayKey] = {
          views: 0,
          clicks: 0,
          uniqueVisitors: 0,
          visitorIds: {},
          devices: { desktop: 0, mobile: 0, tablet: 0, other: 0 },
        };
      } else {
        analytics.daily[dayKey].uniqueVisitors = Number(analytics.daily[dayKey].uniqueVisitors) || 0;
        analytics.daily[dayKey].visitorIds = analytics.daily[dayKey].visitorIds && typeof analytics.daily[dayKey].visitorIds === 'object'
          ? analytics.daily[dayKey].visitorIds
          : {};
        analytics.daily[dayKey].devices = analytics.daily[dayKey].devices && typeof analytics.daily[dayKey].devices === 'object'
          ? {
              desktop: Number(analytics.daily[dayKey].devices.desktop) || 0,
              mobile: Number(analytics.daily[dayKey].devices.mobile) || 0,
              tablet: Number(analytics.daily[dayKey].devices.tablet) || 0,
              other: Number(analytics.daily[dayKey].devices.other) || 0,
            }
          : { desktop: 0, mobile: 0, tablet: 0, other: 0 };
      }
      analytics.daily[dayKey].views += eventType === 'pageview' ? 1 : 0;
      analytics.daily[dayKey].clicks += eventType === 'click' ? 1 : 0;
      if (eventType === 'pageview') {
        analytics.daily[dayKey].devices[device] = (analytics.daily[dayKey].devices[device] || 0) + 1;
      }

      if (visitorId) {
        if (!analytics.visitors[visitorId]) {
          analytics.totals.uniqueVisitors += 1;
          analytics.visitors[visitorId] = {
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            device,
          };
        } else {
          analytics.visitors[visitorId].lastSeen = new Date().toISOString();
          analytics.visitors[visitorId].device = device;
        }

        if (!analytics.daily[dayKey].visitorIds[visitorId]) {
          analytics.daily[dayKey].visitorIds[visitorId] = 1;
          analytics.daily[dayKey].uniqueVisitors += 1;
        }
      }
      analytics.updatedAt = new Date().toISOString();

      await env.VILLA_COCO_CMS.put(ANALYTICS_KEY, JSON.stringify(analytics));
      return json({ success: true }, 202, headers);
    } catch (e) {
      return json({ error: 'Failed to track event' }, 500, headers);
    }
  }

  if (!isAuthorized(request, env)) {
    return json({ error: 'Unauthorized' }, 401, headers);
  }

  if (isAuthRoute) {
    return json({ success: true }, 200, headers);
  }

  if (isRevertRoute) {
    try {
      const backup = await env.VILLA_COCO_CMS.get('cms_backup');
      if (!backup) return json({ error: 'No backup available to revert to' }, 404, headers);
      const current = await env.VILLA_COCO_CMS.get('cms_current');
      if (current) await env.VILLA_COCO_CMS.put('cms_backup', current);
      await env.VILLA_COCO_CMS.put('cms_current', backup);
      return json({ success: true, message: 'Reverted to previous version' }, 200, headers);
    } catch (e) {
      return json({ error: 'Revert failed' }, 500, headers);
    }
  }

  if (action === 'upload-media') {
    try {
      const out = await uploadMediaToR2(request, env);
      return json(out, 200, headers);
    } catch (e) {
      const msg = e?.message || 'Image upload failed';
      let status = 500;
      if (/not configured/i.test(msg)) status = 503;
      else if (/too large|unsupported|required/i.test(msg)) status = 400;
      return json({ error: msg }, status, headers);
    }
  }

  if (action) {
    return json({ error: 'Unknown action' }, 404, headers);
  }

  try {
    const body = await request.json();
    const validation = validatePayload(body);
    if (!validation.ok) {
      return json({ error: validation.error }, 400, headers);
    }

    const encoded = JSON.stringify(body);
    if (encoded.length > MAX_JSON_CHARS) {
      return json({ error: 'Payload too large' }, 400, headers);
    }

    const current = await env.VILLA_COCO_CMS.get('cms_current');
    if (current) await env.VILLA_COCO_CMS.put('cms_backup', current);
    await env.VILLA_COCO_CMS.put('cms_current', encoded);
    return json({ success: true }, 200, headers);
  } catch (e) {
    return json({ error: 'Save failed' }, 500, headers);
  }
}

function isAuthorized(request, env) {
  return request.headers.get('X-Admin-Password') === env.ADMIN_PASSWORD;
}

/**
 * Authenticated image upload into the VILLA_COCO_MEDIA R2 bucket.
 * Stores one immutable original and returns the canonical /media/<key> URL.
 */
async function uploadMediaToR2(request, env) {
  if (!env.VILLA_COCO_MEDIA) {
    throw new Error('Image storage is not configured. Ask your technical manager to connect website media storage.');
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('An image file is required');
  }

  const type = String(file.type || '').toLowerCase();
  const ext = ALLOWED_IMAGE_TYPES[type];
  if (!ext) {
    throw new Error('Unsupported image format. Use JPG, PNG, or WebP.');
  }
  if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image is too large. Use a file of 10 MB or smaller.');
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Image is too large. Use a file of 10 MB or smaller.');
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  const key = `v1/${yyyy}/${mm}/${id}.${ext}`;

  await env.VILLA_COCO_MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  return { success: true, url: `/media/${key}` };
}

async function readAnalytics(env) {
  const raw = await env.VILLA_COCO_CMS.get(ANALYTICS_KEY);
  if (!raw) {
    return {
      totals: { views: 0, clicks: 0, uniqueVisitors: 0 },
      byDevice: { desktop: 0, mobile: 0, tablet: 0, other: 0 },
      visitors: {},
      byPath: {},
      byClickLabel: {},
      daily: {},
      updatedAt: null,
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      totals: {
        views: Number(parsed?.totals?.views) || 0,
        clicks: Number(parsed?.totals?.clicks) || 0,
        uniqueVisitors: Number(parsed?.totals?.uniqueVisitors) || Object.keys(parsed?.visitors || {}).length || 0,
      },
      byDevice: parsed?.byDevice && typeof parsed.byDevice === 'object'
        ? {
            desktop: Number(parsed.byDevice.desktop) || 0,
            mobile: Number(parsed.byDevice.mobile) || 0,
            tablet: Number(parsed.byDevice.tablet) || 0,
            other: Number(parsed.byDevice.other) || 0,
          }
        : { desktop: 0, mobile: 0, tablet: 0, other: 0 },
      visitors: parsed?.visitors && typeof parsed.visitors === 'object' ? parsed.visitors : {},
      byPath: parsed?.byPath && typeof parsed.byPath === 'object' ? parsed.byPath : {},
      byClickLabel: parsed?.byClickLabel && typeof parsed.byClickLabel === 'object' ? parsed.byClickLabel : {},
      daily: parsed?.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch (e) {
    return {
      totals: { views: 0, clicks: 0, uniqueVisitors: 0 },
      byDevice: { desktop: 0, mobile: 0, tablet: 0, other: 0 },
      visitors: {},
      byPath: {},
      byClickLabel: {},
      daily: {},
      updatedAt: null,
    };
  }
}

function normalizeAnalyticsField(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.slice(0, MAX_ANALYTICS_FIELD);
}

function normalizeVisitorId(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, MAX_VISITOR_ID);
}

function normalizeDevice(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (v === 'mobile' || v === 'tablet' || v === 'desktop') return v;
  return 'other';
}

async function buildSeoHealth(env, requestUrl) {
  const url = new URL(requestUrl);
  const origin = `${url.protocol}//${url.host}`;
  const sitemapUrl = `${origin}/sitemap.xml`;

  let sitemap = { ok: false, status: null, checkedUrl: sitemapUrl };
  try {
    const res = await fetch(sitemapUrl, { method: 'GET' });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const body = await res.text();
    const looksXml = body.includes('<urlset') || body.includes('<sitemapindex');
    sitemap = {
      ok: res.ok && contentType.includes('xml') && looksXml,
      status: res.status,
      checkedUrl: sitemapUrl,
    };
  } catch (e) {
    sitemap = { ok: false, status: null, checkedUrl: sitemapUrl };
  }

  // Lightweight "connected" signal for Phase 2:
  // if GSC OAuth/config credentials exist in env, treat as configured.
  const gscConfigured = Boolean(
    (env.GSC_CLIENT_ID && env.GSC_CLIENT_SECRET) ||
    env.GSC_REFRESH_TOKEN
  );

  return {
    sitemap,
    gsc: {
      configured: gscConfigured,
      mode: 'env-config',
    },
    checkedAt: new Date().toISOString(),
  };
}

function formatAnalytics(analytics) {
  const topPages = Object.entries(analytics.byPath || {})
    .map(([path, count]) => ({ path, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topClicks = Object.entries(analytics.byClickLabel || {})
    .map(([label, count]) => ({ label, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const daily = Object.entries(analytics.daily || {})
    .map(([date, bucket]) => ({
      date,
      views: Number(bucket?.views) || 0,
      clicks: Number(bucket?.clicks) || 0,
      uniqueVisitors: Number(bucket?.uniqueVisitors) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const byDevice = {
    desktop: Number(analytics?.byDevice?.desktop) || 0,
    mobile: Number(analytics?.byDevice?.mobile) || 0,
    tablet: Number(analytics?.byDevice?.tablet) || 0,
    other: Number(analytics?.byDevice?.other) || 0,
  };

  return {
    totals: {
      views: Number(analytics?.totals?.views) || 0,
      clicks: Number(analytics?.totals?.clicks) || 0,
      uniqueVisitors: Number(analytics?.totals?.uniqueVisitors) || 0,
    },
    byDevice,
    topPages,
    topClicks,
    daily,
    updatedAt: analytics?.updatedAt || null,
  };
}

function getAllowedOrigins(env) {
  if (!env.ALLOWED_ORIGINS) return [];
  return String(env.ALLOWED_ORIGINS)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function isOriginAllowed(request, env) {
  const allowed = getAllowedOrigins(env);
  if (!allowed.length) return true;
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return allowed.includes(origin);
}

function corsHeaders(request, env) {
  const allowed = getAllowedOrigins(env);
  const origin = request.headers.get('Origin');
  let allowOrigin = '*';
  if (allowed.length) {
    allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Vary': 'Origin',
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Invalid content payload' };
  }
  const topKeys = Object.keys(payload);
  if (!topKeys.length) return { ok: false, error: 'Content payload cannot be empty' };

  const queue = [{ value: payload, depth: 0 }];
  while (queue.length) {
    const { value, depth } = queue.pop();
    if (depth > MAX_DEPTH) return { ok: false, error: 'Content nesting too deep' };
    if (typeof value === 'string') {
      if (value.length > MAX_TEXT_CHARS) return { ok: false, error: 'Text field too long' };
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > MAX_ITEMS) return { ok: false, error: 'Too many items in a list' };
      value.forEach(item => queue.push({ value: item, depth: depth + 1 }));
      continue;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(v => queue.push({ value: v, depth: depth + 1 }));
      continue;
    }
    if (value !== null && typeof value !== 'number' && typeof value !== 'boolean') {
      return { ok: false, error: 'Unsupported value type in content' };
    }
  }
  return { ok: true };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
