// One-shot script: sync 20 locales × {.js, .json} for iter2 terms.html changes.
// - Delete orphan keys: terms.s7.p1, terms.s3.7.p1
// - Add 16 new keys (title + html for 20_1..20_4, 15_1..15_4)
// - en and zh-TW get native translations; other 18 langs get EN fallback + TODO marker
// - Also backfill the iter2 base updates (terms.updated, terms.toc.s7, terms.toc.s3c,
//   terms.s1.p1, terms.s7.title, terms.s3.7.title, terms.s10.p1, terms.s10.p2) into
//   every .js file (they were previously only applied to en.json / zh-TW.json).
//
// Usage: node _dev/iter2-i18n-sync.js

const fs = require('fs');
const path = require('path');

const LOCALES = [
  'zh-TW','zh-CN','en','ja','ko',
  'de','fr','es','pt','it',
  'nl','pl','cs','hu','tr',
  'fi','sv','no','da'
];
// Note: The runtime i18n-loader.js lists 19 locales (no 'ar'/'hi'/'id'/'th'/'vi'/'ru').
// We only touch locales that actually exist in i18n/.

const TODO_MARK = '// TODO: translate new terms.s7.20_* and terms.s3.7.15_* keys from English, added 2026-04-21';
const TODO_JSON_KEY = '__todo_terms_iter2__';
const TODO_JSON_VAL = 'TODO: translate new terms.s7.20_* and terms.s3.7.15_* keys from English, added 2026-04-21';

// ---------- Translations ----------
// EN is the canonical source. zh-TW is the native translation.
// 18 other locales fall back to EN (with a TODO flag).

