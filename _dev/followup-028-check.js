#!/usr/bin/env node
/**
 * Spec 028 follow-up check (run ~2 weeks after deploy).
 *
 * Verifies 14 compare URLs are live, samples JSON-LD on 3, confirms sitemap
 * still lists all URLs. Produces a markdown report at
 *   specs/website/028-compare-keeply-hub/_followup-{YYYY-MM-DD}.md
 *
 * Does NOT mutate the repo. Pure read + report.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://keeply.work';
const SLUGS = ['snowtrack', 'dropbox', 'google-drive', 'time-machine', 'filename-chaos', 'email-usb'];

const urls = [];
urls.push(`${BASE}/compare/`);
for (const s of SLUGS) urls.push(`${BASE}/compare/${s}.html`);
urls.push(`${BASE}/zh-TW/compare/`);
for (const s of SLUGS) urls.push(`${BASE}/zh-TW/compare/${s}.html`);

const SAMPLE_URLS = [
  `${BASE}/compare/`,
  `${BASE}/compare/snowtrack.html`,
  `${BASE}/zh-TW/compare/dropbox.html`
];

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'keeply-followup-check/1.0' } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', (e) => resolve({ status: 0, body: '', error: e.message }));
  });
}

function extractSchemaTypes(html) {
  const types = new Set();
  const re = /"@type":\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) types.add(m[1]);
  return [...types].sort();
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const report = [];
  report.push(`# Spec 028 Follow-up Check — ${today}`);
  report.push('');
  report.push(`> 自動產出於 ${new Date().toISOString()}；非人工報告。純 HTTP + schema 抽樣檢查。`);
  report.push('');

  // 1. URL health
  report.push('## 1. URL 健康檢查（14 pages）');
  report.push('');
  report.push('| URL | Status |');
  report.push('|---|---|');
  let okCount = 0;
  for (const u of urls) {
    const r = await fetch(u);
    const mark = r.status === 200 ? '✅' : '❌';
    if (r.status === 200) okCount++;
    report.push(`| ${u} | ${mark} ${r.status}${r.error ? ' (' + r.error + ')' : ''} |`);
  }
  report.push('');
  report.push(`**結果**: ${okCount}/${urls.length} 回傳 200 OK`);
  report.push('');

  // 2. Schema sampling
  report.push('## 2. JSON-LD Schema 抽樣（3 URLs）');
  report.push('');
  const expected = {
    [`${BASE}/compare/`]: ['BreadcrumbList', 'ItemList', 'ListItem', 'Organization', 'WebPage', 'WebSite'],
    [`${BASE}/compare/snowtrack.html`]: ['Answer', 'Article', 'FAQPage', 'Organization', 'Question', 'WebSite'],
    [`${BASE}/zh-TW/compare/dropbox.html`]: ['Answer', 'Article', 'FAQPage', 'Organization', 'Question', 'WebSite']
  };
  for (const u of SAMPLE_URLS) {
    const r = await fetch(u);
    const actualTypes = extractSchemaTypes(r.body);
    const want = expected[u] || [];
    const missing = want.filter((t) => !actualTypes.includes(t));
    report.push(`### ${u}`);
    report.push('');
    report.push(`- Types 找到: \`${actualTypes.join(', ') || '(none)'}\``);
    report.push(`- 期待包含: \`${want.join(', ')}\``);
    report.push(`- 缺少: ${missing.length ? '❌ `' + missing.join(', ') + '`' : '✅ 無'}`);
    report.push('');
  }

  // 3. Sitemap verification
  report.push('## 3. Sitemap 驗證');
  report.push('');
  const sm = await fetch(`${BASE}/sitemap.xml`);
  const urlCount = (sm.body.match(/<url>/g) || []).length;
  const compareCount = (sm.body.match(/<loc>https:\/\/keeply\.work\/(zh-TW\/)?compare/g) || []).length;
  report.push(`- Sitemap status: ${sm.status}`);
  report.push(`- 總 URL 數: ${urlCount}（預期 148）${urlCount === 148 ? ' ✅' : ' ❌'}`);
  report.push(`- Compare 頁數: ${compareCount}（預期 14）${compareCount === 14 ? ' ✅' : ' ❌'}`);
  report.push('');

  // 4. Manual follow-ups
  report.push('## 4. 需 Owner 手動確認');
  report.push('');
  report.push('以下無法從本腳本判斷，請到對應工具查：');
  report.push('');
  report.push('- [ ] **Google 索引數**：到 Google 搜尋 `site:keeply.work/compare/`，看實際索引頁數');
  report.push('  - 預期：2 週後至少 hub + 3-4 個子頁被索引');
  report.push('  - 若 < 5 頁：到 GSC → URL Inspection → Request Indexing 每個未索引的 URL');
  report.push('- [ ] **Bing 索引數**：到 Bing 搜 `site:keeply.work/compare/`');
  report.push('- [ ] **GSC Performance**：最近 14 天的 impressions / clicks / position（依比較頁群）');
  report.push('  - 0 impressions 的頁：H1 / meta title 是否夠具體？');
  report.push('  - 有 impressions 但 0 clicks：meta description 是否吸引人？');
  report.push('- [ ] **Search Console Coverage**：有無 excluded / crawled but not indexed 的 compare 頁');
  report.push('');

  // 5. Suggested next actions
  report.push('## 5. 建議下一步');
  report.push('');
  if (okCount === urls.length && urlCount === 148) {
    report.push('- ✅ 技術面健康。主要看 GSC 數據決定內容調整。');
  }
  report.push('- 若索引率 > 80%：可考慮加內部連結（首頁 nav、相關文章交叉連結）');
  report.push('- 若索引率 < 50%：先查是否有 noindex、robots.txt 阻擋，或 canonical 衝突');
  report.push('- 高 impressions 低 CTR 的頁：A/B 測 meta description');
  report.push('- 零流量的頁：考慮是否 keyword 選錯，或頁面對 search intent 不匹配');
  report.push('');

  // Write report
  const outDir = path.join(ROOT, 'specs', 'website', '028-compare-keeply-hub');
  if (!fs.existsSync(outDir)) {
    console.log(`[followup-028] specs dir not found (${outDir}), writing to _dev/`);
    fs.writeFileSync(path.join(__dirname, `_followup-028-${today}.md`), report.join('\n'), 'utf8');
  } else {
    const outPath = path.join(outDir, `_followup-${today}.md`);
    fs.writeFileSync(outPath, report.join('\n'), 'utf8');
    console.log(`[followup-028] report written: ${outPath}`);
  }

  console.log(`[followup-028] ${okCount}/${urls.length} URLs OK, sitemap ${urlCount} URLs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
