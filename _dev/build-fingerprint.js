#!/usr/bin/env node
/**
 * Keeply Static JS URL Fingerprinting (spec 15 + spec 36)
 *
 * Spec 36 source layout:
 *   - Root-level JS sources live in `_dev/src/` (10 hand-written files).
 *   - Locale pack source is `i18n/*.json` (19 files); pack `.js` content is
 *     synthesized in memory each build, never written as an unhashed
 *     intermediate.
 *   - Deploy output: hashed `<base>.<hash>.js` files emitted at the same
 *     logical path the browser fetches (root or `i18n/`).
 *
 * For every fingerprintable JS:
 *   1. Compute SHA-256 of file content, take first 10 hex chars.
 *   2. Write `<base>.<hash>.js` at the deploy path.
 *   3. Record logical → hashed mapping in `fingerprint-manifest.json`.
 *
 * For `i18n-loader.js` the manifest is embedded into the loader source at
 * build time (token replacement) before the loader's own hash is computed,
 * so the runtime loader knows hashed pack URLs without a manifest fetch.
 *
 * Run order: AFTER `build:pages` (HTML must exist for rewrite step) and
 * BEFORE `build:sri` (which hashes the actual file the browser fetches).
 *
 * Spec: specs/website/036-spec-15-source-separation/spec-lite.md
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(__dirname, 'src');     // _dev/src/
const I18N_DIR = path.join(ROOT, 'i18n');         // deploy path for locale packs
const MANIFEST_PATH = path.join(ROOT, 'fingerprint-manifest.json');

// Locale packs loaded dynamically by i18n-loader at runtime.
const LOCALES = [
  'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
  'de', 'fr', 'es', 'pt', 'it',
  'nl', 'pl', 'cs', 'hu', 'tr',
  'fi', 'sv', 'no', 'da'
];

// Loader runtime-fetches the engine, so its hashed name must be in the
// embedded manifest. Other standalones are referenced statically from HTML.
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

// 10 hex chars = 40 bits. Across ~29 files collision probability ~10^-12.
const HASH_HEX_LEN = 10;

function shortHash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_HEX_LEN);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Derive hashed sibling path given a logical deploy path + hash.
// "i18n-loader.js" → "i18n-loader.<hash>.js"
// "i18n/en.js"     → "i18n/en.<hash>.js"
function hashedRelPath(relPath, hash) {
  const dir = path.dirname(relPath);
  const ext = path.extname(relPath);
  const base = path.basename(relPath, ext);
  const hashedName = `${base}.${hash}${ext}`;
  return dir === '.' ? hashedName : path.posix.join(dir.split(path.sep).join('/'), hashedName);
}

// Read a source JS file from _dev/src/.
function readSrc(name) {
  return fs.readFileSync(path.join(SRC_DIR, name));
}

// Read a locale's JSON, synthesize the `.js` pack content (matches the format
// `_dev/build.js` previously produced when it wrote `i18n/<locale>.js`).
// Returns a UTF-8 Buffer ready to hash and write.
function synthesizeLocalePack(locale) {
  const jsonPath = path.join(I18N_DIR, `${locale}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.error(`[fingerprint] ERROR: missing translation source ${jsonPath}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const content =
    'window.__i18n = window.__i18n || {};\n' +
    `window.__i18n["${locale}"] = ${JSON.stringify(data, null, 2)};\n`;
  return Buffer.from(content, 'utf8');
}

// Write a deploy-path file (root or i18n/), ensuring parent dir exists.
function writeDeploy(relPath, buf) {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
}

// ─── Step 1: synthesize + hash locale packs ──────────────────────────────
console.log('=== build:fingerprint ===');
const manifest = {};
for (const loc of LOCALES) {
  const rel = `i18n/${loc}.js`;
  const buf = synthesizeLocalePack(loc);
  const hashed = hashedRelPath(rel, shortHash(buf));
  writeDeploy(hashed, buf);
  manifest[rel] = hashed;
}

// ─── Step 2: hash loader runtime deps (i18n.js engine) ───────────────────
for (const rel of LOADER_RUNTIME_DEPS) {
  const buf = readSrc(rel);
  const hashed = hashedRelPath(rel, shortHash(buf));
  writeDeploy(hashed, buf);
  manifest[rel] = hashed;
}
console.log(`[fingerprint] hashed ${LOCALES.length} locale packs + ${LOADER_RUNTIME_DEPS.length} loader runtime dep(s)`);

// ─── Step 3: patch i18n-loader with manifest, then hash ──────────────────
const loaderSrc = fs.readFileSync(path.join(SRC_DIR, LOADER_FILE), 'utf8');
if (loaderSrc.indexOf(LOADER_TOKEN) === -1) {
  console.error(`[fingerprint] ERROR: token "${LOADER_TOKEN}" not found in _dev/src/${LOADER_FILE}`);
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
writeDeploy(loaderHashed, patchedLoaderBuf);
manifest[LOADER_FILE] = loaderHashed;
console.log(`[fingerprint] patched + hashed ${LOADER_FILE} → ${loaderHashed}`);

// ─── Step 4: hash standalone scripts ─────────────────────────────────────
for (const rel of STANDALONE_SCRIPTS) {
  const srcPath = path.join(SRC_DIR, rel);
  if (!fs.existsSync(srcPath)) {
    console.error(`[fingerprint] ERROR: missing source _dev/src/${rel}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(srcPath);
  const hashed = hashedRelPath(rel, shortHash(buf));
  writeDeploy(hashed, buf);
  manifest[rel] = hashed;
}
console.log(`[fingerprint] hashed ${STANDALONE_SCRIPTS.length} standalone scripts`);

// ─── Step 5: cleanup deploy paths ────────────────────────────────────────
// (a) Stale hashed JS not in current manifest values (leftover from prior builds).
// (b) Any non-hashed `.js` at deploy paths root or i18n/ that match a manifest key
//     — spec 36 explicitly disallows originals at deploy paths.
const hashedFileRe = new RegExp(`\\.[0-9a-f]{${HASH_HEX_LEN}}\\.js$`);
const currentValues = new Set(Object.values(manifest));
// Build set of "source-named" deploy paths that should NOT exist on disk
// (their content is served only via the hashed copies).
const sourceNamedDeployPaths = new Set(Object.keys(manifest));
const watchDirs = ['', 'i18n'];
let cleanedHashed = 0;
let cleanedSourceNamed = 0;
for (const dir of watchDirs) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs)) {
    if (!name.endsWith('.js')) continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (hashedFileRe.test(name)) {
      if (currentValues.has(rel)) continue;
      fs.unlinkSync(path.join(abs, name));
      cleanedHashed++;
    } else if (sourceNamedDeployPaths.has(rel)) {
      fs.unlinkSync(path.join(abs, name));
      cleanedSourceNamed++;
    }
  }
}
if (cleanedHashed > 0) console.log(`[fingerprint] removed ${cleanedHashed} stale hashed file(s)`);
if (cleanedSourceNamed > 0) console.log(`[fingerprint] removed ${cleanedSourceNamed} source-named deploy file(s) (spec 36)`);

// ─── Step 6: collision sanity check ──────────────────────────────────────
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

// ─── Step 7: write manifest ──────────────────────────────────────────────
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[fingerprint] wrote fingerprint-manifest.json (${Object.keys(manifest).length} entries)`);

// ─── Step 8: rewrite <script src="…"> in every built HTML file ───────────
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
