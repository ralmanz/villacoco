/**
 * Villa Coco — theme engine
 * ---------------------------------------------------------------
 * One pure ES module shared by:
 *   - the public site (server-side injection in functions/[[path]].js)
 *   - the admin panel theme editor (live preview + checks)
 *   - scripts/theme-check.mjs (node)
 *
 * No DOM, no fetch, no dependencies. Works in Workers, browsers, Node.
 *
 * MODEL
 *   A theme is 4 seed colors ("roles"): ink, accent, deep, surface.
 *   A saved theme state is { base: themeId, overrides: { role: "#RRGGBB" } }.
 *   Only seeds are ever stored. All CSS tokens are derived at render time.
 *
 * PINNING (keeps the 4 original themes pixel-identical)
 *   Original themes carry `pinned`: their hand-tuned legacy token map.
 *   A pinned token is used as-is UNLESS one of the roles it depends on
 *   (TOKEN_DEPS) has been overridden — then it is re-derived.
 *   Helper tokens (muted, accent-text, on-*) are always computed from the
 *   FINAL base tokens, so they stay correct whether pinned or derived.
 */

// ─── Roles ──────────────────────────────────────────────────────

export const ROLES = ['ink', 'accent', 'deep', 'surface'];

export const ROLE_META = {
  ink:     { label: 'Text',          help: 'Headings, body copy and dark bands' },
  accent:  { label: 'Accent',        help: 'Buttons, highlights and small details' },
  deep:    { label: 'Feature color', help: 'Hero, header areas and links' },
  surface: { label: 'Background',    help: 'The page itself. Sets the overall mood.' },
};

export const GROUPS = [
  { id: 'light',  label: 'Light & breezy' },
  { id: 'earthy', label: 'Warm & earthy' },
  { id: 'dark',   label: 'Evening (dark)' },
];

export const DEFAULT_THEME_ID = 'villa-coco-classic';

// ─── Themes ─────────────────────────────────────────────────────
// INTEGRATION NOTE: for the 4 original themes, replace the seed values
// with the current live values from cms-shared.js THEME_REGISTRY and paste
// each theme's full 11-token map into `pinned` VERBATIM (keys without "--").
// Optionally add `muted: '#666666'` to each pinned map so legacy #666 copy
// stays identical. Leave `pinned: null` on the 6 new themes.

