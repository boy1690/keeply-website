#!/usr/bin/env node
/**
 * Keeply SRI Build Step (spec 020)
 *
 * Computes SHA-384 integrity hashes for all same-origin scripts and styles,
 * writes sri-manifest.json, and patches every built HTML file so static
 * <link>/<script> tags carry integrity + crossorigin attributes.
 *
 * Must run AFTER build:css (needs final style.css), AFTER build:pages
 * (needs all output HTML to exist), and AFTER build:schema (schema
 * injection does not touch integrity attributes but running SRI last
 * is defensive — it is the final word on what bytes the browser loads).
 *
 * Usage: node _dev/build-sri.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Same order as i18n-loader.js LOCALES — not critical, just tidy.
const LOCALES = [
  'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
  'de', 'fr', 'es', 'pt', 'it',
  'nl', 'pl', 'cs', 'hu', 'tr',
  'fi', 'sv', 'no', 'da'
];

function sha384Integrity(buf) {
  return 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
}

// ---------- 1. Build the resource list ----------
const resources = [
  'style.css',
  'components.js',
  'i18n-loader.js',
  'i18n.js',
  'consent-api.js',   // spec 023
  'cookie-banner.js', // spec 023
  'ga4-loader.js'     // spec 024
];
for (const loc of LOCALES) resources.push(`i18n/${loc}.js`);

// ---------- 2. Hash each resource ----------
const manifest = {};
for (const rel of resources) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.error(`[build-sri] missing: ${rel}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(full);
  manifest[rel] = sha384Integrity(buf);
}

// ---------- 3. Write sri-manifest.json ----------
const manifestPath = path.join(ROOT, 'sri-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`[build-sri] wrote ${Object.keys(manifest).length} entries to sri-manifest.json`);

// ---------- 4. Patch HTML files ----------
// Find all HTML under repo (excluding archives, specs, _dev).
const find = `find . -type f -name "*.html" -not -path "./specs/*" -not -path "./idea/*" -not -path "./_archive/*" -not -path "./_dev/*" -not -path "./node_modules/*"`;
const htmlFiles = execSync(find, { cwd: ROOT, encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(Boolean)
  .map(f => path.join(ROOT, f));

// Patterns we rewrite:
//   <link rel="preload"    href="style.css" as="style" />
//   <link rel="stylesheet" href="style.css" />
//   <script src="components.js" defer></script>
//   <script src="i18n-loader.js" defer></script>
// For each, if integrity is absent, insert integrity + crossorigin.
// (Re-running on an already-patched file is idempotent because we first
//  strip any existing integrity/crossorigin for these specific hrefs/srcs.)
function patchHtml(content, filename) {
  function rewriteTag(re, hashKey) {
    const hash = manifest[hashKey];
    return content.replace(re, (m) => {
      // Strip any old integrity/crossorigin (re-run idempotency).
      let stripped = m
        .replace(/\s+integrity="[^"]*"/g, '')
        .replace(/\s+crossorigin="[^"]*"/g, '');
      // Insert integrity + crossorigin before the closing ">" or "/>".
      return stripped.replace(/(\s*\/?>)/,
        ` integrity="${hash}" crossorigin="anonymous"$1`);
    });
  }
  // Match both relative (`../`, none) and absolute (`/`) paths.
  var pathOpt = '(?:\\.\\.\\/|\\/)?';
  content = rewriteTag(new RegExp('<link\\s+rel="preload"\\s+href="' + pathOpt + 'style\\.css"[^>]*>', 'g'), 'style.css');
  content = rewriteTag(new RegExp('<link\\s+rel="stylesheet"\\s+href="' + pathOpt + 'style\\.css"[^>]*>', 'g'), 'style.css');
  content = rewriteTag(new RegExp('<script\\s+src="' + pathOpt + 'components\\.js"[^>]*><\\/script>', 'g'), 'components.js');
  content = rewriteTag(new RegExp('<script\\s+src="' + pathOpt + 'i18n-loader\\.js"[^>]*><\\/script>', 'g'), 'i18n-loader.js');
  // spec 023: consent + banner scripts
  content = rewriteTag(new RegExp('<script\\s+src="' + pathOpt + 'consent-api\\.js"[^>]*><\\/script>', 'g'), 'consent-api.js');
  content = rewriteTag(new RegExp('<script\\s+src="' + pathOpt + 'cookie-banner\\.js"[^>]*><\\/script>', 'g'), 'cookie-banner.js');
  // spec 024: GA4 consent-gated loader
  content = rewriteTag(new RegExp('<script\\s+src="' + pathOpt + 'ga4-loader\\.js"[^>]*><\\/script>', 'g'), 'ga4-loader.js');
  return content;
}

let patched = 0;
for (const file of htmlFiles) {
  const before = fs.readFileSync(file, 'utf8');
  const after = patchHtml(before, file);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    patched++;
  }
}
console.log(`[build-sri] patched ${patched}/${htmlFiles.length} HTML files`);
