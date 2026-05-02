#!/usr/bin/env node
/**
 * Keeply Static JS URL Fingerprinting (spec 15)
 *
 * For every fingerprintable JS file:
 *   1. Compute SHA-256 of file content, take first 10 hex chars.
 *   2. Write a sibling copy named `<base>.<hash>.js` (originals kept).
 *   3. Record original → hashed mapping in `fingerprint-manifest.json`.
 *
 * For `i18n-loader.js` the manifest is embedded into the file at build time
 * (token replacement) before its own hash is computed, so the runtime
 * loader knows hashed pack URLs without an extra round-trip.
 *
 * Finally, walk every built HTML file and rewrite `<script src="...">`
 * references to point at the hashed filenames. SRI integrity is patched
 * separately by `build:sri` (which runs AFTER this step).
 *
 * Run order: must run AFTER `build:pages` (which regenerates i18n/*.js
 * from the .json source of truth) and BEFORE `build:sri` (which hashes
 * the actual file the browser will fetch).
 *
 * Spec: idea/15.static-js-url-fingerprinting-spec.md
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Locale packs loaded dynamically by i18n-loader at runtime.
const LOCALES = [
  'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
  'de', 'fr', 'es', 'pt', 'it',
  'nl', 'pl', 'cs', 'hu', 'tr',
  'fi', 'sv', 'no', 'da'
];

// Loader runtime-fetches both the locale pack and i18n.js, so i18n.js must
// be hashed BEFORE the loader (its hashed name goes into the embedded
// manifest). Other standalones are hashed afterwards — they're referenced
// statically from HTML, never from the loader.
const LOADER_RUNTIME_DEPS = ['i18n.js'];
const STANDALONE_SCRIPTS = [
  'components.js',
  'consent-api.js',
  'cookie-banner.js',
  'ga4-loader.js',
  'clarity-loader.js',
  'team-notify.js',
  'paddle-checkout.js',
  'activate-license.js'
];

const LOADER_FILE = 'i18n-loader.js';
const LOADER_TOKEN = '/*__FINGERPRINT_MANIFEST__*/{}';

const MANIFEST_PATH = path.join(ROOT, 'fingerprint-manifest.json');

// 10 hex chars = 40 bits. Across ~28 files collision probability is
// ~10^-12, well below operational risk threshold.
const HASH_HEX_LEN = 10;

function shortHash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_HEX_LEN);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Compute a hashed sibling path for an original relative path.
// "i18n-loader.js" → "i18n-loader.<hash>.js"
// "i18n/en.js"     → "i18n/en.<hash>.js"
function hashedRelPath(relPath, hash) {
  const dir = path.dirname(relPath);
  const ext = path.extname(relPath);
  const base = path.basename(relPath, ext);
  const hashedName = `${base}.${hash}${ext}`;
  return dir === '.' ? hashedName : path.posix.join(dir.split(path.sep).join('/'), hashedName);
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath));
}

function writeFile(relPath, buf) {
  fs.writeFileSync(path.join(ROOT, relPath), buf);
}

// ─── Step 1: hash locale packs + loader runtime deps ─────────────────────
console.log('=== build:fingerprint ===');
const manifest = {};
for (const loc of LOCALES) {
  const rel = `i18n/${loc}.js`;
  const buf = readFile(rel);
  const hashed = hashedRelPath(rel, shortHash(buf));
  writeFile(hashed, buf);
  manifest[rel] = hashed;
}
for (const rel of LOADER_RUNTIME_DEPS) {
  const buf = readFile(rel);
  const hashed = hashedRelPath(rel, shortHash(buf));
  writeFile(hashed, buf);
  manifest[rel] = hashed;
}
console.log(`[fingerprint] hashed ${LOCALES.length} locale packs + ${LOADER_RUNTIME_DEPS.length} loader runtime dep(s)`);

