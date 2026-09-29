/**
 * Server-side HTML SEO injection for homepage.
 * Ensures crawlers/social scrapers see current SEO values from KV.
 * Canonical, og:url, and JSON-LD url use env.PUBLIC_SITE_URL.
 */

import { absolutePublicUrl, isInterimHost, publicSiteUrl } from './lib/site-url.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (url.pathname.startsWith('/api/')) {
    return env.ASSETS.fetch(request);
  }

  if (method !== 'GET') {
    return env.ASSETS.fetch(request);
  }

  if (url.pathname !== '/') {
    return env.ASSETS.fetch(request);
  }

  const assetResponse = await env.ASSETS.fetch(request);
  if (!assetResponse.ok) return assetResponse;

  let html = await assetResponse.text();
  const siteUrl = publicSiteUrl(env, request);

  try {
    if (env.VILLA_COCO_CMS) {
      const raw = await env.VILLA_COCO_CMS.get('cms_current');
      if (raw) {
        const cms = JSON.parse(raw);
        html = injectSeo(html, cms?.seo || {}, siteUrl);
      } else {
        html = injectSiteUrls(html, siteUrl);
      }
    } else {
      html = injectSiteUrls(html, siteUrl);
    }
  } catch (_) {
    html = injectSiteUrls(html, siteUrl);
  }

  const headers = new Headers(assetResponse.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  if (isInterimHost(url.hostname)) {
    headers.set('X-Robots-Tag', 'noindex');
  }

  return new Response(html, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

function injectSeo(html, seo, siteUrl) {
  const title = asString(seo.title);
  const description = asString(seo.description);
  const keywords = asString(seo.keywords);
  const ogImage = absolutePublicUrl(siteUrl, asString(seo.ogImage));
  const canonicalUrl = `${siteUrl}/`;

  if (title) {
    html = html.replace(
      /<title id="meta-title">[^<]*<\/title>/,
      `<title id="meta-title">${escapeHtml(title)}</title>`
    );
    html = html.replace(
      /(<meta property="og:title" id="og-title" content=")[^"]*("\s*\/?>)/,
      `$1${escapeAttr(title)}$2`
    );
    html = html.replace(
      /(<meta name="twitter:title" id="tw-title" content=")[^"]*("\s*\/?>)/,
      `$1${escapeAttr(title)}$2`
    );
  }

  if (description) {
    html = html.replace(
      /(<meta name="description" id="meta-description" content=")[^"]*("\s*\/?>)/,
      `$1${escapeAttr(description)}$2`
    );
    html = html.replace(
      /(<meta property="og:description" id="og-description" content=")[^"]*("\s*\/?>)/,
      `$1${escapeAttr(description)}$2`
    );
    html = html.replace(
      /(<meta name="twitter:description" id="tw-description" content=")[^"]*("\s*\/?>)/,
      `$1${escapeAttr(description)}$2`
    );
  }

  if (keywords) {
    html = html.replace(
      /(<meta name="keywords" id="meta-keywords" content=")[^"]*("\s*\/?>)/,
      `$1${escapeAttr(keywords)}$2`
    );
  }

  if (ogImage) {
    html = html.replace(
      /(<meta property="og:image" id="og-image" content=")[^"]*("\s*\/?>)/,
      `$1${escapeAttr(ogImage)}$2`
    );
    html = html.replace(
      /(<meta name="twitter:image" id="tw-image" content=")[^"]*("\s*\/?>)/,
      `$1${escapeAttr(ogImage)}$2`
    );
  }

  html = injectSiteUrls(html, siteUrl);
  return html;
}

function injectSiteUrls(html, siteUrl) {
  const canonicalUrl = `${siteUrl}/`;
  html = html.replace(
    /(<link rel="canonical" href=")[^"]*("\s*\/?>)/,
    `$1${escapeAttr(canonicalUrl)}$2`
  );
  html = html.replace(
    /(<meta property="og:url" content=")[^"]*("\s*\/?>)/,
    `$1${escapeAttr(canonicalUrl)}$2`
  );
  html = html.replace(
    /(<script type="application\/ld\+json" id="schema-org">[\s\S]*?"url"\s*:\s*")[^"]*(")/,
    `$1${escapeAttr(siteUrl)}$2`
  );
  return html;
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
