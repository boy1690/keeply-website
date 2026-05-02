#!/usr/bin/env node
/**
 * Keeply SRI Build Step (spec 020 + spec 15)
 *
 * Computes SHA-384 integrity hashes for all same-origin scripts and styles,
 * writes sri-manifest.json, and patches every built HTML file so static
 * <link>/<script> tags carry integrity + crossorigin attributes.
 *
 * Spec 15: when fingerprint-manifest.json exists, this step hashes the
 * HASHED file (the one the browser actually fetches) and patches HTML by
 * matching the hashed filename — keeping URL ↔ content ↔ integrity 1:1.
 *
 * Must run AFTER build:css (needs final style.css), AFTER build:pages
 * (needs all output HTML to exist), AFTER build:schema, and AFTER
 * build:fingerprint (so we hash the hashed files).
 *
 * Usage: node _dev/build-sri.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const LOCALES = [
  'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
  'de', 'fr', 'es', 'pt', 'it',
  'nl', 'pl', 'cs', 'hu', 'tr',
  'fi', 'sv', 'no', 'da'
];

function sha384Integrity(buf) {
  return 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- 1. Load fingerprint manifest (optional) ----------
const fpManifestPath = path.join(ROOT, 'fingerprint-manifest.json');
const fpManifest = fs.existsSync(fpManifestPath)
  ? JSON.parse(fs.readFileSync(fpManifestPath, 'utf8'))
  : {};

// Resolve to the file the browser will actually fetch.
function resolveFingerprinted(rel) {
  return fpManifest[rel] || rel;
}

// ---------- 2. Build resource list ----------
// Originals (manifest keys) — these are the canonical lookup keys runtime
// code uses. The actual file we hash is the fingerprinted variant.
const STYLE_RESOURCE = 'style.css';
const SCRIPT_ORIGINALS = [
  'components.js',
  'i18n-loader.js',
  'i18n.js',
  'consent-api.js',     // spec 023
  'cookie-banner.js',   // spec 023
  'ga4-loader.js',      // spec 024
  'clarity-loader.js',  // 2026-05-03 Microsoft Clarity Consent Mode v2 integration
  'team-notify.js',     // spec 031
  'activate-license.js',// spec 031
  'paddle-checkout.js'  // spec 031
];
for (const loc of LOCALES) SCRIPT_ORIGINALS.push(`i18n/${loc}.js`);

// ---------- 3. Hash each (fingerprinted) resource ----------
const manifest = {};
const styleResolved = resolveFingerprinted(STYLE_RESOURCE);
{
  const full = path.join(ROOT, styleResolved);
  if (!fs.existsSync(full)) {
    console.error(`[build-sri] missing: ${styleResolved}`);
    process.exit(1);
  }
  manifest[styleResolved] = sha384Integrity(fs.readFileSync(full));
}
for (const orig of SCRIPT_ORIGINALS) {
  const resolved = resolveFingerprinted(orig);
  const full = path.join(ROOT, resolved);
  if (!fs.existsSync(full)) {
    console.error(`[build-sri] missing: ${resolved} (resolved from ${orig})`);
    process.exit(1);
  }
  manifest[resolved] = sha384Integrity(fs.readFileSync(full));
}

// ---------- 4. Write sri-manifest.json ----------
// i18n-loader.js reads this at runtime keyed by hashed name. The runtime
// already calls FINGERPRINT_MANIFEST first to resolve original → hashed,
// so manifest keys here are hashed filenames (post-spec-15 contract).
fs.writeFileSync(
  path.join(ROOT, 'sri-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
);
console.log(`[build-sri] wrote ${Object.keys(manifest).length} entries to sri-manifest.json`);

// ---------- 5. Patch HTML files ----------
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

const htmlFiles = listHtmlFiles(ROOT);

// Patch a tag matched by `re` so its integrity attribute equals `hash`.
// Strips any prior integrity/crossorigin first → idempotent re-runs.
function patchHtml(content) {
  function rewriteTag(re, integrityValue) {
    return content.replace(re, (m) => {
      const stripped = m
        .replace(/\s+integrity="[^"]*"/g, '')
        .replace(/\s+crossorigin="[^"]*"/g, '');
      return stripped.replace(/(\s*\/?>)/,
        ` integrity="${integrityValue}" crossorigin="anonymous"$1`);
    });
  }
  const pathOpt = '(?:\\.\\.\\/|\\/)?';

  // style.css — single resource, fixed name (not fingerprinted in this PR).
  const styleHash = manifest[styleResolved];
  content = rewriteTag(
    new RegExp('<link\\s+rel="preload"\\s+href="' + pathOpt + escapeRegex(styleResolved) + '"[^>]*>', 'g'),
    styleHash
  );
  content = rewriteTag(
    new RegExp('<link\\s+rel="stylesheet"\\s+href="' + pathOpt + escapeRegex(styleResolved) + '"[^>]*>', 'g'),
    styleHash
  );

  // Each fingerprintable script: match the resolved (hashed) filename.
  for (const orig of SCRIPT_ORIGINALS) {
    // Skip i18n/*.js packs and i18n.js — they are dynamically injected by
    // i18n-loader, never statically referenced in HTML.
    if (orig.startsWith('i18n/') || orig === 'i18n.js') continue;
    const resolved = resolveFingerprinted(orig);
    const integrity = manifest[resolved];
    content = rewriteTag(
      new RegExp('<script\\s+src="' + pathOpt + escapeRegex(resolved) + '"[^>]*></script>', 'g'),
      integrity
    );
  }

  return content;
}

let patched = 0;
for (const file of htmlFiles) {
  const before = fs.readFileSync(file, 'utf8');
  const after = patchHtml(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    patched++;
  }
}
console.log(`[build-sri] patched ${patched}/${htmlFiles.length} HTML files`);