const EN = {
  'terms.updated': 'Last updated: April 21, 2026',
  'terms.toc.s7': '7. Data Privacy and Activity Logs',
  'terms.toc.s3c': '3.7 License Scope',
  'terms.s1.p1': 'Keeply is a desktop application that provides visual version control for project files. It runs locally on your computer and stores all project data on your local device or NAS. Keeply does not operate a user account service — software activation is handled through a License Key mechanism, with the license bound to devices you explicitly designate.',
  'terms.s7.title': '7. Data Privacy and Activity Logs',
  'terms.s3.7.title': '3.7 License Scope',
  'terms.s10.p1': 'This Agreement takes effect from your first use of the Software and continues until terminated. You may terminate this Agreement at any time by deactivating the software license and removing all local Keeply data (including but not limited to project repositories, activity logs, shadow backups, and license files). Deactivation methods include: (a) using the "Deactivate License and Remove Local Data" function within the Keeply application; or (b) uninstalling Keeply from your system and manually deleting the local Keeply data directory.',
  'terms.s10.p2': 'We may revoke your license if you breach this Agreement. Upon termination, Perpetual License holders and Perpetual Fallback License holders retain the right to use their respective versions, but will no longer receive updates.',

  'terms.s7.20_1.title': '20.1 Keeply Server-Side Commitment',
  'terms.s7.20_1.html': '<p>Your use of the Software is also governed by our <a href="privacy.html" class="text-brand-600 hover:underline">Privacy Policy</a>. Keeply\'s servers do not access, collect, store, or transmit any of the following:</p><ul class="list-disc ml-5 space-y-1"><li>Your project files (any files within working directories)</li><li>Project version snapshots (Git objects stored under <code>.git</code> by Keeply)</li><li>Activity logs (hash chain events stored in <code>~/.keeply/activity.db</code>)</li><li>Backup location contents (any data under your designated USB / NAS / Gitea paths)</li><li>Shadow backup contents (snapshots under <code>.git/keeply/shadow/</code>)</li></ul><p>All of the above exists only on your local device and locations you explicitly designate; none is ever transmitted to Keeply servers.</p>',

  'terms.s7.20_2.title': '20.2 Local Activity Log',
  'terms.s7.20_2.html': '<p>Keeply maintains a local activity log on your device at <code>~/.keeply/activity.db</code> (SQLite database). This log is used for:</p><ul class="list-disc ml-5 space-y-1"><li>Cross-version traceability: reviewing past save, restore, and export events</li><li>Crash recovery: rebuilding working state after unexpected termination</li><li>Team plan audit features (only when Team plan is active)</li></ul><p>The activity log <strong>records only event types and timestamps</strong>, never:</p><ul class="list-disc ml-5 space-y-1"><li>File contents</li><li>Full file path strings (only minimal relative paths needed for traceability)</li><li>Your in-editor operations</li></ul>',

  'terms.s7.20_3.title': '20.3 Backup Location Activity Log Copy (Dual-write Behavior)',
  'terms.s7.20_3.html': '<p>When you configure a backup location (e.g., USB device, NAS, Docker Gitea instance), Keeply creates an activity log copy at <code>{backup_path}/.keeply-activity/{machine_id}.jsonl</code> during sync.</p><p><code>{machine_id}</code> is a <strong>hashed device identifier</strong> (HMAC-SHA256 derived value) and <strong>does not contain</strong> your raw MAC address, drive serial, or other unprocessed device characteristics.</p><p>This copy serves the same purposes as the local activity log in §20.2 (cross-machine traceability / crash recovery / Team audit).</p><p><strong>If your backup location is shared with others</strong> (e.g., company NAS, Docker Gitea organizational instance), persons with access to that location <strong>may observe</strong> this copy\'s existence and contents. If this is a concern, you can disable this behavior in "Settings → Activity Log → Backup Location Sync".</p><p>Disabling reduces cross-machine traceability capability, but the local activity log continues to operate.</p>',

  'terms.s7.20_4.title': '20.4 Keeply Server-Side Necessary Services',
  'terms.s7.20_4.html': '<p>While Keeply\'s servers do not receive your project or activity contents, the following functions involve server-side communication with Keeply or third-party services:</p><ul class="list-disc ml-5 space-y-1"><li><strong>License validation</strong> (via Keygen.sh, USA): transmits hashed device identifiers to verify license validity</li><li><strong>Payment processing</strong> (via Paddle, UK/Ireland): handles subscriptions, refunds, and billing matters</li><li><strong>Update checks</strong>: periodic queries for new software versions</li></ul><p>Details of these services\' data processing are covered in our <a href="privacy.html" class="text-brand-600 hover:underline">Privacy Policy</a>.</p>',

  'terms.s3.7.15_1.title': '15.1 Core Restriction',
  'terms.s3.7.15_1.html': '<p>Each license is granted to a single legal entity. This license may not be shared, pooled, or used for the benefit of unrelated third parties or separate legal entities.</p>',

  'terms.s3.7.15_2.title': '15.2 Permitted Uses (Exemptions)',
  'terms.s3.7.15_2.html': '<p>The following situations fall within the scope of single-legal-entity license permitted use:</p><ul class="list-disc ml-5 space-y-1"><li><strong>(a) Employees and Contractors</strong>: employees, independent contractors, and agents of the licensed legal entity, to the extent they are providing services to that entity</li><li><strong>(b) Affiliates</strong>: Affiliates of the licensed legal entity (as defined in §15.4) may share a single license, provided all use remains within the core restriction</li><li><strong>(c) Individual Freelancers</strong>: an individual natural person licensee using the software while providing services to their multiple clients (the licensee remains the sole user; this shall not be deemed multi-entity sharing)</li></ul>',

  'terms.s3.7.15_3.title': '15.3 Audit Rights',
  'terms.s3.7.15_3.html': '<p>Upon reasonable written notice, we reserve the right to request documentation from the licensee to verify license compliance, including:</p><ul class="list-disc ml-5 space-y-1"><li>Business registration documents (e.g., Taiwan Unified Business Number 統一編號, EU VAT ID, UK Companies House number, US EIN)</li><li>Authorized representative\'s name and title</li><li>In the event of reasonable suspicion of breach, explanation of the scope of licensed use</li></ul><p>Absent reasonable suspicion of breach of this Agreement, we will not exercise audit rights more than <strong>once per twelve (12) months</strong>.</p><p>The existence of this clause does not constitute a waiver of any past non-exercise of audit rights.</p>',

  'terms.s3.7.15_4.title': '15.4 Affiliate Definition',
  'terms.s3.7.15_4.html': '<p>In this Agreement, "Affiliate" means:</p><ul class="list-disc ml-5 space-y-1"><li>An entity that directly or indirectly holds 50% or more of the voting shares / interests of the licensed legal entity</li><li>An entity of which the licensed legal entity directly or indirectly holds 50% or more of the voting shares / interests</li><li>An entity under common control with the licensed legal entity (i.e., common shareholders each hold 50% or more of voting shares in both entities)</li></ul>',
};

