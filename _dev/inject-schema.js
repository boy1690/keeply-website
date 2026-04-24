#!/usr/bin/env node
/**
 * Keeply JSON-LD Schema Injector (Post-processor)
 *
 * Injects Schema.org JSON-LD structured data into every HTML page under the
 * site root and each locale subdirectory. Runs AFTER `_dev/build.js` so that
 * locale pages already exist with correct <html lang> and <link rel="canonical">.
 *
 * Design:
 *   - Idempotent: strips all existing `<script type="application/ld+json">`
 *     blocks before injecting a fresh one.
 *   - Deterministic: pure function of (release-config + i18n JSONs + HTML).
 *   - Fault-tolerant: skips files without <head> or canonical, emits WARN.
 *
 * Schema shapes:
 *   - index.html  → @graph: [Organization, WebSite, SoftwareApplication]
 *   - inner pages → @graph: [Organization, WebPage]
 *
 * Usage: node _dev/inject-schema.js
 * Spec:  specs/website/017-jsonld-structured-data/
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const ROOT_DIR = path.join(__dirname, '..');
const I18N_DIR = path.join(ROOT_DIR, 'i18n');
const RELEASE_CONFIG_PATH = path.join(__dirname, 'release-config.json');

const BASE_URL = 'https://keeply.work';

// Pages that may exist in root + each locale dir.
const ROOT_PAGES = ['index.html', 'buy.html', 'privacy.html', 'terms.html', 'refund.html', 'contact.html', 'activate.html'];
const INDEX_PAGE = 'index.html';

// Spec 028: comparison pages at /compare/{slug}.html + /zh-TW/compare/{slug}.html
const COMPARISONS_DIR = path.join(ROOT_DIR, '_dev', 'comparisons');

// Organization constants — shared across all 140 pages via @id reference.
const ORG = {
  '@type': 'Organization',
  '@id': `${BASE_URL}/#organization`,
  name: 'Keeply',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.svg`,
  sameAs: ['https://github.com/boy1690/keeply-releases']
};

const SOFTWARE_CONST = {
  operatingSystem: 'Windows, macOS',
  applicationCategory: 'UtilitiesApplication',
  downloadUrl: 'https://github.com/boy1690/keeply-releases/releases/latest',
  screenshot: `${BASE_URL}/og-image.png`
};

// Map page filename → meta key prefix in i18n JSON.
const PAGE_META_PREFIX = {
  'index.html': 'index',
  'buy.html': 'buy',
  'privacy.html': 'privacy',
  'terms.html': 'terms',
  'refund.html': 'refund',
  'contact.html': 'contact',
  'activate.html': 'activate'
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadReleaseConfig() {
  if (!fs.existsSync(RELEASE_CONFIG_PATH)) {
    console.error(`ERROR: release-config.json not found at ${RELEASE_CONFIG_PATH}`);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(RELEASE_CONFIG_PATH, 'utf8'));
  const required = ['version', 'price', 'priceCurrency'];
  const missing = required.filter(k => !cfg[k]);
  if (missing.length) {
    console.error(`ERROR: release-config.json must contain non-empty fields: ${missing.join(', ')}`);
    process.exit(1);
  }
  return cfg;
}

function discoverLocales() {
  // Dynamically scan i18n/*.json so new/removed locales flow through without code edits.
  return fs.readdirSync(I18N_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
    .sort();
}

function loadTranslations(locales) {
  const translations = {};
  for (const locale of locales) {
    const jsonPath = path.join(I18N_DIR, `${locale}.json`);
    if (fs.existsSync(jsonPath)) {
      translations[locale] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } else {
      console.warn(`WARN: missing ${jsonPath}`);
      translations[locale] = {};
    }
  }
  return translations;
}

function getTranslation(translations, locale, key, fallbackLocale = 'en') {
  if (translations[locale] && translations[locale][key] != null) {
    return translations[locale][key];
  }
  if (fallbackLocale && translations[fallbackLocale] && translations[fallbackLocale][key] != null) {
    console.warn(`  FALLBACK: ${locale} missing "${key}", using ${fallbackLocale}`);
    return translations[fallbackLocale][key];
  }
  return null;
}

function getHtmlLang(html) {
  const m = html.match(/<html[^>]*\slang="([^"]+)"/i);
  return m ? m[1] : null;
}

function getCanonicalUrl(html) {
  const m = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  return m ? m[1] : null;
}

// Derive locale from file path like ".../ja/buy.html" → "ja"; returns null for root pages.
function localeFromPath(filePath) {
  const rel = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length === 1) return null; // root page
  return parts[0];
}

function pageFromPath(filePath) {
  return path.basename(filePath);
}

function deriveUrlFromPath(filePath) {
  const locale = localeFromPath(filePath);
  const page = pageFromPath(filePath);
  if (!locale) {
    // Root pages: /buy.html, /privacy.html etc. Index → /
    return page === INDEX_PAGE ? `${BASE_URL}/` : `${BASE_URL}/${page}`;
  }
  return page === INDEX_PAGE ? `${BASE_URL}/${locale}/` : `${BASE_URL}/${locale}/${page}`;
}

// Strip characters that would break JSON embedded inside a <script> block.
// Most critical: `</script>` sequence would terminate the block early.
// Also escape U+2028 / U+2029 (valid in JSON, but break JS parsers that read the file as JS source).
function escapeJsonForScript(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/<\//g, '<\\/')
    .replace(/\u2028/g, '\u2028')
    .replace(/\u2029/g, '\u2029');
}

// ─── Schema Builders ─────────────────────────────────────────────────────────

function buildIndexGraph({ canonicalUrl, htmlLang, locale, translations, releaseConfig }) {
  const localizedDesc = getTranslation(translations, locale, 'index.meta.description') || '';
  const buyUrl = locale ? `${BASE_URL}/${locale}/buy.html` : `${BASE_URL}/buy.html`;

  return [
    ORG,
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: canonicalUrl,
      name: 'Keeply',
      inLanguage: htmlLang,
      publisher: { '@id': `${BASE_URL}/#organization` }
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${BASE_URL}/#software`,
      name: 'Keeply',
      operatingSystem: SOFTWARE_CONST.operatingSystem,
      applicationCategory: SOFTWARE_CONST.applicationCategory,
      softwareVersion: releaseConfig.version,
      description: localizedDesc,
      url: canonicalUrl,
      downloadUrl: SOFTWARE_CONST.downloadUrl,
      screenshot: SOFTWARE_CONST.screenshot,
      offers: {
        '@type': 'Offer',
        price: releaseConfig.price,
        priceCurrency: releaseConfig.priceCurrency,
        url: buyUrl
      },
      publisher: { '@id': `${BASE_URL}/#organization` }
    }
  ];
}

function buildInnerGraph({ canonicalUrl, htmlLang, locale, page, translations }) {
  const pagePrefix = PAGE_META_PREFIX[page];
  const title = getTranslation(translations, locale || 'en', `${pagePrefix}.meta.title`) || 'Keeply';
  const desc = getTranslation(translations, locale || 'en', `${pagePrefix}.meta.description`) || '';

  return [
    ORG,
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description: desc,
      inLanguage: htmlLang,
      isPartOf: { '@id': `${BASE_URL}/#website` },
      publisher: { '@id': `${BASE_URL}/#organization` }
    }
  ];
}

// ─── HTML Rewrite ────────────────────────────────────────────────────────────

function stripExistingJsonLd(html) {
  // Remove our own injector comment (if present from prior runs) — essential for idempotency.
  // Consume ONLY the trailing newline, not subsequent whitespace (preserves original blank-line layout).
  html = html.replace(
    /[ \t]*<!--\s*Schema\.org JSON-LD \(injected by _dev\/inject-schema\.js\)\s*-->\n?/g,
    ''
  );
  // Remove `<script type="application/ld+json">...</script>` blocks + leading indent + trailing newline.
  html = html.replace(
    /[ \t]*<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\n?/gi,
    ''
  );
  return html;
}

function insertJsonLd(html, jsonLdBlock) {
  // Insert before </head> with 2-space indentation matching existing <head> children.
  const indented = jsonLdBlock
    .split('\n')
    .map(line => (line.length ? `  ${line}` : line))
    .join('\n');
  const injection = `  <!-- Schema.org JSON-LD (injected by _dev/inject-schema.js) -->\n${indented}\n`;
  return html.replace(/(\s*)<\/head>/i, `${injection}$1</head>`);
}

function processFile(filePath, ctx) {
  const html = fs.readFileSync(filePath, 'utf8');

  if (!/<head[\s>]/i.test(html)) {
    console.warn(`  SKIP: ${path.relative(ROOT_DIR, filePath)} — no <head>`);
    return { skipped: true };
  }

  const htmlLang = getHtmlLang(html);
  if (!htmlLang) {
    console.warn(`  SKIP: ${path.relative(ROOT_DIR, filePath)} — no <html lang>`);
    return { skipped: true };
  }

  const canonicalUrl = getCanonicalUrl(html) || deriveUrlFromPath(filePath);
  if (!canonicalUrl) {
    console.warn(`  SKIP: ${path.relative(ROOT_DIR, filePath)} — no canonical and cannot derive URL`);
    return { skipped: true };
  }

  const locale = localeFromPath(filePath) || 'en'; // Root pages are English fallback.
  const page = pageFromPath(filePath);

  // Spec 028: comparison pages have their own schema pipeline.
  const compare = detectComparePage(filePath);
  let graph;
  if (compare) {
    if (compare.type === 'hub') {
      graph = buildCompareHubGraph({ canonicalUrl, htmlLang, locale: compare.locale });
    } else {
      graph = buildCompareSubPageGraph({ canonicalUrl, htmlLang, slug: compare.slug, locale: compare.locale });
    }
  } else if (!PAGE_META_PREFIX[page]) {
    console.warn(`  SKIP: ${path.relative(ROOT_DIR, filePath)} — not in known page list`);
    return { skipped: true };
  } else if (page === INDEX_PAGE) {
    graph = buildIndexGraph({
      canonicalUrl,
      htmlLang,
      locale,
      translations: ctx.translations,
      releaseConfig: ctx.releaseConfig
    });
  } else {
    graph = buildInnerGraph({
      canonicalUrl,
      htmlLang,
      locale,
      page,
      translations: ctx.translations
    });
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': graph
  };
  const jsonStr = escapeJsonForScript(jsonLd);
  const block = `<script type="application/ld+json">\n${jsonStr}\n</script>`;

  let out = stripExistingJsonLd(html);
  out = insertJsonLd(out, block);

  if (out !== html) {
    fs.writeFileSync(filePath, out, 'utf8');
  }
  return { skipped: false };
}

// ─── Spec 028: Comparison page schema builders ──────────────────────────────

// Detect if the file is a spec 028 comparison page. Returns { type, slug, locale } or null.
function detectComparePage(filePath) {
  const rel = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  // Patterns:
  //   compare/index.html           → hub, en
  //   compare/{slug}.html          → sub, en
  //   zh-TW/compare/index.html     → hub, zh-TW
  //   zh-TW/compare/{slug}.html    → sub, zh-TW
  let m = rel.match(/^compare\/(index|[\w-]+)\.html$/);
  if (m) {
    return { type: m[1] === 'index' ? 'hub' : 'sub', slug: m[1] === 'index' ? null : m[1], locale: 'en' };
  }
  m = rel.match(/^([a-z]{2}-[A-Z]{2}|[a-z]{2})\/compare\/(index|[\w-]+)\.html$/);
  if (m) {
    return { type: m[2] === 'index' ? 'hub' : 'sub', slug: m[2] === 'index' ? null : m[2], locale: m[1] };
  }
  return null;
}

function buildCompareSubPageGraph({ canonicalUrl, htmlLang, slug, locale }) {
  const jsonPath = path.join(COMPARISONS_DIR, `${slug}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.warn(`  WARN: ${slug}.json not found; falling back to minimal schema`);
    return [ORG];
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const L = data.locales[locale] || data.locales.en;
  if (!L) return [ORG];

  const faqItems = (L.faq || []).map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a }
  }));

  return [
    ORG,
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: canonicalUrl,
      name: 'Keeply',
      inLanguage: htmlLang,
      publisher: { '@id': `${BASE_URL}/#organization` }
    },
    {
      '@type': 'Article',
      '@id': `${canonicalUrl}#article`,
      headline: L.meta.title,
      description: L.meta.description,
      datePublished: data.published,
      dateModified: data.published,
      inLanguage: htmlLang,
      author: { '@id': `${BASE_URL}/#organization` },
      publisher: { '@id': `${BASE_URL}/#organization` },
      mainEntityOfPage: canonicalUrl,
      image: `${BASE_URL}/og-image.png`
    },
    {
      '@type': 'FAQPage',
      '@id': `${canonicalUrl}#faq`,
      mainEntity: faqItems
    }
  ];
}

function buildCompareHubGraph({ canonicalUrl, htmlLang, locale }) {
  const hubPath = path.join(COMPARISONS_DIR, '_hub.json');
  if (!fs.existsSync(hubPath)) return [ORG];
  const hub = JSON.parse(fs.readFileSync(hubPath, 'utf8'));

  const hubUrl = locale === 'en' ? `${BASE_URL}/compare/` : `${BASE_URL}/${locale}/compare/`;
  const homeUrl = locale === 'en' ? `${BASE_URL}/` : `${BASE_URL}/${locale}/`;

  const itemList = hub.order.map((slug, i) => {
    const cardMeta = (hub.cards && hub.cards[slug]) ? (hub.cards[slug][locale] || {}) : {};
    const subUrl = locale === 'en' ? `${BASE_URL}/compare/${slug}.html` : `${BASE_URL}/${locale}/compare/${slug}.html`;
    return {
      '@type': 'ListItem',
      position: i + 1,
      url: subUrl,
      name: cardMeta.title || slug
    };
  });

  const homeLabel = locale === 'en' ? 'Home' : '首頁';
  const compareLabel = locale === 'en' ? 'Compare' : '工具比較';

  const hubMeta = hub.locales[locale] || hub.locales.en;

  return [
    ORG,
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: hubUrl,
      name: 'Keeply',
      inLanguage: htmlLang,
      publisher: { '@id': `${BASE_URL}/#organization` }
    },
    {
      '@type': 'WebPage',
      '@id': `${hubUrl}#webpage`,
      url: hubUrl,
      name: hubMeta.meta.title,
      description: hubMeta.meta.description,
      inLanguage: htmlLang,
      isPartOf: { '@id': `${BASE_URL}/#website` },
      publisher: { '@id': `${BASE_URL}/#organization` }
    },
    {
      '@type': 'ItemList',
      '@id': `${hubUrl}#itemlist`,
      itemListElement: itemList
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${hubUrl}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: homeLabel, item: homeUrl },
        { '@type': 'ListItem', position: 2, name: compareLabel, item: hubUrl }
      ]
    }
  ];
}

// ─── Main ────────────────────────────────────────────────────────────────────

function collectTargetFiles(locales) {
  const files = [];

  // Root pages.
  for (const page of ROOT_PAGES) {
    const full = path.join(ROOT_DIR, page);
    if (fs.existsSync(full)) files.push(full);
  }

  // Locale subdirectory pages.
  for (const locale of locales) {
    const localeDir = path.join(ROOT_DIR, locale);
    if (!fs.existsSync(localeDir) || !fs.statSync(localeDir).isDirectory()) continue;
    for (const page of ROOT_PAGES) {
      const full = path.join(localeDir, page);
      if (fs.existsSync(full)) files.push(full);
    }
  }

  // Spec 028: comparison pages (compare/*.html + zh-TW/compare/*.html).
  for (const rel of ['compare', 'zh-TW/compare']) {
    const dir = path.join(ROOT_DIR, rel);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.html')) files.push(path.join(dir, f));
    }
  }

  return files;
}

function main() {
  console.log('=== Keeply JSON-LD Schema Injector ===\n');

  const releaseConfig = loadReleaseConfig();
  console.log(`Release: ${releaseConfig.versionTag} | Offer: ${releaseConfig.price} ${releaseConfig.priceCurrency}\n`);

  const locales = discoverLocales();
  console.log(`Discovered ${locales.length} locales: ${locales.join(', ')}\n`);

  const translations = loadTranslations(locales);

  const files = collectTargetFiles(locales);
  console.log(`Target files: ${files.length}\n`);

  const ctx = { translations, releaseConfig };
  let injected = 0;
  let skipped = 0;

  for (const file of files) {
    const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    process.stdout.write(`  ${rel} ... `);
    const result = processFile(file, ctx);
    if (result.skipped) {
      skipped++;
      console.log('SKIPPED');
    } else {
      injected++;
      console.log('OK');
    }
  }

  console.log(`\nInjected schema into ${injected} files (skipped ${skipped})`);
}

main();
