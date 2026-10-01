/**
 * Villa Coco — theme storage for Cloudflare Pages Functions
 * ---------------------------------------------------------------
 * KV keys (seeds only, never derived values):
 *   theme:draft      { base, overrides }
 *   theme:published  { base, overrides }
 *   theme:history    [{ base, overrides, name, publishedAt }]  newest first, max 10
 *
 * INTEGRATION (functions/api/cms.js), before existing logic:
 *
 *   import { handleThemeRequest } from '../_lib/theme-store.js';
 *   const themeRes = await handleThemeRequest(request, {
 *     kv: env.<KV_BINDING>,
 *     isAuthorized: (req) => <existing X-Admin-Password check>,
 *   });
 *   if (themeRes) return themeRes;
 *
 * INTEGRATION (functions/[[path]].js), for the homepage HTML:
 *
 *   import { getPublishedForRender, injectThemeIntoHtml } from './_lib/theme-store.js';
 *   const state = await getPublishedForRender(env.<KV_BINDING>);
 *   html = injectThemeIntoHtml(html, state);
 */
import { normalizeState, pushHistory, toStyleTag, DEFAULT_THEME_ID } from '../../theme-engine.js';

export const KEYS = {
  draft: 'theme:draft',
  published: 'theme:published',
  history: 'theme:history',
  legacy: 'cms_current', // settings.activeThemeId lives here today
};

const HISTORY_MAX = 10;
const MAX_BODY_BYTES = 4096;

async function readJson(kv, key, opts) {
  try {
    const raw = await kv.get(key, opts);
    if (raw == null) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

const writeJson = (kv, key, value) => kv.put(key, JSON.stringify(value));

/** Legacy fallback: the theme id stored in cms_current.settings.activeThemeId. */
async function readLegacyThemeId(kv) {
  const cms = await readJson(kv, KEYS.legacy);
  const id = cms?.settings?.activeThemeId;
  return typeof id === 'string' ? id : null;
}

/**
 * Published state, migrating from the legacy field on first read.
 * Migration writes theme:published so it only happens once.
 */
export async function getPublished(kv) {
  const stored = await readJson(kv, KEYS.published);
  if (stored) return normalizeState(stored);
  const legacyId = await readLegacyThemeId(kv);
  const migrated = normalizeState({ base: legacyId || DEFAULT_THEME_ID, overrides: {} });
  await writeJson(kv, KEYS.published, migrated);
  return migrated;
}

/**
 * Read path for page rendering. Uses KV edge cache (60s, the KV minimum),
 * never writes. Falls back to the legacy field, then the default theme.
 */
export async function getPublishedForRender(kv) {
  if (!kv) return normalizeState(null);
  const stored = await readJson(kv, KEYS.published, { type: 'text', cacheTtl: 60 });
  if (stored) return normalizeState(stored);
  const legacyId = await readLegacyThemeId(kv);
  return normalizeState({ base: legacyId || DEFAULT_THEME_ID });
}

export async function loadAll(kv) {
  const published = await getPublished(kv);
  const draft = normalizeState((await readJson(kv, KEYS.draft)) ?? published);
  const history = await readJson(kv, KEYS.history);
  return { draft, published, history: Array.isArray(history) ? history.slice(0, HISTORY_MAX) : [] };
}

export async function saveDraft(kv, state) {
  const draft = normalizeState(state);
  await writeJson(kv, KEYS.draft, draft);
  return draft;
}

export async function publish(kv, state) {
  const published = normalizeState(state);
  const prev = await readJson(kv, KEYS.history);
  const history = pushHistory(Array.isArray(prev) ? prev : [], published, HISTORY_MAX);
  await writeJson(kv, KEYS.published, published);
  await writeJson(kv, KEYS.draft, published);
  await writeJson(kv, KEYS.history, history);
  return { published, history };
}

// ─── HTML injection ─────────────────────────────────────────────

const STYLE_RE = /<style id="vc-theme">[\s\S]*?<\/style>/;

/**
 * Put the theme <style id="vc-theme"> into the page.
 * Replaces an existing block, else inserts right before </head> so it
 * wins over the hardcoded :root defaults earlier in <head>.
 */
export function injectThemeIntoHtml(html, state) {
  const tag = toStyleTag(state);
  if (STYLE_RE.test(html)) return html.replace(STYLE_RE, tag);
  const i = html.search(/<\/head>/i);
  return i === -1 ? tag + html : html.slice(0, i) + tag + html.slice(i);
}

// ─── Request handler ────────────────────────────────────────────

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error('Body too large');
  const body = JSON.parse(text || '{}');
  if (!body || typeof body !== 'object' || !body.state || typeof body.state !== 'object') {
    throw new Error('Expected { state: { base, overrides } }');
  }
  return body.state;
}

/**
 * Handles ?action=theme | theme-draft | theme-publish.
 * Returns a Response, or null when the request isn't a theme action.
 * ALL theme actions require auth (draft and history are not public).
 */
export async function handleThemeRequest(request, { kv, isAuthorized }) {
  const action = new URL(request.url).searchParams.get('action');
  if (!action || !action.startsWith('theme')) return null;
  if (!kv) return json({ error: 'Theme storage is not configured' }, 500);
  if (!(await isAuthorized(request))) return json({ error: 'Unauthorized' }, 401);

  try {
    if (action === 'theme' && request.method === 'GET') {
      return json(await loadAll(kv));
    }
    if (action === 'theme-draft' && request.method === 'POST') {
      return json({ draft: await saveDraft(kv, await readBody(request)) });
    }
    if (action === 'theme-publish' && request.method === 'POST') {
      return json(await publish(kv, await readBody(request)));
    }
    return json({ error: `Unknown theme action or method: ${request.method} ${action}` }, 400);
  } catch (e) {
    const bad = e instanceof SyntaxError || /^(Body too large|Expected)/.test(e.message);
    return json({ error: bad ? e.message : 'Theme request failed' }, bad ? 400 : 500);
  }
}