export const THEMES = [
  {
    id: 'villa-coco-classic', group: 'light', name: 'Villa Coco Classic', approved: true,
    description: 'The approved default: warm sand, gold accents, deep ocean teal.',
    seeds: { ink: '#1C1C1A', accent: '#B8965A', deep: '#1E3A3F', surface: '#FAF8F3' },
    pinned: {
      ink: '#1C1C1A', bark: '#2B2420', sand: '#F2EDE4', cream: '#FAF8F3', mist: '#E8E2D8',
      gold: '#B8965A', ocean: '#1E3A3F', foam: '#C8D8D4', palm: '#2D4A30', dusk: '#6B5C4E', wellness: '#3D5A47',
      muted: '#666666',
      'accent-text': '#B8965A', 'on-accent': '#1C1C1A', 'on-deep': '#F2EDE4', 'on-band': '#F2EDE4',
      'ink-band': '#1C1C1A', 'on-ink-band': '#F2EDE4',
    },
  },
  {
    id: 'ocean-coastal', group: 'light', name: 'Ocean Coastal',
    description: 'Cool Pacific blues, crisp sand, bright foam.',
    seeds: { ink: '#152428', accent: '#6A9AAA', deep: '#1A4A5C', surface: '#F4F9FA' },
    pinned: {
      ink: '#152428', bark: '#1A3238', sand: '#E8F0F2', cream: '#F4F9FA', mist: '#D4E4E8',
      gold: '#6A9AAA', ocean: '#1A4A5C', foam: '#A8CCD8', palm: '#2A5A48', dusk: '#5A7078', wellness: '#3A6878',
      muted: '#666666',
      'accent-text': '#6A9AAA', 'on-accent': '#152428', 'on-deep': '#E8F0F2', 'on-band': '#E8F0F2',
      'ink-band': '#152428', 'on-ink-band': '#E8F0F2',
    },
  },
  {
    id: 'coiba', group: 'light', name: 'Coiba Reef', isNew: true,
    description: 'Reef teal with a coral accent, like the water off Coiba.',
    seeds: { ink: '#0F2A2E', accent: '#E07A5F', deep: '#1F6F78', surface: '#F4F1EA' },
    pinned: null,
  },
  {
    id: 'mango', group: 'light', name: 'Mango Coast', isNew: true,
    description: 'Sunny amber on soft cream with a lagoon-green anchor.',
    seeds: { ink: '#2A2118', accent: '#E3A23B', deep: '#1E5A5A', surface: '#FFF8EC' },
    pinned: null,
  },
  {
    id: 'bougain', group: 'light', name: 'Bougainvillea', isNew: true,
    description: 'Garden magenta and palm green on a pale blush ground.',
    seeds: { ink: '#2B1B24', accent: '#B83A6E', deep: '#3E5C4A', surface: '#FBF6F2' },
    pinned: null,
  },
  {
    id: 'tropical-jungle', group: 'earthy', name: 'Tropical Jungle',
    description: 'Lush greens and palm shadows with golden light.',
    seeds: { ink: '#1A2418', accent: '#C4A050', deep: '#2A4840', surface: '#F6F8F0' },
    pinned: {
      ink: '#1A2418', bark: '#243020', sand: '#EEF2E4', cream: '#F6F8F0', mist: '#DCE6D0',
      gold: '#C4A050', ocean: '#2A4840', foam: '#B8D4B0', palm: '#3D6838', dusk: '#6A5840', wellness: '#4A7048',
      muted: '#666666',
      'accent-text': '#C4A050', 'on-accent': '#1A2418', 'on-deep': '#EEF2E4', 'on-band': '#EEF2E4',
      'ink-band': '#1A2418', 'on-ink-band': '#EEF2E4',
    },
  },
  {
    id: 'sunset-earth', group: 'earthy', name: 'Sunset Earth',
    description: 'Terracotta dusk tones, soft cream, amber gold.',
    seeds: { ink: '#2A2018', accent: '#C89050', deep: '#4A3830', surface: '#FAF6F0' },
    pinned: {
      ink: '#2A2018', bark: '#3A2A20', sand: '#F5ECE0', cream: '#FAF6F0', mist: '#E8DDD0',
      gold: '#C89050', ocean: '#4A3830', foam: '#D8C8B8', palm: '#4A5030', dusk: '#8A6848', wellness: '#6A5840',
      muted: '#666666',
      'accent-text': '#C89050', 'on-accent': '#2A2018', 'on-deep': '#F5ECE0', 'on-band': '#F5ECE0',
      'ink-band': '#2A2018', 'on-ink-band': '#F5ECE0',
    },
  },
  {
    id: 'driftwood', group: 'earthy', name: 'Driftwood', isNew: true,
    description: 'Sun-bleached neutrals. Quiet and minimal.',
    seeds: { ink: '#2E2A26', accent: '#9C8A72', deep: '#5E6B66', surface: '#F3EFE8' },
    pinned: null,
  },
  {
    id: 'blacksand', group: 'dark', name: 'Black Sand', isNew: true,
    description: 'Volcanic charcoal with brass details. Moody, editorial.',
    seeds: { ink: '#EDE8DF', accent: '#C9A66B', deep: '#2E2C29', surface: '#161514' },
    pinned: null,
  },
  {
    id: 'nightswim', group: 'dark', name: 'Night Swim', isNew: true,
    description: 'Deep night water, moonlit cream, warm gold.',
    seeds: { ink: '#E9E4DA', accent: '#D4B072', deep: '#2C4A52', surface: '#0E1A1F' },
    pinned: null,
  },
];

// Curated swatches per role. The theme's own original seed is always
// prepended by swatchOptions(), so these lists don't need to include it.
export const SWATCHES = {
  light: {
    ink:     ['#1C1C1A', '#14232B', '#1A2419', '#2A1F1A', '#2B1B24', '#22303A'],
    accent:  ['#B8965A', '#C8935A', '#E07A5F', '#5F8BA3', '#B83A6E', '#8A9A5B'],
    deep:    ['#1E3A3F', '#234B61', '#1F6F78', '#2F4A2E', '#5A3A2B', '#3E3A5C'],
    surface: ['#F2EDE4', '#F7F4EE', '#E8EEF2', '#EEF0E6', '#F4ECE2', '#FFF8EC'],
  },
  dark: {
    ink:     ['#E9E4DA', '#EDE8DF', '#F2EEE8', '#E4E9EC', '#EDE6D6', '#DCD6CA'],
    accent:  ['#D4B072', '#C9A66B', '#E0A06A', '#E08A70', '#7FA9BE', '#A9B77A'],
    deep:    ['#2C4A52', '#2E2C29', '#2F3F2E', '#4A3328', '#2B3550', '#3F2E3E'],
    surface: ['#0E1A1F', '#161514', '#1A1612', '#101A14', '#16121A', '#1C2226'],
  },
};

