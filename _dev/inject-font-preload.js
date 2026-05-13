#!/usr/bin/env node
/**
 * Keeply Font Preload Injector (Post-processor)
 *
 * Injects 3 <link rel="preload" as="font"> tags for the self-hosted
 * M PLUS Rounded 1c weights (Regular/Medium/Bold) into every HTML page.
 *
 * Why: without explicit preload, the browser only discovers the font URLs
 * after parsing style.css, which serializes font fetch behind CSS fetch
 * and causes visible layout shift (CLS 0.27–0.38 measured pre-fix).
 * Preload moves font requests onto the critical path in parallel with CSS.
 *
 * Design:
 *   - Idempotent: skips files that already contain a font preload for
 *     MPLUSRounded1c-Regular-v2.woff2 (the canonical marker).
 *   - Path-aware: derives the asset prefix ("", "../", "../../", "/")
 *     from the existing `<link rel="stylesheet" href="...style.css"`
 *     tag in the same file, so it works for root, locale, compare/,
 *     and zh-TW/compare/ depth levels.
 *   - Skips HTML lacking a stylesheet link (verification files like
 *     yandex_*.html, naveref*.html).
 *
 * Runs AFTER build:sri so SRI hashes already applied to stylesheet
 * tags aren't disturbed. Font preload tags don't carry SRI (font files
 * are not typically SRI-protected).
 *
 * Usage: node _dev/inject-font-preload.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

const FONT_WEIGHTS = [
  'MPLUSRounded1c-Regular-v2.woff2',
  'MPLUSRounded1c-Medium-v2.woff2',
  'MPLUSRounded1c-Bold-v2.woff2'
];

const MARKER_FONT = FONT_WEIGHTS[0];

const EXCLUDE_DIRS = new Set([
  'node_modules', '_dev', 'specs', 'cloudflare', 'docs', 'idea',
  '_full-backup', 'fonts', '.git'
]);

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function buildPreloadBlock(prefix) {
  return FONT_WEIGHTS.map(function (font) {
    return '  <link rel="preload" href="' + prefix + 'fonts/' + font +
      '" as="font" type="font/woff2" crossorigin="anonymous" />';
  }).join('\n');
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');

  if (original.indexOf(MARKER_FONT) !== -1 &&
      /href="[^"]*MPLUSRounded1c-Regular-v2\.woff2"\s+as="font"/.test(original)) {
    return { file: filePath, status: 'skip-already-injected' };
  }

  const styleMatch = original.match(/<link\s+rel="stylesheet"\s+href="([^"]*)style\.css"[^>]*\/>/);
  if (!styleMatch) {
    return { file: filePath, status: 'skip-no-stylesheet' };
  }

  const prefix = styleMatch[1];
  const preloadBlock = buildPreloadBlock(prefix);
  const styleTag = styleMatch[0];
  const insertPoint = original.indexOf(styleTag) + styleTag.length;

  const updated = original.slice(0, insertPoint) +
    '\n\n  <!-- M PLUS Rounded 1c font preload (eliminates CLS from late font discovery) -->\n' +
    preloadBlock +
    original.slice(insertPoint);

  fs.writeFileSync(filePath, updated, 'utf8');
  return { file: filePath, status: 'injected', prefix: prefix };
}

function main() {
  const files = walk(ROOT_DIR, []);
  const results = files.map(processFile);

  const injected = results.filter(r => r.status === 'injected');
  const skippedExisting = results.filter(r => r.status === 'skip-already-injected');
  const skippedNoStyle = results.filter(r => r.status === 'skip-no-stylesheet');

  console.log('Font preload injection complete.');
  console.log('  Injected:                 ' + injected.length);
  console.log('  Skipped (already had it): ' + skippedExisting.length);
  console.log('  Skipped (no stylesheet):  ' + skippedNoStyle.length);

  if (skippedNoStyle.length > 0) {
    console.log('\n  Files without <link rel="stylesheet">:');
    for (const r of skippedNoStyle) {
      console.log('    - ' + path.relative(ROOT_DIR, r.file));
    }
  }
}

main();
