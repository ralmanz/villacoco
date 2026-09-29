#!/usr/bin/env node
/**
 * One-time: rewrite cms_current in KV so site-owned absolute URLs become paths.
 *
 * Usage (requires wrangler logged in and KV namespace ID):
 *   KV_ID=<namespace_id> node scripts/normalize-kv-urls.mjs
 *   KV_ID=<namespace_id> node scripts/normalize-kv-urls.mjs --write
 *
 * Without --write, prints a diff summary only (dry run).
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINS = [
  'https://villacoco.zeli.lat',
  'https://villacocopanama.com',
  'https://www.villacocopanama.com',
  'https://villacoco.pages.dev',
];

const KV_KEY = 'cms_current';
const write = process.argv.includes('--write');
const kvId = process.env.KV_ID;

if (!kvId) {
  console.error('Set KV_ID to your VILLA_COCO_CMS namespace id.');
  process.exit(1);
}

function toRelative(value) {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  if (!raw || raw.startsWith('/') || !/^https?:\/\//i.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    for (const origin of ORIGINS) {
      if (raw === origin || raw.startsWith(`${origin}/`)) {
        return path.startsWith('/') ? path : `/${path}`;
      }
    }
  } catch (_) {}
  return raw;
}

function walk(value) {
  if (typeof value === 'string') return toRelative(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v);
    return out;
  }
  return value;
}

function countChanges(before, after, path = '') {
  let n = 0;
  if (typeof before === 'string' && typeof after === 'string' && before !== after) {
    console.log(`  ${path}: ${before} → ${after}`);
    return 1;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    for (let i = 0; i < before.length; i++) {
      n += countChanges(before[i], after[i], `${path}[${i}]`);
    }
    return n;
  }
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    for (const key of Object.keys(before)) {
      n += countChanges(before[key], after[key], path ? `${path}.${key}` : key);
    }
  }
  return n;
}

const raw = execSync(`npx wrangler kv key get "${KV_KEY}" --namespace-id=${kvId}`, {
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'inherit'],
}).trim();

if (!raw) {
  console.log('No cms_current key in KV (nothing to do).');
  process.exit(0);
}

const before = JSON.parse(raw);
const after = walk(before);
const changes = countChanges(before, after);

if (!changes) {
  console.log('No site-owned absolute URLs found in cms_current.');
  process.exit(0);
}

console.log(`\n${changes} string(s) would be normalized.`);

if (!write) {
  console.log('\nDry run. Re-run with --write to save cms_backup + update cms_current.');
  process.exit(0);
}

const backupPath = join(tmpdir(), `villacoco-kv-backup-${Date.now()}.json`);
const currentPath = join(tmpdir(), `villacoco-kv-current-${Date.now()}.json`);
writeFileSync(backupPath, raw);
writeFileSync(currentPath, JSON.stringify(after));
try {
  execSync(`npx wrangler kv key put cms_backup --path="${backupPath}" --namespace-id=${kvId}`, {
    stdio: 'inherit',
  });
  execSync(`npx wrangler kv key put cms_current --path="${currentPath}" --namespace-id=${kvId}`, {
    stdio: 'inherit',
  });
} finally {
  try { unlinkSync(backupPath); } catch (_) {}
  try { unlinkSync(currentPath); } catch (_) {}
}
console.log('Done. cms_backup saved, cms_current updated.');