// ─── Token model ────────────────────────────────────────────────
// Base tokens = the 11 legacy CSS variables (can be pinned).
// Helper tokens = new variables, always computed from final base tokens
//   (muted can additionally be pinned for legacy #666 parity).

export const BASE_TOKENS = [
  'ink', 'bark', 'sand', 'cream', 'mist', 'gold', 'ocean', 'foam', 'palm', 'dusk', 'wellness',
];
export const HELPER_TOKENS = ['muted', 'accent-text', 'on-accent', 'on-deep', 'on-band', 'ink-band', 'on-ink-band'];

// Which seed roles each token depends on. A pinned token is dropped
// (re-derived) when ANY of its roles is overridden.
// INTEGRATION NOTE: adjust after auditing real usage of foam/palm/dusk/wellness.
export const TOKEN_DEPS = {
  ink:      ['ink'],
  bark:     ['ink', 'surface'],
  sand:     ['surface', 'ink'],
  cream:    ['surface'],
  mist:     ['ink', 'surface'],
  gold:     ['accent'],
  ocean:    ['deep'],
  foam:     ['deep', 'surface'],
  palm:     ['deep', 'ink'],
  dusk:     ['accent', 'ink'],
  wellness: ['deep', 'accent'],
  muted:    ['ink', 'surface'],
  // Helper tokens can also be pinned (legacy text colors on bands/buttons)
  'accent-text': ['accent', 'surface'],
  'on-accent':   ['accent'],
  'on-deep':     ['deep'],
  'on-band':     ['ink', 'surface'],
  'ink-band':    ['ink', 'surface'],
  'on-ink-band': ['ink', 'surface'],
};

// ─── Color utilities ────────────────────────────────────────────

const HEX_RE = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

/** Normalize "#abc" / "abc" / "#aabbcc" → "#AABBCC". Returns null if invalid. */
export function normalizeHex(input) {
  if (typeof input !== 'string') return null;
  const m = input.trim().match(HEX_RE);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return '#' + h.toUpperCase();
}

/** Strict check for user-typed values in the editor (full 6-digit only). */
export function isValidHex(input) {
  return typeof input === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.trim());
}

function toRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) throw new Error(`Invalid color: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function toHex(rgb) {
  return '#' + rgb
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Linear RGB-channel interpolation. t=0 → a, t=1 → b. */
export function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

/** WCAG 2.x relative luminance. */
export function luminance(hex) {
  const w = [0.2126, 0.7152, 0.0722];
  return toRgb(hex).reduce((sum, v, i) => {
    const c = v / 255;
    const lin = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return sum + lin * w[i];
  }, 0);
}

/** WCAG 2.x contrast ratio (1–21). */
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const LIGHT_TEXT = '#FFFFFF';
export const DARK_TEXT = '#161616';

/** Best text color (white or near-black) to put on `bg`. */
export function onColor(bg) {
  return contrast(bg, LIGHT_TEXT) >= contrast(bg, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/**
 * Move `color` toward `toward` in small steps until it reaches `target`
 * contrast against `against`. Returns { color, t } (t = amount moved, 0–1).
 */
export function pushToContrast(color, against, target, toward, step = 0.02) {
  for (let t = 0; t <= 1.0001; t += step) {
    const c = mix(color, toward, Math.min(t, 1));
    if (contrast(c, against) >= target) return { color: c, t };
  }
  return { color: toHex(toRgb(toward)), t: 1 };
}

/** Like pushToContrast, but must pass against EVERY color in `againstList`. */
export function pushToContrastAll(color, againstList, target, toward, step = 0.02) {
  for (let t = 0; t <= 1.0001; t += step) {
    const c = mix(color, toward, Math.min(t, 1));
    if (againstList.every((a) => contrast(c, a) >= target)) return c;
  }
  return toHex(toRgb(toward));
}

/** Smallest change to a background so white OR near-black text passes `target`. */
export function fixBackground(bg, target = 4.5) {
  const darker = pushToContrast(bg, LIGHT_TEXT, target, '#000000');
  const lighter = pushToContrast(bg, DARK_TEXT, target, '#FFFFFF');
  return darker.t <= lighter.t ? darker.color : lighter.color;
}

// ─── State helpers ──────────────────────────────────────────────

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES.find((t) => t.id === DEFAULT_THEME_ID);
}

export function themesByGroup() {
  return GROUPS.map((g) => ({ ...g, themes: THEMES.filter((t) => t.group === g.id) }));
}

/**
 * Sanitize anything read from KV or the network into a valid state.
 * Unknown base → default. Invalid / unknown-role / redundant overrides dropped.
 */
export function normalizeState(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const theme = getTheme(typeof raw.base === 'string' ? raw.base : DEFAULT_THEME_ID);
  const overrides = {};
  const src = raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {};
  for (const role of ROLES) {
    const hex = normalizeHex(src[role]);
    if (hex && hex !== normalizeHex(theme.seeds[role])) overrides[role] = hex;
  }
  return { base: theme.id, overrides };
}

export function defaultState() {
  return { base: DEFAULT_THEME_ID, overrides: {} };
}

export function isSameState(a, b) {
  const x = normalizeState(a), y = normalizeState(b);
  if (x.base !== y.base) return false;
  return ROLES.every((r) => (x.overrides[r] || null) === (y.overrides[r] || null));
}

export function isCustomized(state) {
  return Object.keys(normalizeState(state).overrides).length > 0;
}

/** Final 4 seed colors for a state. */
export function resolveSeeds(state) {
  const s = normalizeState(state);
  const theme = getTheme(s.base);
  const seeds = {};
  for (const role of ROLES) seeds[role] = s.overrides[role] || normalizeHex(theme.seeds[role]);
  return seeds;
}

/** Set (or clear) one role's override. Choosing the theme's own seed clears it. */
export function setOverride(state, role, hex) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
  const s = normalizeState(state);
  const value = normalizeHex(hex);
  if (!value) return s;
  return normalizeState({ base: s.base, overrides: { ...s.overrides, [role]: value } });
}

export function clearOverrides(state) {
  return { base: normalizeState(state).base, overrides: {} };
}

/** Picking a theme starts clean (overrides cleared). */
export function selectTheme(id) {
  return { base: getTheme(id).id, overrides: {} };
}

/** Display name, e.g. "Ocean Coastal (customized)". */
export function stateLabel(state) {
  const s = normalizeState(state);
  return getTheme(s.base).name + (isCustomized(s) ? ' (customized)' : '');
}

// ─── Derivation ─────────────────────────────────────────────────

/** Derive all base tokens from 4 seeds (no pinning). */
function deriveBase(seeds) {
  const { ink, accent, deep, surface } = seeds;
  const isDark = luminance(surface) < 0.2;

  return {
    isDark,
    tokens: {
      ink,
      gold: accent,
      ocean: deep,
      cream: surface,
      // Light section background (light themes) / raised panel (dark themes)
      sand: isDark ? mix(surface, '#FFFFFF', 0.06) : mix(surface, ink, 0.05),
      // Dark band: experiences, food, footer
      bark: isDark ? mix(surface, '#000000', 0.35) : mix(ink, accent, 0.06),
      mist: mix(ink, surface, 0.86),
      // Section accents — defaults; tune after usage audit
      foam: isDark ? mix(deep, surface, 0.55) : mix(deep, surface, 0.88),
      palm: isDark ? mix(deep, ink, 0.15) : mix(deep, ink, 0.25),
      dusk: isDark ? mix(accent, ink, 0.25) : mix(accent, ink, 0.45),
      wellness: mix(deep, accent, 0.35),
    },
  };
}

/**
 * Full token set for a state, with pinning applied.
 * Returns { tokens, seeds, isDark, theme, pinnedUsed: string[] }.
 */
export function deriveTokens(state) {
  const s = normalizeState(state);
  const theme = getTheme(s.base);
  const seeds = resolveSeeds(s);
  const overridden = new Set(Object.keys(s.overrides));
  const { tokens: derived, isDark } = deriveBase(seeds);

  const pinned = theme.pinned || {};
  const pinnedUsed = [];
  const keep = (key) => {
    const p = normalizeHex(pinned[key]);
    if (!p) return false;
    const deps = TOKEN_DEPS[key] || [];
    return !deps.some((r) => overridden.has(r));
  };

  const tokens = {};
  for (const key of BASE_TOKENS) {
    if (keep(key)) { tokens[key] = normalizeHex(pinned[key]); pinnedUsed.push(key); }
    else tokens[key] = derived[key];
  }

  // Helpers from FINAL tokens
  const surfaceFinal = tokens.cream;
  const dark = luminance(surfaceFinal) < 0.2;

  if (keep('muted')) { tokens.muted = normalizeHex(pinned.muted); pinnedUsed.push('muted'); }
  else {
    let muted = mix(tokens.ink, surfaceFinal, 0.32);
    if (contrast(muted, surfaceFinal) < 4.5) {
      muted = pushToContrast(muted, surfaceFinal, 4.5, dark ? '#FFFFFF' : '#000000').color;
    }
    tokens.muted = muted;
  }

  const away = dark ? '#FFFFFF' : '#000000';

  // --dusk is used as secondary TEXT on cream and sand: keep it readable when derived.
  if (!pinnedUsed.includes('dusk')) {
    tokens.dusk = pushToContrastAll(tokens.dusk, [surfaceFinal, tokens.sand], 4.5, away);
  }

  // A helper is pinned (legacy value) unless a role it depends on was overridden.
  const helper = (key, compute) => {
    if (keep(key)) { tokens[key] = normalizeHex(pinned[key]); pinnedUsed.push(key); }
    else tokens[key] = compute();
  };
  helper('accent-text', () => pushToContrast(tokens.gold, surfaceFinal, 4.5, away).color);
  helper('on-accent', () => onColor(tokens.gold));
  helper('on-deep', () => onColor(tokens.ocean));
  helper('on-band', () => onColor(tokens.bark));
  // Band that used --ink as its background on light themes (e.g. testimonials).
  // On dark themes --ink is light text, so fall back to the dark band.
  helper('ink-band', () => (dark ? tokens.bark : tokens.ink));
  helper('on-ink-band', () => onColor(tokens['ink-band']));

  return { tokens, seeds, isDark: dark, theme, pinnedUsed };
}

// ─── CSS output ─────────────────────────────────────────────────

/** ":root{--ink:#…;…}" — names match the existing site variables. */
export function toCssVars(tokens, selector = ':root') {
  const order = [...BASE_TOKENS, ...HELPER_TOKENS];
  const body = order
    .filter((k) => tokens[k])
    .map((k) => `--${k}:${tokens[k]}`)
    .join(';');
  return `${selector}{${body}}`;
}

/** Ready-to-inject <style> tag for server-side rendering. */
export function toStyleTag(state, id = 'vc-theme') {
  const { tokens, isDark } = deriveTokens(state);
  const css = toCssVars(tokens) + `:root{color-scheme:${isDark ? 'dark' : 'light'}}`;
  return `<style id="${id}">${css}</style>`;
}

/** Apply tokens to an element's inline style (browser fallback / preview). */
export function applyTokens(el, tokens) {
  for (const [k, v] of Object.entries(tokens)) el.style.setProperty(`--${k}`, v);
}

// ─── Readability checks ─────────────────────────────────────────

export const STATUS = {
  pass:  { id: 'pass',  label: 'Readable',        ok: true },
  large: { id: 'large', label: 'Large text only', ok: false },
  fail:  { id: 'fail',  label: 'Hard to read',    ok: false },
};

function statusFor(ratio) {
  if (ratio >= 4.5) return STATUS.pass;
  if (ratio >= 3) return STATUS.large;
  return STATUS.fail;
}

const ROLE_PAIRS = {
  ink: (t) => [
    { what: 'Body text on the page', ratio: contrast(t.ink, t.cream) },
    { what: 'Text on dark bands', ratio: contrast(t['on-band'], t.bark) },
  ],
  accent: (t) => [
    { what: 'Button labels', ratio: contrast(t.gold, t['on-accent']) },
  ],
  deep: (t) => [
    { what: 'Headline text on the hero', ratio: contrast(t.ocean, t['on-deep']) },
  ],
  surface: (t) => [
    { what: 'Secondary text', ratio: contrast(t.muted, t.cream) },
    { what: 'Text on light sections', ratio: contrast(t.ink, t.sand) },
  ],
};

const FAIL_MESSAGES = {
  ink: 'Text will be hard to read with this color.',
  accent: 'Button labels on this color will be hard to read.',
  deep: 'Hero headline text on this color will be hard to read.',
  surface: 'Some text will be hard to read on this background.',
};

/**
 * Per-role readability. Each role reports its WORST pair.
 * → { ink: { ratio, ratioText, status, worst, message }, … , allReadable }
 */
export function checkTheme(state) {
  const { tokens } = deriveTokens(state);
  const out = {};
  for (const role of ROLES) {
    const pairs = ROLE_PAIRS[role](tokens);
    const worst = pairs.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    const status = statusFor(worst.ratio);
    out[role] = {
      ratio: worst.ratio,
      ratioText: worst.ratio.toFixed(1) + ':1',
      status,
      worst: worst.what,
      message: status.ok ? '' : FAIL_MESSAGES[role],
    };
  }
  out.allReadable = ROLES.every((r) => out[r].status.ok);
  return out;
}

/** True when small accent-colored labels are auto-deepened. */
export function accentIsAdjusted(state) {
  const { tokens } = deriveTokens(state);
  return tokens['accent-text'] !== tokens.gold;
}

// ─── Fixes ──────────────────────────────────────────────────────

/** Return a new state where `role` passes its readability check. */
export function fixRole(state, role) {
  const s = normalizeState(state);
  const seeds = resolveSeeds(s);
  const { isDark } = deriveTokens(s);
  const away = isDark ? '#FFFFFF' : '#000000';
  let next = s;

  if (role === 'ink') {
    // Push ink away from the surface until both body text and band text pass.
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const candidate = setOverride(s, 'ink', mix(seeds.ink, away, Math.min(t, 1)));
      if (checkTheme(candidate).ink.status.ok) { next = candidate; break; }
      next = candidate;
    }
  } else if (role === 'accent') {
    next = setOverride(s, 'accent', fixBackground(seeds.accent));
  } else if (role === 'deep') {
    next = setOverride(s, 'deep', fixBackground(seeds.deep));
  } else if (role === 'surface') {
    const toward = isDark ? '#000000' : '#FFFFFF';
    let solved = false;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const candidate = setOverride(s, 'surface', mix(seeds.surface, toward, Math.min(t, 1)));
      if (checkTheme(candidate).surface.status.ok) { next = candidate; solved = true; break; }
    }
    if (!solved) {
      // Background alone can't get there (mid-tone text color). Keep the
      // background as she chose it and deepen the text color instead.
      for (let t = 0; t <= 1.0001; t += 0.02) {
        const candidate = setOverride(s, 'ink', mix(seeds.ink, away, Math.min(t, 1)));
        next = candidate;
        if (checkTheme(candidate).surface.status.ok) break;
      }
    }
  } else {
    throw new Error(`Unknown role: ${role}`);
  }
  return next;
}

// ─── Editor helpers ─────────────────────────────────────────────

/**
 * Swatch options for a role: the theme's original seed first, then curated
 * picks for light/dark themes, deduped, max `limit`.
 * → [{ hex, isOriginal, selected }]
 */
export function swatchOptions(state, role, limit = 7) {
  const s = normalizeState(state);
  const theme = getTheme(s.base);
  const original = normalizeHex(theme.seeds[role]);
  const current = resolveSeeds(s)[role];
  const isDarkTheme = luminance(normalizeHex(theme.seeds.surface)) < 0.2;
  const list = [original, ...SWATCHES[isDarkTheme ? 'dark' : 'light'][role].map(normalizeHex)];
  const seen = new Set();
  const out = [];
  for (const hex of list) {
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    out.push({ hex, isOriginal: hex === original, selected: hex === current });
    if (out.length >= limit) break;
  }
  return out;
}

/** History entry builder (store in theme:history, newest first). */
export function historyEntry(state, publishedAt = new Date().toISOString()) {
  const s = normalizeState(state);
  return { base: s.base, overrides: s.overrides, name: stateLabel(s), publishedAt };
}

export function pushHistory(history, state, max = 10) {
  const list = Array.isArray(history) ? history : [];
  return [historyEntry(state), ...list].slice(0, max);
}