// ─── Step 2: patch i18n-loader.js with manifest, then hash ───────────────
const loaderSrc = fs.readFileSync(path.join(ROOT, LOADER_FILE), 'utf8');
if (loaderSrc.indexOf(LOADER_TOKEN) === -1) {
  console.error(`[fingerprint] ERROR: token "${LOADER_TOKEN}" not found in ${LOADER_FILE}`);
  process.exit(1);
}
const loaderManifest = {};
for (const loc of LOCALES) {
  const key = `i18n/${loc}.js`;
  loaderManifest[key] = manifest[key];
}
for (const rel of LOADER_RUNTIME_DEPS) {
  loaderManifest[rel] = manifest[rel];
}
const patchedLoader = loaderSrc.replace(LOADER_TOKEN, JSON.stringify(loaderManifest));
const patchedLoaderBuf = Buffer.from(patchedLoader, 'utf8');
const loaderHashed = hashedRelPath(LOADER_FILE, shortHash(patchedLoaderBuf));
writeFile(loaderHashed, patchedLoaderBuf);
manifest[LOADER_FILE] = loaderHashed;
console.log(`[fingerprint] patched + hashed ${LOADER_FILE} → ${loaderHashed}`);

// ─── Step 3: hash standalone scripts ─────────────────────────────────────
for (const rel of STANDALONE_SCRIPTS) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.error(`[fingerprint] ERROR: missing source ${rel}`);
    process.exit(1);
  }
  const buf = readFile(rel);
  const hashed = hashedRelPath(rel, shortHash(buf));
  writeFile(hashed, buf);
  manifest[rel] = hashed;
}
console.log(`[fingerprint] hashed ${STANDALONE_SCRIPTS.length} standalone scripts`);

// ─── Step 4: cleanup stale hashed files ──────────────────────────────────
// A hashed JS file matches /\.[0-9a-f]{HASH_HEX_LEN}\.js$/. If it does not
// appear in the current manifest values, it is left over from a previous
// build and should be removed so the working tree matches the manifest.
const hashedFileRe = new RegExp(`\\.[0-9a-f]{${HASH_HEX_LEN}}\\.js$`);
const currentValues = new Set(Object.values(manifest));
const watchDirs = ['', 'i18n'];
let cleaned = 0;
for (const dir of watchDirs) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs)) {
    if (!hashedFileRe.test(name)) continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (currentValues.has(rel)) continue;
    fs.unlinkSync(path.join(abs, name));
    cleaned++;
  }
}
if (cleaned > 0) console.log(`[fingerprint] removed ${cleaned} stale hashed file(s)`);

// ─── Step 5: collision sanity check ──────────────────────────────────────
const seen = new Map();
for (const [orig, hashed] of Object.entries(manifest)) {
  const m = hashed.match(/\.([0-9a-f]+)\.js$/);
  if (!m) continue;
  const h = m[1];
  if (seen.has(h) && seen.get(h) !== orig) {
    console.error(`[fingerprint] ERROR: hash collision on ${h} between ${seen.get(h)} and ${orig}`);
    process.exit(1);
  }
  seen.set(h, orig);
}

// ─── Step 6: write manifest ──────────────────────────────────────────────
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[fingerprint] wrote fingerprint-manifest.json (${Object.keys(manifest).length} entries)`);

// ─── Step 7: rewrite <script src="…"> in every built HTML file ───────────
function listHtmlFiles(rootAbs) {
  const skipDirs = new Set(['_dev', '_archive', 'specs', 'idea', 'node_modules', '.git', '.github']);
  const out = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (skipDirs.has(name)) continue;
      const abs = path.join(dir, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) walk(abs);
      else if (stat.isFile() && name.endsWith('.html')) out.push(abs);
    }
  }
  walk(rootAbs);
  return out;
}

// Match each fingerprintable script tag, preserving the "../" or "/" prefix
// (so locale subdir pages keep their relative paths) and any extra attributes.
function applyRewrites(html) {
  for (const [orig, hashed] of Object.entries(manifest)) {
    const origPath = orig.split(path.sep).join('/');
    const re = new RegExp(
      '(<script\\s+src=")((?:\\.\\.\\/|\\/)?)' + escapeRegex(origPath) + '("[^>]*></script>)',
      'g'
    );
    html = html.replace(re, (_m, p1, p2, p3) => `${p1}${p2}${hashed}${p3}`);
  }
  return html;
}

const htmlFiles = listHtmlFiles(ROOT);
let patched = 0;
for (const file of htmlFiles) {
  const before = fs.readFileSync(file, 'utf8');
  const after = applyRewrites(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    patched++;
  }
}
console.log(`[fingerprint] rewrote script srcs in ${patched}/${htmlFiles.length} HTML files`);
