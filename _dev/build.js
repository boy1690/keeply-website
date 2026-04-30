#!/usr/bin/env node
/**
 * Keeply i18n Build Script
 *
 * Reads HTML templates from templates/ and i18n JSON files from i18n/,
 * generates static localized pages in subdirectories (en/, ja/, zh-TW/, etc.),
 * and produces a sitemap.xml with hreflang cross-references.
 *
 * Usage: node _dev/build.js
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const ROOT_DIR = path.join(__dirname, '..');

const RELEASE_CONFIG_PATH = path.join(__dirname, 'release-config.json');

const LOCALES = [
  'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
  'de', 'fr', 'es', 'pt', 'it',
  'nl', 'pl', 'cs', 'hu', 'tr',
  'fi', 'sv', 'no', 'da'
];

const PAGES = ['index.html', 'privacy.html', 'terms.html', 'contact.html'];

// Pages that exist per-locale but are NOT template-driven (maintained as static
// copies in each {locale}/ directory). Listed in sitemap.xml for SEO.
// Spec 025: was missing before, caused Google/Bing to not discover these pages.
const EXTRA_SITEMAP_PAGES = ['buy.html', 'refund.html', 'activate.html'];

// Spec 028: compare pages exist only for en + zh-TW (bilingual scope).
// Sitemap entries are generated separately with hreflang cross-refs limited to these 2 locales.
const COMPARE_LOCALES = ['en', 'zh-TW'];
const COMPARISONS_DIR = path.join(__dirname, 'comparisons');

const BASE_URL = 'https://keeply.work';
const TEMPLATE_DIR = path.join(__dirname, 'templates');
const I18N_DIR = path.join(ROOT_DIR, 'i18n');
const OUTPUT_DIR = ROOT_DIR;

// Map locale codes → HTML lang attribute values
const HTML_LANG_MAP = {
  'zh-TW': 'zh-Hant', 'zh-CN': 'zh-Hans',
  'en': 'en', 'ja': 'ja', 'ko': 'ko',
  'de': 'de', 'fr': 'fr', 'es': 'es', 'pt': 'pt', 'it': 'it',
  'nl': 'nl', 'pl': 'pl', 'cs': 'cs', 'hu': 'hu', 'tr': 'tr',
  'fi': 'fi', 'sv': 'sv', 'no': 'no', 'da': 'da'
};

// Map locale codes → OG locale format
const OG_LOCALE_MAP = {
  'zh-TW': 'zh_TW', 'zh-CN': 'zh_CN', 'en': 'en_US',
  'ja': 'ja_JP', 'ko': 'ko_KR', 'de': 'de_DE', 'fr': 'fr_FR',
  'es': 'es_ES', 'pt': 'pt_PT', 'it': 'it_IT', 'nl': 'nl_NL',
  'pl': 'pl_PL', 'cs': 'cs_CZ', 'hu': 'hu_HU', 'tr': 'tr_TR',
  'fi': 'fi_FI', 'sv': 'sv_SE', 'no': 'nb_NO', 'da': 'da_DK'
};

// Map page filename → meta key prefix
const PAGE_META_PREFIX = {
  'index.html': 'index',
  'privacy.html': 'privacy',
  'terms.html': 'terms',
  'contact.html': 'contact'
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}

function loadReleaseConfig() {
  if (!fs.existsSync(RELEASE_CONFIG_PATH)) {
    console.error(`ERROR: release-config.json not found at ${RELEASE_CONFIG_PATH}`);
    console.error('Create it with shape: { "version": "1.0.2", "versionTag": "v1.0.2" }');
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(RELEASE_CONFIG_PATH, 'utf8'));
  if (!cfg.version || !cfg.versionTag) {
    console.error('ERROR: release-config.json must contain non-empty "version" and "versionTag" fields');
    process.exit(1);
  }
  if (!cfg.versionTag.startsWith('v')) {
    console.warn(`WARNING: versionTag "${cfg.versionTag}" does not start with 'v' — expected GitHub release tag convention`);
  }
  return cfg;
}

function applyVersionSubstitution(html, cfg) {
  // Replace longer keys first to avoid being shadowed by partial matches.
  // Order: VERSION_TAG → SHA256_* → VERSION
  const checksums = (cfg.checksums && typeof cfg.checksums === 'object') ? cfg.checksums : {};
  return html
    .replace(/\{\{VERSION_TAG\}\}/g, cfg.versionTag)
    .replace(/\{\{SHA256_WIN\}\}/g, checksums.WIN || '')
    .replace(/\{\{SHA256_MAC\}\}/g, checksums.MAC || '')
    .replace(/\{\{SHA256_MSI\}\}/g, checksums.MSI || '')
    .replace(/\{\{SHA256_APPTAR\}\}/g, checksums.APPTAR || '')
    .replace(/\{\{VERSION\}\}/g, cfg.version);
}

function loadTranslations() {
  const translations = {};
  for (const locale of LOCALES) {
    const jsonPath = path.join(I18N_DIR, `${locale}.json`);
    if (fs.existsSync(jsonPath)) {
      translations[locale] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } else {
      console.warn(`WARNING: Missing translation file: ${jsonPath}`);
      translations[locale] = {};
    }
  }
  return translations;
}

function getTranslation(translations, locale, key, fallbackLocale) {
  if (translations[locale] && translations[locale][key] != null) {
    return translations[locale][key];
  }
  if (fallbackLocale && translations[fallbackLocale] && translations[fallbackLocale][key] != null) {
    console.warn(`  FALLBACK: ${locale} missing key "${key}", using ${fallbackLocale}`);
    return translations[fallbackLocale][key];
  }
  return null;
}

// ─── HTML Transformations ────────────────────────────────────────────────────

function replaceHtmlLang(html, locale) {
  const langVal = HTML_LANG_MAP[locale] || locale;
  return html.replace(/(<html[^>]*\s)lang="[^"]*"/, `$1lang="${langVal}"`);
}

function replaceTitle(html, translations, locale, pagePrefix) {
  const titleKey = `${pagePrefix}.meta.title`;
  const title = getTranslation(translations, locale, titleKey, 'en');
  if (title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  }
  return html;
}

function replaceMetaDescription(html, translations, locale, pagePrefix) {
  const descKey = `${pagePrefix}.meta.description`;
  const desc = getTranslation(translations, locale, descKey, 'en');
  if (desc) {
    html = html.replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      `$1${escapeAttr(desc)}$2`
    );
  }
  return html;
}

function replaceCanonical(html, locale, page) {
  const pagePath = page === 'index.html' ? '' : page;
  const url = `${BASE_URL}/${locale}/${pagePath}`;
  return html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    `$1${url}$2`
  );
}

function replaceHreflangTags(html, locale, page) {
  const pagePath = page === 'index.html' ? '' : page;

  // Remove all existing hreflang link tags
  html = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href="[^"]*"\s*\/?\s*>\s*/g, '\n');

  // Build new hreflang tags
  let hreflangTags = '';
  for (const loc of LOCALES) {
    const url = `${BASE_URL}/${loc}/${pagePath}`;
    hreflangTags += `  <link rel="alternate" hreflang="${loc}" href="${url}" />\n`;
  }
  hreflangTags += `  <link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />\n`;

  // Insert after canonical
  html = html.replace(
    /(<link\s+rel="canonical"[^>]*>)\n*/,
    `$1\n\n  <!-- Hreflang (19 languages + x-default) -->\n${hreflangTags}`
  );

  return html;
}