const ZH_TW = {
  'terms.updated': '最後更新日期：2026 年 4 月 21 日',
  'terms.toc.s7': '7. 資料隱私與活動紀錄',
  'terms.toc.s3c': '3.7 授權範圍',
  'terms.s1.p1': 'Keeply 是一款為專案檔案提供視覺化版本控制的桌面應用程式。它在你的電腦上本地運行，並將所有專案資料儲存在你的本地裝置或 NAS 上。Keeply 本身不提供使用者帳戶服務——軟體啟用透過授權碼（License Key）機制，授權綁定至你明確指定的裝置。',
  'terms.s7.title': '7. 資料隱私與活動紀錄',
  'terms.s3.7.title': '3.7 授權範圍',
  'terms.s10.p1': '本協議自你首次使用本軟體起生效，直至終止。你可隨時解除本軟體的授權並移除本機所有 Keeply 資料（包括但不限於專案儲存庫、活動紀錄、影子備份、授權檔），以終止本協議。解除授權的方式包括：(a) 在 Keeply 應用程式內執行「解除授權並移除本機資料」功能；或 (b) 從系統解除安裝 Keeply 軟體並手動刪除本機 Keeply 資料目錄。',
  'terms.s10.p2': '我們可在你違約時撤銷你的授權。終止後，永久授權（Perpetual License）持有者和永久回退授權（Perpetual Fallback License）持有者保留使用其各自版本的權利，但將不再收到任何更新。',

  'terms.s7.20_1.title': '20.1 Keeply 伺服器端承諾',
  'terms.s7.20_1.html': '<p>你對本軟體的使用亦受我們的<a href="privacy.html" class="text-brand-600 hover:underline">隱私權政策</a>約束。Keeply 伺服器不存取、收集、儲存或傳輸以下任何內容：</p><ul class="list-disc ml-5 space-y-1"><li>你的專案檔案（工作目錄內的任何檔案）</li><li>專案版本快照（Keeply 儲存於 <code>.git</code> 底下的 Git object）</li><li>活動紀錄（Keeply 儲存於 <code>~/.keeply/activity.db</code> 的 hash chain 事件）</li><li>備份位置內容（你指定的 USB / NAS / Gitea 路徑底下所有資料）</li><li>影子備份內容（<code>.git/keeply/shadow/</code> 底下的快照）</li></ul><p>上述所有內容僅存在於你的本機裝置與你明確指定的備份位置，從不傳送至 Keeply 伺服器。</p>',

  'terms.s7.20_2.title': '20.2 本機活動紀錄（Activity Log）',
  'terms.s7.20_2.html': '<p>Keeply 會在你的本機裝置建立一份活動紀錄，記錄於 <code>~/.keeply/activity.db</code>（SQLite 資料庫）。此紀錄用於：</p><ul class="list-disc ml-5 space-y-1"><li>跨版本追溯：讓你能審視過往的版本儲存、還原、匯出事件</li><li>崩潰復原：發生當機時協助重建工作狀態</li><li>Team 方案的審計功能（僅限 Team 方案啟用時）</li></ul><p>活動紀錄<strong>僅記錄事件類型與時間戳</strong>，不記錄：</p><ul class="list-disc ml-5 space-y-1"><li>檔案內容</li><li>檔案路徑的完整字串（僅記錄必要的相對路徑以供追溯）</li><li>你在編輯器內的操作</li></ul>',

  'terms.s7.20_3.title': '20.3 備份位置活動紀錄副本（Dual-write Behavior）',
  'terms.s7.20_3.html': '<p>當你設定了備份位置（例如 USB 裝置、NAS、Docker Gitea 實例），Keeply 會在同步時於備份位置建立一份活動紀錄副本，路徑為 <code>{backup_path}/.keeply-activity/{machine_id}.jsonl</code>。</p><p><code>{machine_id}</code> 為<strong>雜湊化的裝置識別碼</strong>（HMAC-SHA256 衍生值），<strong>不包含</strong>你的 MAC 位址、硬碟序號或其他原始裝置特徵的未處理值。</p><p>此副本的用途與 20.2 的本機活動紀錄相同（跨機器追溯 / 崩潰復原 / Team 方案審計）。</p><p><strong>如果你的備份位置為多人共享位置</strong>（例如公司 NAS、Docker Gitea 組織實例），其他有存取權限的人員<strong>可能看到</strong>此副本的存在與內容。若此為疑慮，你可以在 Keeply 的「設定 → 活動紀錄 → 備份位置同步」中關閉此功能。</p><p>關閉後，跨機器追溯能力將受限，但本機活動紀錄仍會維持運作。</p>',

  'terms.s7.20_4.title': '20.4 Keeply 伺服器端必要服務',
  'terms.s7.20_4.html': '<p>雖然 Keeply 伺服器不接收你的專案與活動內容，但以下功能涉及與 Keeply 或第三方服務的伺服器端通訊：</p><ul class="list-disc ml-5 space-y-1"><li><strong>授權驗證</strong>（透過 Keygen.sh，美國）：傳送雜湊化的裝置識別碼以確認授權有效性</li><li><strong>付款處理</strong>（透過 Paddle，英國/愛爾蘭）：處理訂閱、退款等付款事宜</li><li><strong>更新檢查</strong>：定期查詢是否有新版本</li></ul><p>上述服務的詳細處理資訊請見 <a href="privacy.html" class="text-brand-600 hover:underline">Privacy Policy</a>。</p>',

  'terms.s3.7.15_1.title': '15.1 核心限制',
  'terms.s3.7.15_1.html': '<p>每組授權僅供單一法律實體（Single Legal Entity）使用。本授權不得分享、匯集、或用於為無關的第三方或其他法律實體提供利益。</p>',

  'terms.s3.7.15_2.title': '15.2 允許的使用情境（Exemptions）',
  'terms.s3.7.15_2.html': '<p>下列情境屬於單一法律實體授權範圍內的允許使用：</p><ul class="list-disc ml-5 space-y-1"><li><strong>(a) 受僱員工與承攬人</strong>：被授權法律實體的受僱員工、合約承攬人、代理人，在其為該實體提供服務的範圍內使用</li><li><strong>(b) 關聯企業（Affiliates）</strong>：被授權法律實體的 Affiliate（定義見 15.4），共同使用單一授權，但所有使用仍需符合核心限制</li><li><strong>(c) 個人 Freelancer</strong>：個別自然人授權持有者，為其多位客戶提供服務時使用本軟體（授權持有者本身仍為唯一使用者，此非視為多實體共享）</li></ul>',

  'terms.s3.7.15_3.title': '15.3 保留查核權（Audit Rights）',
  'terms.s3.7.15_3.html': '<p>在合理的書面通知下，我們保留要求被授權方提供下列文件以驗證授權合規性的權利：</p><ul class="list-disc ml-5 space-y-1"><li>事業登記文件（如：台灣統一編號、歐盟 VAT ID、英國 Companies House 註冊號、美國 EIN）</li><li>授權代表姓名與職稱</li><li>在有合理懷疑違反本協議之情事下，授權使用範圍的說明</li></ul><p>除非存在合理懷疑違反本協議之情事，否則我們行使查核權不會超過<strong>每十二（12）個月一次</strong>。</p><p>本條款的存在不構成對過往未行使查核權的棄權（waiver）。</p>',

  'terms.s3.7.15_4.title': '15.4 關聯企業定義（Affiliate Definition）',
  'terms.s3.7.15_4.html': '<p>本協議中「關聯企業」（Affiliate）指的是：</p><ul class="list-disc ml-5 space-y-1"><li>直接或間接持有被授權法律實體 50% 以上有表決權股份 / 權益的實體</li><li>被授權法律實體直接或間接持有其 50% 以上有表決權股份 / 權益的實體</li><li>與被授權法律實體處於同一共同控制關係下的實體（即共同股東持有兩實體各 50% 以上有表決權股份）</li></ul>',
};

