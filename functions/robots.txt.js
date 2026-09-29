import { publicSiteUrl } from './lib/site-url.js';

export async function onRequest(context) {
  const base = publicSiteUrl(context.env, context.request);
  const body = `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