function replaceOgTags(html, translations, locale, page, pagePrefix) {
  const pagePath = page === 'index.html' ? '' : page;
  const url = `${BASE_URL}/${locale}/${pagePath}`;
  const ogLocale = OG_LOCALE_MAP[locale] || locale;

  // og:url
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    `$1${url}$2`
  );

  // og:title
  const title = getTranslation(translations, locale, `${pagePrefix}.meta.title`, 'en');
  if (title) {
    html = html.replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
      `$1${escapeAttr(title)}$2`
    );
  }

  // og:description
  const desc = getTranslation(translations, locale, `${pagePrefix}.meta.description`, 'en');
  if (desc) {
    html = html.replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${escapeAttr(desc)}$2`
    );
  }

  // og:image:alt — mirror og:title so each locale's preview alt-text matches its title
  if (title) {
    html = html.replace(
      /(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/,
      `$1${escapeAttr(title)}$2`
    );
  }

  // og:locale — replace primary and remove alternates, then add correct ones
  html = html.replace(
    /(<meta\s+property="og:locale"\s+content=")[^"]*(")/,
    `$1${ogLocale}$2`
  );
  // Remove existing og:locale:alternate tags
  html = html.replace(/\s*<meta\s+property="og:locale:alternate"\s+content="[^"]*"\s*\/?\s*>\s*/g, '\n');
  // Add og:locale:alternate for other locales
  let ogAlternates = '';
  for (const loc of LOCALES) {
    if (loc !== locale) {
      const altOgLocale = OG_LOCALE_MAP[loc] || loc;
      ogAlternates += `  <meta property="og:locale:alternate" content="${altOgLocale}" />\n`;
    }
  }
  html = html.replace(
    /(<meta\s+property="og:locale"\s+content="[^"]*"\s*\/?\s*>)\n*/,
    `$1\n${ogAlternates}`
  );

  // Twitter Card title + description
  if (title) {
    html = html.replace(
      /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
      `$1${escapeAttr(title)}$2`
    );
  }
  if (desc) {
    html = html.replace(
      /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
      `$1${escapeAttr(desc)}$2`
    );
  }

  // twitter:image:alt — same locale-aware alt as og:image:alt
  if (title) {
    html = html.replace(
      /(<meta\s+name="twitter:image:alt"\s+content=")[^"]*(")/,
      `$1${escapeAttr(title)}$2`
    );
  }

  return html;
}

function replaceDataI18n(html, translations, locale) {
  const t = translations[locale] || {};
  const fallback = translations['en'] || {};

  // Replace data-i18n="key" elements (textContent)
  // Matches: <TAG ... data-i18n="key" ...>content</TAG>
  html = html.replace(
    /(<(\w+)\s[^>]*?data-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    function (match, openTag, tagName, key, content, closeTag) {
      var val = t[key] != null ? t[key] : (fallback[key] != null ? fallback[key] : null);
      if (val == null) return match;
      // For input/textarea, set placeholder attribute instead
      if (tagName === 'input' || tagName === 'textarea') {
        openTag = openTag.replace(/placeholder="[^"]*"/, `placeholder="${escapeAttr(val)}"`);
        return openTag + content + closeTag;
      }
      return openTag + escapeHtml(val) + closeTag;
    }
  );

  // Replace data-i18n-html="key" elements (innerHTML)
  html = html.replace(
    /(<(\w+)\s[^>]*?data-i18n-html="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    function (match, openTag, tagName, key, content, closeTag) {
      var val = t[key] != null ? t[key] : (fallback[key] != null ? fallback[key] : null);
      if (val == null) return match;
      return openTag + val + closeTag;
    }
  );

  return html;
}

function fixResourcePaths(html) {
  // Fix stylesheet links
  html = html.replace(/(href=")style\.css(")/g, '$1../style.css$2');
  html = html.replace(/(href=")input\.css(")/g, '$1../input.css$2');

  // Fix preload links
  html = html.replace(/(<link\s+rel="preload"\s+href=")style\.css(")/g, '$1../style.css$2');

  // Fix script sources
  html = html.replace(/(src=")components\.js(")/g, '$1../components.js$2');
  html = html.replace(/(src=")i18n-loader\.js(")/g, '$1../i18n-loader.js$2');
  html = html.replace(/(src=")i18n\.js(")/g, '$1../i18n.js$2');
  html = html.replace(/(src=")consent-api\.js(")/g, '$1../consent-api.js$2');   // spec 023
  html = html.replace(/(src=")cookie-banner\.js(")/g, '$1../cookie-banner.js$2'); // spec 023
  html = html.replace(/(src=")ga4-loader\.js(")/g, '$1../ga4-loader.js$2');     // spec 024

  // Fix favicon links
  html = html.replace(/(href=")favicon\.ico(")/g, '$1../favicon.ico$2');
  html = html.replace(/(href=")favicon\.svg(")/g, '$1../favicon.svg$2');
  html = html.replace(/(href=")apple-touch-icon\.png(")/g, '$1../apple-touch-icon.png$2');
  html = html.replace(/(href=")site\.webmanifest(")/g, '$1../site.webmanifest$2');

  // Fix image sources
  html = html.replace(/(src=")og-image\.png(")/g, '$1../og-image.png$2');
  html = html.replace(/(src=")logo\.svg(")/g, '$1../logo.svg$2');
  html = html.replace(/(src=")logo-dark\.svg(")/g, '$1../logo-dark.svg$2');

  // Fix OG image URL (absolute, should not be changed)
  // Already absolute with https://keeply.work/, so no fix needed

  return html;
}

// ─── Sitemap Generation ─────────────────────────────────────────────────────

/**
 * Spec 028: collect compare hub + sub-page sitemap entries.
 * English lives at /compare/ (no locale prefix, matches build-comparisons.js output).
 * zh-TW lives at /zh-TW/compare/. Hreflang cross-refs limited to these 2 locales.
 */
function generateCompareSitemapEntries(today) {
  if (!fs.existsSync(COMPARISONS_DIR)) return '';

  const slugs = fs.readdirSync(COMPARISONS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => f.replace(/\.json$/, ''))
    .sort();

  // Entries: hub (path '') + one per slug.
  const entries = [{ path: '', priority: '0.9' }]
    .concat(slugs.map(slug => ({ path: `${slug}.html`, priority: '0.85' })));

  // URL builder mirrors canonical URLs produced by build-comparisons.js.
  const urlFor = (locale, entryPath) => locale === 'en'
    ? `${BASE_URL}/compare/${entryPath}`
    : `${BASE_URL}/${locale}/compare/${entryPath}`;

  let xml = '';
  for (const locale of COMPARE_LOCALES) {
    for (const entry of entries) {
      const url = urlFor(locale, entry.path);
      xml += '  <url>\n';
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += `    <priority>${entry.priority}</priority>\n`;

      for (const altLocale of COMPARE_LOCALES) {
        xml += `    <xhtml:link rel="alternate" hreflang="${altLocale}" href="${urlFor(altLocale, entry.path)}" />\n`;
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('en', entry.path)}" />\n`;
      xml += '  </url>\n';
    }
  }
  return xml;
}

