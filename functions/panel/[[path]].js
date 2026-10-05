/**
 * Serve the content panel at /panel, /panel/, and /panel/*.
 * More specific than functions/[[path]].js so ASSETS.fetch("/panel")
 * never falls through to the root index.html SPA fallback.
 */

import { isInterimHost } from '../lib/site-url.js';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const pathname = new URL(request.url).pathname;

  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Static assets under /panel/ (ES modules, CSS, images) must not be rewritten
  // to index.html — otherwise import('./theme-editor.js') receives HTML.
  if (/\.[a-zA-Z0-9]+$/.test(pathname) && !pathname.endsWith('.html')) {
    return env.ASSETS.fetch(request);
  }

  const origin = new URL(request.url).origin;
  const panelRequest = new Request(`${origin}/panel/index.html`, {
    method: method === 'HEAD' ? 'HEAD' : 'GET',
    headers: request.headers,
  });

  const asset = await env.ASSETS.fetch(panelRequest);
  if (!asset.ok) return asset;

  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');

  const host = new URL(request.url).hostname;
  if (isInterimHost(host)) {
    headers.set('X-Robots-Tag', 'noindex');
  }

  if (method === 'HEAD') {
    return new Response(null, { status: asset.status, headers });
  }

  return new Response(asset.body, { status: asset.status, headers });
}
