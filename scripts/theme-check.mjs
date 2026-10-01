#!/usr/bin/env node
/**
 * Villa Coco theme check
 *   node scripts/theme-check.mjs [path/to/cms-shared.js]
 *
 * 1. Prints derived tokens + readability for all themes.
 * 2. Diffs the original themes against the legacy THEME_REGISTRY
 *    (expect zero diff once `pinned` maps are pasted in).
 * 3. Fuzz-tests: random overrides → fixRole() must always produce "Readable".
 * Exits 1 on any failure.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THEMES, ROLES, BASE_TOKENS, deriveTokens, checkTheme, fixRole, setOverride,
  selectTheme, normalizeHex, isSameState, normalizeState, toStyleTag,
} from '../theme-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const legacyPath = path.resolve(process.argv[2] || path.join(here, '..', 'cms-shared.js'));
let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

// ── 1. Overview ────────────────────────────────────────────────
console.log('\n=== THEMES ===');
for (const theme of THEMES) {
  const state = selectTheme(theme.id);
  const { tokens, isDark, pinnedUsed } = deriveTokens(state);
  const checks = checkTheme(state);
  console.log(`\n${theme.name} (${theme.id})${isDark ? ' [dark]' : ''}${theme.pinned ? ` [pinned: ${pinnedUsed.length}]` : ''}`);
  console.log('  ' + Object.entries(tokens).map(([k, v]) => `${k}=${v}`).join('  '));
  for (const role of ROLES) {
    const c = checks[role];
    const line = `${role.padEnd(8)} ${c.status.label.padEnd(16)} ${c.ratioText.padStart(7)}  (worst: ${c.worst})`;
    c.status.ok ? ok(line) : fail(line);
  }
}

// ── 2. Legacy diff ─────────────────────────────────────────────
console.log('\n=== LEGACY DIFF ===');
function loadLegacy(file) {
  if (!fs.existsSync(file)) return null;
  const code = fs.readFileSync(file, 'utf8');
  const noop = () => {};
  const fakeEl = { style: { setProperty: noop }, setAttribute: noop, classList: { add: noop, remove: noop } };
  const sandbox = {
    console: { log: noop, warn: noop, error: noop },
    document: { documentElement: fakeEl, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    fetch: () => Promise.reject(new Error('no fetch in check')),
    setTimeout, clearTimeout,
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  try { vm.runInNewContext(code, sandbox, { filename: file, timeout: 2000 }); }
  catch (e) { console.log(`  ! Could not execute ${file}: ${e.message}`); return null; }
  const candidates = [sandbox.VillaCocoCMS?.THEME_REGISTRY, sandbox.THEME_REGISTRY];
  for (const v of Object.values(sandbox)) if (v && typeof v === 'object' && v.THEME_REGISTRY) candidates.push(v.THEME_REGISTRY);
  return candidates.find((c) => c && typeof c === 'object') || null;
}

/** Find the 11-token map inside a legacy theme entry, whatever its shape. */
function extractTokens(entry) {
  const seen = new Set();
  const visit = (obj) => {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return null;
    seen.add(obj);
    const keys = Object.keys(obj).map((k) => k.replace(/^--/, ''));
    if (keys.includes('ink') && keys.includes('gold')) {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k.replace(/^--/, '')] = v;
      return out;
    }
    for (const v of Object.values(obj)) { const r = visit(v); if (r) return r; }
    return null;
  };
  return visit(entry);
}

const registry = loadLegacy(legacyPath);
if (!registry) {
  console.log(`  ! No THEME_REGISTRY found via ${legacyPath}. Skipping diff.`);
  console.log('    (Expose it on window.VillaCocoCMS.THEME_REGISTRY or pass the right path.)');
} else {
  const list = Array.isArray(registry) ? registry : Object.entries(registry).map(([id, v]) => ({ id, ...v }));
  for (const legacy of list) {
    const id = legacy.id;
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) { fail(`Legacy theme "${id}" missing from engine THEMES`); continue; }
    if (!theme.pinned) { fail(`${id}: pinned map not pasted yet`); continue; }
    const legacyTokens = extractTokens(legacy);
    if (!legacyTokens) { fail(`${id}: could not find token map in legacy entry`); continue; }
    const { tokens } = deriveTokens(selectTheme(id));
    const diffs = BASE_TOKENS.filter((k) => legacyTokens[k] && normalizeHex(legacyTokens[k]) !== tokens[k])
      .map((k) => `${k}: legacy ${normalizeHex(legacyTokens[k])} vs engine ${tokens[k]}`);
    diffs.length ? fail(`${id}: ${diffs.length} diff(s)\n      ` + diffs.join('\n      ')) : ok(`${id}: identical`);
  }
}

// ── 3. Fuzz ────────────────────────────────────────────────────
console.log('\n=== FUZZ (fixRole always yields Readable) ===');
let seed = 1337;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const randHex = () => '#' + Array.from({ length: 3 }, () => Math.floor(rand() * 256).toString(16).padStart(2, '0')).join('').toUpperCase();
let runs = 0, fixed = 0, unfixable = [];
for (const theme of THEMES) {
  for (let i = 0; i < 150; i++) {
    let state = selectTheme(theme.id);
    const role = ROLES[Math.floor(rand() * 4)];
    state = setOverride(state, role, randHex());
    runs++;
    for (let pass = 0; pass < 3; pass++) {
      const checks = checkTheme(state);
      const bad = ROLES.filter((r) => !checks[r].status.ok);
      if (!bad.length) break;
      for (const r of bad) state = fixRole(state, r);
    }
    if (checkTheme(state).allReadable) fixed++;
    else unfixable.push({ theme: theme.id, state: normalizeState(state) });
  }
}
unfixable.length
  ? fail(`${unfixable.length}/${runs} random states not fixable, e.g. ${JSON.stringify(unfixable[0])}`)
  : ok(`${fixed}/${runs} random states end Readable after fixRole()`);

// ── 4. Sanity ──────────────────────────────────────────────────
console.log('\n=== SANITY ===');
const n = normalizeState({ base: 'nope', overrides: { accent: 'red', ink: 'abc', zzz: '#123456' } });
n.base === 'villa-coco-classic' && n.overrides.ink === '#AABBCC' && !n.overrides.accent && !n.overrides.zzz
  ? ok('normalizeState rejects junk, expands #abc') : fail('normalizeState: ' + JSON.stringify(n));
const s1 = setOverride(selectTheme('coiba'), 'accent', THEMES.find((t) => t.id === 'coiba').seeds.accent);
Object.keys(s1.overrides).length === 0 ? ok('choosing the original seed clears the override') : fail('original seed should clear override');
isSameState({ base: 'coiba' }, { base: 'coiba', overrides: {} }) ? ok('isSameState') : fail('isSameState');
toStyleTag(selectTheme('nightswim')).includes('color-scheme:dark') ? ok('toStyleTag marks dark themes') : fail('toStyleTag dark');

console.log(failures ? `\n${failures} problem(s).` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