function generateSitemap() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  const today = new Date().toISOString().split('T')[0];

  // All pages that should appear in sitemap: template-driven + extra static pages.
  const sitemapPages = PAGES.concat(EXTRA_SITEMAP_PAGES);

  for (const page of sitemapPages) {
    for (const locale of LOCALES) {
      const pagePath = page === 'index.html' ? '' : page;
      const url = `${BASE_URL}/${locale}/${pagePath}`;
      const priority = page === 'index.html' ? '1.0' : (page === 'buy.html' ? '0.8' : '0.5');
      const changefreq = page === 'index.html' ? 'weekly' : 'monthly';

      xml += '  <url>\n';
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;

      // Hreflang cross-references for all locales
      for (const altLocale of LOCALES) {
        const altPath = page === 'index.html' ? '' : page;
        const altUrl = `${BASE_URL}/${altLocale}/${altPath}`;
        xml += `    <xhtml:link rel="alternate" hreflang="${altLocale}" href="${altUrl}" />\n`;
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />\n`;

      xml += '  </url>\n';
    }
  }

  // Also add root language selector page
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}/</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += '    <changefreq>monthly</changefreq>\n';
  xml += '    <priority>0.8</priority>\n';
  xml += '  </url>\n';

  // Spec 028: compare hub + sub-pages (en + zh-TW).
  xml += generateCompareSitemapEntries(today);

  xml += '</urlset>\n';
  return xml;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== Keeply i18n Build ===\n');

  // Load release config
  const releaseConfig = loadReleaseConfig();
  console.log(`Release version: ${releaseConfig.versionTag} (${releaseConfig.version})\n`);

  // Load translations
  const translations = loadTranslations();
  console.log(`Loaded ${Object.keys(translations).length} locales\n`);

  let fileCount = 0;

  for (const locale of LOCALES) {
    const localeDir = path.join(OUTPUT_DIR, locale);
    if (!fs.existsSync(localeDir)) {
      fs.mkdirSync(localeDir, { recursive: true });
    }

    for (const page of PAGES) {
      const templatePath = path.join(TEMPLATE_DIR, page);
      if (!fs.existsSync(templatePath)) {
        console.error(`ERROR: Template not found: ${templatePath}`);
        process.exit(1);
      }

      let html = fs.readFileSync(templatePath, 'utf8');
      const pagePrefix = PAGE_META_PREFIX[page];

      // Apply transformations in order
      html = applyVersionSubstitution(html, releaseConfig);
      html = replaceHtmlLang(html, locale);
      html = replaceTitle(html, translations, locale, pagePrefix);
      html = replaceMetaDescription(html, translations, locale, pagePrefix);
      html = replaceCanonical(html, locale, page);
      html = replaceHreflangTags(html, locale, page);
      html = replaceOgTags(html, translations, locale, page, pagePrefix);
      html = replaceDataI18n(html, translations, locale);
      html = fixResourcePaths(html);

      // Write output
      const outputPath = path.join(localeDir, page);
      fs.writeFileSync(outputPath, html, 'utf8');
      fileCount++;
    }
  }

  // Generate sitemap
  const sitemap = generateSitemap();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), sitemap, 'utf8');
  const sitemapCount = (sitemap.match(/<url>/g) || []).length;
  console.log(`Generated sitemap.xml (${sitemapCount} URLs)\n`);

  // Sync i18n/*.js from *.json
  for (const locale of LOCALES) {
    const jsonData = translations[locale];
    const jsContent = `window.__i18n = window.__i18n || {};\nwindow.__i18n["${locale}"] = ${JSON.stringify(jsonData, null, 2)};\n`;
    fs.writeFileSync(path.join(I18N_DIR, `${locale}.js`), jsContent, 'utf8');
  }
  console.log(`Synced ${LOCALES.length} i18n .js files from .json`);

  // Copy templates to root as fallback pages (with version substitution applied)
  for (const page of PAGES) {
    let rootHtml = fs.readFileSync(path.join(TEMPLATE_DIR, page), 'utf8');
    rootHtml = applyVersionSubstitution(rootHtml, releaseConfig);
    fs.writeFileSync(path.join(OUTPUT_DIR, page), rootHtml, 'utf8');
  }
  console.log(`Copied ${PAGES.length} templates to root (version-substituted)`);

  console.log(`\nBuild complete: ${fileCount} files generated across ${LOCALES.length} locales`);
}

main();