const NEW_KEYS = Object.keys(EN);
const NEW_SUBSECTION_KEYS = NEW_KEYS.filter(k => /^terms\.(s7\.20_|s3\.7\.15_)/.test(k));
const ORPHAN_KEYS = ['terms.s7.p1', 'terms.s3.7.p1'];

// ---------- Helpers ----------

function loadDict(locale) {
  // Runtime uses .js — it is the source-of-truth.
  // Prior iter1-pass left .json ahead-of-.js for en/zh-TW; we rebuild both from .js
  // then overlay the iter2 translation map on top.
  const jsPath = path.join('i18n', locale + '.js');
  if (!fs.existsSync(jsPath)) throw new Error('Missing ' + jsPath);
  const src = fs.readFileSync(jsPath, 'utf8');
  // Evaluate in a controlled sandbox: the file sets window.__i18n[locale] = { ... }.
  const sandbox = { window: { __i18n: {} } };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const dict = sandbox.window.__i18n[locale];
  if (!dict) throw new Error('Could not extract dict from ' + jsPath);
  return dict;
}

function writeJson(locale, dict, addTodo) {
  const out = {};
  if (addTodo) out[TODO_JSON_KEY] = TODO_JSON_VAL;
  for (const k of Object.keys(dict)) {
    if (k === TODO_JSON_KEY) continue;
    out[k] = dict[k];
  }
  fs.writeFileSync(
    path.join('i18n', locale + '.json'),
    JSON.stringify(out, null, 2) + '\n',
    'utf8'
  );
}

