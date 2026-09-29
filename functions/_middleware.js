import { isInterimHost } from './lib/site-url.js';

/**
 * Adds X-Robots-Tag: noindex on interim hosts (pages.dev, zeli.lat).
 * Production villacocopanama.com is unaffected.
 */
export async function onRequest(context) {
  const response = await context.next();
  const host = new URL(context.request.url).hostname;
  if (!isInterimHost(host)) return response;

  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
