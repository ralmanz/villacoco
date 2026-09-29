/**
 * PUBLIC_SITE_URL is the single source of truth for the site's own origin.
 * Falls back to the request host when unset (local/preview without env).
 */

export function publicSiteUrl(env, request) {
  const configured =
    typeof env.PUBLIC_SITE_URL === 'string' ? env.PUBLIC_SITE_URL.trim().replace(/\/+$/, '') : '';
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function isInterimHost(hostname) {
  if (!hostname) return false;
  if (hostname === 'villacoco.zeli.lat') return true;
  if (hostname === 'villacoco.pages.dev') return true;
  if (hostname.endsWith('.villacoco.pages.dev')) return true;
  return false;
}

/** Turn a CMS path or absolute URL into an absolute URL on the public site. */
export function absolutePublicUrl(base, value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${base}${raw}`;
  return raw;
}

/** Strip known site origins so CMS stores relative paths where possible. */
export function toRelativeSitePath(value, origins) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.startsWith('/')) return raw;
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    for (const origin of origins) {
      if (!origin) continue;
      if (raw.startsWith(origin + '/') || raw === origin) {
        return path.startsWith('/') ? path : `/${path}`;
      }
    }
  } catch (_) {
    return raw;
  }
  return raw;
}