function writeJs(locale, dict, addTodo) {
  const lines = [];
  lines.push('window.__i18n = window.__i18n || {};');
  lines.push('window.__i18n["' + locale + '"] = {');
  if (addTodo) lines.push('  ' + TODO_MARK);
  const entries = Object.keys(dict).filter(k => k !== TODO_JSON_KEY);
  entries.forEach((k, i) => {
    const comma = i < entries.length - 1 ? ',' : '';
    const v = JSON.stringify(dict[k]);
    const kesc = JSON.stringify(k);
    lines.push('  ' + kesc + ': ' + v + comma);
  });
  lines.push('};');
  fs.writeFileSync(
    path.join('i18n', locale + '.js'),
    lines.join('\n') + '\n',
    'utf8'
  );
}

function applyIter2Updates(dict, translationMap) {
  // Delete orphan keys
  for (const k of ORPHAN_KEYS) delete dict[k];
  // Apply translation map (iter2 base + new 16 keys)
  for (const k of Object.keys(translationMap)) {
    dict[k] = translationMap[k];
  }
  return dict;
}

// ---------- Main ----------

const summary = [];
for (const locale of LOCALES) {
  const dict = loadDict(locale);
  let translationMap;
  let addTodo = false;
  if (locale === 'en') {
    translationMap = EN;
  } else if (locale === 'zh-TW') {
    translationMap = ZH_TW;
  } else {
    translationMap = EN; // fallback to English
    addTodo = true;
  }
  const hadOrphans = ORPHAN_KEYS.some(k => k in dict);
  applyIter2Updates(dict, translationMap);
  writeJson(locale, dict, addTodo);
  writeJs(locale, dict, addTodo);
  summary.push(
    locale.padEnd(6) + ' | orphans-removed=' + hadOrphans
    + ' | todo=' + addTodo
    + ' | keys=' + Object.keys(dict).length
  );
}

console.log('=== iter2 i18n sync complete ===');
summary.forEach(s => console.log(s));
