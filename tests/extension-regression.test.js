const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(file, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const html = read('popup.html');
const popup = read('popup.js');
const library = read('library.js');
const worker = read('service-worker.js');
const todo = read('TODO.md');

function pngDimensions(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.readUInt32BE(0), 0x89504e47, `${file} must be a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('release metadata is aligned with the 3.3.1 milestone', () => {
  assert.equal(manifest.version, '3.3.1');
  assert.match(todo, /## 3\.1\.0 asset management and deduplication/);
  const milestone = todo.split('## 3.1.0 asset management and deduplication')[1].split('## 3.2.0 release quality and validation')[0];
  assert.doesNotMatch(milestone, /- \[ \]/);
  assert.match(todo, /## 3\.0\.0 multi-page collection workflows/);
  assert.match(read('README.md'), /current webpage or multiple tabs/);
  // The title of the acceptance log drifted to 3.2.2 while the file already carried
  // 3.3.x records, because nothing checked it. Keep it pinned to the manifest.
  const qaTitle = read('QA.md').split('\n')[0];
  assert.match(qaTitle, new RegExp(`^# Image Collector ${manifest.version.replace(/\./g, '\\.')} `), `QA.md title must name ${manifest.version}, saw "${qaTitle}"`);
  assert.match(qaTitle, /验收清单/);
});

test('3.1.0 asset management contracts are wired', () => {
  for (const marker of ['hashBlob', 'perceptualHash', 'listDuplicateGroups', 'listSimilarGroups', 'cleanupImages', 'analyzeImageBlob']) assert.match(library, new RegExp(`function ${marker}`));
  for (const id of ['libraryDuplicateScope', 'duplicateStrategy', 'similarThreshold', 'duplicateGroupList', 'previewDetails', 'selectLoadedLibrary', 'bulkRemoveTag', 'cleanupDuplicates']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(popup, /renderDuplicateGroups/);
  assert.match(popup, /renderPreviewDetails/);
});

test('3.0.0 icon assets are present, referenced, and readable at Chrome sizes', () => {
  const svg = read('icons/icon.svg');
  assert.match(svg, /viewBox="0 0 128 128"/);
  assert.match(svg, /#F45C3D/);
  for (const [size, file] of Object.entries(manifest.icons)) {
    assert.equal(fs.existsSync(file), true, `${file} is missing`);
    assert.deepEqual(pngDimensions(file), { width: Number(size), height: Number(size) });
  }
  assert.deepEqual(manifest.action.default_icon, manifest.icons);
});

test('manifest local entry points exist and shortcut defaults are distinct', () => {
  for (const file of [manifest.background?.service_worker, manifest.side_panel?.default_path]) {
    assert.equal(typeof file, 'string');
    assert.equal(fs.existsSync(file), true, `${file} is missing`);
  }
  const defaults = Object.values(manifest.commands || {}).map((command) => command.suggested_key?.default).filter(Boolean);
  assert.equal(new Set(defaults).size, defaults.length);
});

test('scan-limit control is wired to runtime state', () => {
  assert.match(read('popup.html'), /id="scanLimit"/);
  assert.match(popup, /scanLimit: \$\('#scanLimit'\)/);
  assert.match(popup, /on\(els\.scanLimit, 'change'/);
});

test('loading and progress recovery UI contracts remain wired', () => {
  for (const id of ['scanStats', 'loadingState', 'progressMetrics', 'taskList', 'retryPreview']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const marker of ['withTimeout', 'updateScanStats', 'updateDownloadMetrics', 'recoverTaskState', 'scheduleTaskRefresh']) {
    assert.match(popup, new RegExp(`function ${marker}`));
  }
});

test('background task recovery and request timeouts are implemented', () => {
  assert.match(library, /recoverInterruptedDownloads/);
  assert.match(library, /completedUrls/);
  assert.match(worker, /recoverDownloadTasks/);
  assert.match(worker, /job\.completedUrls\.add/);
  assert.match(worker, /IMAGE_REQUEST_TIMEOUT_MS/);
  assert.match(worker, /METADATA_REQUEST_TIMEOUT_MS/);
  assert.match(worker, /TimeoutError/);
});

test('3.0.0 worker contracts include shortcuts, collection menus, and page/date ZIP layouts', () => {
  for (const marker of ['SHORTCUT_COMMANDS', 'onCommand', 'sendShortcutToPanel', 'pendingShortcut', 'collectionsChanged', 'handleContextSaveCollection', 'collectionItemPrefix', 'pageFolderFor', "layout === 'domain-page'", "layout === 'domain-date'"]) {
    assert.match(worker, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(worker, /response\?\.handled === true/);
  assert.match(worker, /MAX_ZIP_IMAGES/);
  assert.match(worker, /MAX_ZIP_BYTES/);
  assert.match(worker, /MAX_ZIP_DURATION_MS/);
  assert.match(worker, /Unexpected content type/);
  assert.match(worker, /Image exceeds ZIP size limit/);
  assert.match(worker, /function readResponseBytes/);
  assert.match(worker, /invalid-content-type/);
  assert.match(popup, /sendResponse\(\{ handled: handleShortcutCommand/);
  // The side-panel key must go through the reserved _execute_action command:
  // sidePanel.open() can only open, never close, so a custom command cannot
  // toggle. Chrome's action toggles because openPanelOnActionClick is enabled.
  assert.match(manifest.commands['_execute_action'].suggested_key.default, /^Ctrl\+Shift\+J$/);
  assert.equal(manifest.commands['open-collector'].suggested_key, undefined);
  assert.match(worker, /setPanelBehavior\(\{ openPanelOnActionClick: true \}\)/);
});

test('scan history remains compatible with pre-3.0 records', () => {
  assert.match(library, /const imageIds = Array\.isArray\(scan\.imageIds\)/);
  assert.match(popup, /Scans saved before page signatures were introduced/);
  assert.match(popup, /previous\.get\(url\) !== null/);
});

test('3.0.0 multi-page scanning and incremental metadata reuse are wired', () => {
  for (const marker of ['targetTabsForScope', 'getTabsForScan', 'scanOneTab', 'pageRecords', 'scanPageDelta', 'scanReusableUrls', 'reusableUrls', 'getScanImages']) {
    assert.match(popup, new RegExp(marker));
  }
  assert.match(library, /metadata\.reuseUrls/);
  assert.match(library, /incremental: metadata\.incremental/);
  assert.match(library, /imageSnapshots/);
  assert.match(library, /scan\.imageSnapshots/);
  assert.match(popup, /selectedTabIds: \[\]/);
  assert.match(popup, /selectedTabIds: \[\.\.\.state\.selectedTabIds\]/);
  assert.match(popup, /currentIsPlaceholder/);
  assert.match(popup, /tabListRefreshToken/);
  for (const id of ['multiPagePanel', 'tabSelectionList', 'scanMultiPage', 'exportMarkdown', 'exportHtml', 'exportContactSheet']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('the 2.7.0 checklist has no unfinished entries', () => {
  const section = todo.split('## 2.7.0 stability and task reliability')[1].split('## 2.8.0')[0];
  assert.doesNotMatch(section, /- \[ \]/);
});

test('the 2.8.0 smart-collection UI and persistence contracts are wired', () => {
  for (const id of ['smartCollectionEditor', 'smartConditionList', 'smartCollectionList', 'librarySizeDistribution', 'libraryAspectDistribution']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const marker of ['normalizeSmartCollections', 'matchesSmartRule', 'renderSmartCollectionManager', 'updateSmartRulePreview', 'renderLibraryMetricDistribution', 'applyLibraryMetricPreset', 'matchesSharedMetricFilters']) {
    assert.match(popup, new RegExp(`function ${marker}`));
  }
  assert.match(popup, /smartCollectionsVersion/);
  assert.match(popup, /version: 2/);
});

test('the 2.9.0 focused-workspace UI contracts are wired', () => {
  for (const id of ['filterPanel', 'filterActiveCount', 'resultsTitle', 'selectionToolsLabel', 'downloadOptionsLabel']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<details id="filterPanel" class="filter-panel"/);
  assert.match(html, /<details class="download-options">/);
  assert.match(html, /class="icon-button scan-action"/);
  for (const marker of ['function updateFilterSummary', 'activeFilters', 'allImagesFilter', 'resultsTitle', 'downloadOptions']) {
    assert.match(popup, new RegExp(marker));
  }
});

test('the 2.9.0 checklist has no unfinished entries', () => {
  const section = todo.split('## 2.9.0 focused primary workspace')[1].split('## 3.0.0')[0];
  assert.doesNotMatch(section, /- \[ \]/);
});

test('the 3.0.0 checklist has no unfinished entries', () => {
  const section = todo.split('## 3.0.0 multi-page collection workflows')[1].split('## 3.1.0')[0];
  assert.doesNotMatch(section, /- \[ \]/);
});

test('the 3.2.0 checklist has no unfinished entries', () => {
  // The last 3.2.0 item was the manual shortcut verification; it is now recorded
  // as done, so the milestone is closed and must stay closed.
  const section = todo.split('## 3.2.0 release quality and validation')[1].split('## 3.2.1')[0];
  assert.doesNotMatch(section, /- \[ \]/);
});

test('milestone checklists stay in sync across languages and ship their deliverables', () => {
  const milestones = [
    // [heading, next heading, closed?] — a closed milestone must have no unfinished items
    ['## 3.2.0 release quality and validation', '## 3.2.1', true],
    ['## 3.2.1 metadata coverage and index cleanup', '## 3.2.2', true],
    ['## 3.2.2 side panel shortcut reliability', '## 3.3.0', true],
    ['## 3.3.0 silent truncation cleanup and CI', '## 3.3.1', true],
    ['## 3.3.1 interface language completeness', '## 3.4.0', true],
    ['## 3.4.0 primary view layout restructure', null, false],
  ];
  const tally = (text) => ({
    total: (text.match(/^- \[[ x]\]/gm) || []).length,
    unfinished: (text.match(/^- \[ \]/gm) || []).length,
  });
  for (const [heading, next, closed] of milestones) {
    const tail = todo.split(heading)[1];
    assert.ok(tail, `${heading} must exist in TODO.md`);
    const section = next ? tail.split(next)[0] : tail;
    const [chinese, english] = section.split('### English');
    assert.ok(chinese && english, `${heading} must document both languages`);
    assert.ok(tally(chinese).total > 0, `${heading} must list tasks`);
    assert.deepEqual(tally(chinese), tally(english), `${heading} task states must match across languages`);
    if (closed) assert.equal(tally(chinese).unfinished, 0, `${heading} is released and must stay closed`);
  }
  assert.equal(fs.existsSync('scripts/package-extension.sh'), true, 'the packaging script must exist');
  assert.match(read('README.md'), /scripts\/package-extension\.sh/);
});

test('metadata inspection covers the scan ceiling instead of stopping at 300', () => {
  // 3.2.1: one HEAD request per image, so the ceiling must cover every scan-limit
  // choice and must be declared identically in the popup and the service worker.
  const ceiling = (source) => Number((source.match(/MAX_METADATA_INSPECTIONS\s*=\s*(\d+)/) || [])[1]);
  assert.equal(ceiling(popup), 1000, 'popup.js must declare MAX_METADATA_INSPECTIONS');
  assert.equal(ceiling(worker), ceiling(popup), 'popup and worker ceilings must match');
  assert.doesNotMatch(popup, /state\.images\.slice\(0, 300\)/);
  assert.doesNotMatch(worker, /images\.slice\(0, 300\)/);
  assert.match(popup, /metadataTruncated/);
  assert.match(popup, /scanMetadataTruncated/);
  assert.match(worker, /METADATA_INSPECT_BUDGET_MS/);
});

test('favorite filtering never queries the boolean index', () => {
  // favorite is a boolean; booleans are not valid IndexedDB keys, so the
  // byFavorite index is unusable. Filtering must stay in memory and the index
  // must be dropped from existing databases.
  // Strip line comments first so explanatory text cannot satisfy the assertion.
  const code = library.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /IDBKeyRange\.only\(true\)/);
  assert.doesNotMatch(code, /\.index\('byFavorite'\)/);
  assert.doesNotMatch(code, /createIndex\('byFavorite'/);
  assert.match(code, /deleteIndex\('byFavorite'\)/);
  assert.match(code, /if \(options\.favoriteOnly && !record\.favorite\) return false;/);
  assert.match(code, /async function countFavorites\(\)/);
});

test('the shortcut handler opens the panel before any await', () => {
  // A keyboard command's user gesture expires across async gaps, so awaiting
  // tabs.query before sidePanel.open() makes open() reject with
  // "may only be called in response to a user gesture" — and the old code then
  // swallowed that error with `catch { return; }`, leaving the shortcut inert.
  const start = worker.indexOf('chrome.commands?.onCommand.addListener');
  assert.ok(start > -1, 'the command listener must exist');
  // Strip line comments so prose about awaiting cannot satisfy the ordering check.
  const body = worker.slice(start, worker.indexOf('\n});', start)).replace(/^\s*\/\/.*$/gm, '');
  const openAt = body.indexOf('openCollectorPanelForShortcut(');
  const firstAwait = body.indexOf('await ');
  assert.ok(openAt > -1, 'the listener must open the panel through openCollectorPanelForShortcut');
  assert.ok(firstAwait === -1 || openAt < firstAwait, 'the panel must be opened before the first await');
  assert.doesNotMatch(body, /catch \{ return; \}/, 'the panel-open failure must not be swallowed');
  assert.match(body, /recordShortcutDiagnostic/);
  assert.match(worker, /function openCollectorPanelForShortcut\(tabsPromise\)/);
  assert.match(worker, /function recordShortcutDiagnostic\(/);
  assert.match(worker, /function rememberActiveTab\(\)/);
  assert.match(worker, /chrome\.tabs\?\.onActivated\?\.addListener\(rememberActiveTab\)/);
  assert.match(worker, /shortcutDiagnostic/);
});

test('user-visible collection caps are named and surfaced', () => {
  // 3.3.0: a cap that silently hides content is a defect. Every cap must be a named
  // constant and must ship a visible notice instead of dropping data quietly.
  assert.match(popup, /const DUPLICATE_GROUP_PAGE_SIZE = 30;/);
  assert.match(popup, /const SMART_COLLECTION_LIMIT = 50;/);
  assert.doesNotMatch(popup, /groups\.slice\(0, 30\)/, 'duplicate groups must not use a bare 30 cap');
  assert.match(popup, /groups\.slice\(0, state\.duplicateGroupLimit\)/);
  assert.match(popup, /state\.duplicateGroupLimit \+= DUPLICATE_GROUP_PAGE_SIZE/);
  assert.match(popup, /duplicateGroupsHidden/, 'hidden duplicate groups must be reported');
  assert.match(popup, /slice\(0, SMART_COLLECTION_LIMIT\)/, 'smart collections must use the named limit');
  assert.match(popup, /smartCollectionLimit/, 'the smart collection guard must be surfaced');
  assert.match(popup, /smartCollectionLimitTruncated/, 'import truncation must be reported');
});

test('background actions without a visible surface report failures', () => {
  // 3.3.0: the context-menu "save to a collection" action used to return silently.
  assert.match(worker, /function recordDiagnostic\(storageKey, stage, message/);
  assert.match(worker, /recordContextMenuDiagnostic\('read-collections'/);
  assert.match(worker, /recordContextMenuDiagnostic\('write-collection'/);
  assert.doesNotMatch(
    worker.slice(worker.indexOf('async function handleContextSaveCollection'), worker.indexOf('async function runDownloadJob')),
    /catch \{ return; \}/,
    'a failed collection read must not return silently'
  );
  assert.match(popup, /message\?\.type === 'diagnostic'/);
  assert.match(popup, /actionDidNotComplete/);
});

test('README Chinese and English halves stay in sync', () => {
  // 3.3.0: the two halves drifted apart repeatedly — the English side lost whole
  // groups and the Chinese side accumulated English headings, bullets, and whole
  // blocks. Structure and language purity are what must stay aligned; the two
  // halves legitimately use different mixes of bullets and prose inside a group.
  const readme = read('README.md');
  const [chinese, english] = readme.split(/^## English$/m);
  assert.ok(chinese && english, 'README.md must keep a top-level English half');
  const sections = (text) => text.split(/^### /m).slice(1).map((part) => part.slice(part.indexOf('\n')));
  const zh = sections(chinese);
  const en = sections(english);
  assert.ok(zh.length > 0, 'README must document its sections');
  assert.equal(zh.length, en.length, `README section count differs: ${zh.length} vs ${en.length}`);
  const count = (text, pattern) => (text.match(pattern) || []).length;
  zh.forEach((body, index) => {
    const position = index + 1;
    assert.equal(count(body, /^#### /gm), count(en[index], /^#### /gm), `sub-section count differs in section ${position}`);
    assert.equal(count(body, /^\d+\. /gm), count(en[index], /^\d+\. /gm), `numbered steps differ in section ${position}`);
    assert.equal(count(body, /^```/gm), count(en[index], /^```/gm), `code fences differ in section ${position}`);
  });
  // A section written in the wrong half is the failure mode that started this cleanup.
  const isChineseEntry = (line) => /[\u4e00-\u9fff]/.test(line);
  const entries = (bodies, pattern) => bodies.flatMap((body) => body.match(pattern) || []);
  const leakedIntoEnglish = entries(en, /^\s*(?:- .*|#### .*)$/gm)
    .filter(isChineseEntry)
    // the language-switch button label `中` is a literal UI string, not leaked prose
    .filter((line) => !/`EN` \/ `中`/.test(line));
  assert.deepEqual(leakedIntoEnglish, [], 'the English half must not contain Chinese entries');
  const leakedIntoChinese = entries(zh, /^\s*(?:- .*|#### .*)$/gm)
    .filter((line) => !isChineseEntry(line))
    // format names are intentionally identical in both halves
    .filter((line) => !/^- (JPEG|PNG|WEBP|AVIF)$/.test(line.trim()));
  assert.deepEqual(leakedIntoChinese, [], 'the Chinese half must not contain English entries');
});

test('every t() key is defined in both languages', () => {
  // 3.3.1: t() falls back to Chinese, so a key missing from the English table
  // silently renders Chinese copy in the English interface. Requiring two
  // definitions (one per language) catches both missing and half-added keys.
  const used = new Set([...popup.matchAll(/\bt\('([a-zA-Z0-9_]+)'/g)].map((match) => match[1]));
  assert.ok(used.size > 300, `expected the popup to use many translation keys, saw ${used.size}`);
  const definitions = (key) => (popup.match(new RegExp(`(^|[^a-zA-Z0-9_])${key}:`, 'g')) || []).length;
  const thin = [...used].filter((key) => definitions(key) < 2);
  assert.deepEqual(thin, [], 'these keys are used by t() but are not defined in both languages');
});

test('user-visible copy outside the translation tables stays translated', () => {
  // 3.3.1: the popup previously carried hardcoded Chinese for group headings,
  // cleanup dialogs, prompts, details labels, and placeholders.
  const lines = popup.split('\n');
  const skip = new Set();
  lines.forEach((line, index) => {
    const base = /const TRANSLATIONS = \{/.test(line);
    const assigned = /Object\.assign\(TRANSLATIONS\.(zh|en)/.test(line);
    if (!base && !assigned) return;
    const closer = base ? /^\};$/ : /^\}\);$/;
    for (let i = index; i < lines.length; i += 1) {
      skip.add(i);
      if (closer.test(lines[i])) break;
    }
  });
  const ALLOWED = [
    // the collector is injected into the page, where t() does not exist
    /options\.language === 'en' \?/,
    // the language button intentionally shows the other language's label
    /setText\(els\.language, state\.language === 'en' \?/,
  ];
  const leaked = [];
  lines.forEach((line, index) => {
    if (skip.has(index)) return;
    if (!/[\u4e00-\u9fff]/.test(line)) return;
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (ALLOWED.some((pattern) => pattern.test(line))) return;
    leaked.push(`L${index + 1}: ${line.trim().slice(0, 80)}`);
  });
  assert.deepEqual(leaked, [], 'Chinese copy must live in the translation tables');
});

test('data-layer failures are localised at the UI boundary', () => {
  // 3.3.1: library.js carries Chinese developer diagnostics. They must be tagged so
  // the UI shows a localised message instead of leaking the raw text.
  assert.match(library, /function dataError\(code, message, cause\)/);
  assert.match(library, /error\.isDataError = true/);
  assert.match(library, /getCacheWriteState/);
  const tagged = (library.match(/dataError\(/g) || []).length;
  assert.ok(tagged >= 14, `expected every library error site to be tagged, saw ${tagged} occurrences`);
  assert.match(popup, /function describeError\(error, fallbackKey\)/);
  for (const call of [
    "describeError(error, 'historyActionFailed')",
    "describeError(error, 'downloadFailed')",
    "describeError(error, 'downloadFailedRetry')",
    "describeError(error, 'pageAccessError')",
  ]) {
    assert.ok(popup.includes(call), `${call} must be used at the UI boundary`);
  }
  assert.doesNotMatch(popup, /showToast\(error\??\.message \|\| t\('historyActionFailed'\)\)/);
});

test('cache write failures are recorded and surfaced', () => {
  // 3.3.1: quota and oversized-entry failures used to look exactly like a cache miss.
  assert.match(library, /noteCacheWriteFailure\('too-large'\)/);
  assert.match(library, /noteCacheWriteFailure\('invalid'\)/);
  assert.match(library, /noteCacheWriteFailure\(cacheFailureReason\(error\)\)/);
  assert.match(popup, /function cacheWriteFailureText\(cacheState\)/);
  assert.match(popup, /cacheWriteFailedQuota/);
  assert.match(worker, /if \(!cached\) recordDiagnostic\('cacheWriteDiagnostic', 'zip-cache'/);
  // the ZIP path must not claim an image is cached when the write failed
  assert.match(worker, /cacheState: cached \? 'cached' : 'uncached'/);
  assert.doesNotMatch(worker, /mime: contentType, cacheState: 'cached' \}\)\.catch\(\(\) => \{\}\);\n\s*const filename/);
});

test('the README project structure lists every top-level path', () => {
  // 3.3.1: .github/ arrived with the CI work but was never documented, and nothing
  // compared the tree against the repository. Both halves must list the same paths.
  const readme = read('README.md');
  const [chinese, english] = readme.split(/^## English$/m);
  assert.ok(chinese && english, 'README.md must keep a top-level English half');
  const treeOf = (half) => {
    const blocks = [...half.matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1]);
    return blocks.find((block) => block.includes('manifest.json')) || '';
  };
  assert.ok(treeOf(chinese).includes('manifest.json'), 'the Chinese structure block must exist');
  assert.ok(treeOf(english).includes('manifest.json'), 'the English structure block must exist');

  const root = path.join(__dirname, '..');
  const entries = fs.readdirSync(root, { withFileTypes: true })
    .map((entry) => entry.name)
    .filter((name) => name !== 'dist' && name !== '.git');
  assert.ok(entries.length > 5, `expected a populated repository, saw ${entries.length} entries`);

  const missing = entries.filter((name) => {
    const pattern = new RegExp(`[├└]── ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?(\\s|$)`);
    return !pattern.test(treeOf(chinese)) || !pattern.test(treeOf(english));
  });
  assert.deepEqual(missing, [], 'these top-level paths are missing from a README project structure');
});

test('text scale follows the active tab zoom without scaling the whole panel', () => {
  assert.match(popup, /function applyBrowserTextScale/);
  assert.match(popup, /function readBrowserDefaultTextScale/);
  assert.match(popup, /chrome\.scripting\.executeScript/);
  assert.match(popup, /browserTextScaleTabId/);
  assert.match(popup, /chrome\.tabs\.getZoom/);
  assert.match(popup, /onZoomChange/);
  assert.match(read('popup.css'), /html \{[^}]*font-size: medium/s);
  assert.match(read('popup.css'), /--browser-text-scale: 1/);
  assert.match(read('popup.css'), /font-size: calc\(10px \* var\(--browser-text-scale, 1\)\)/);
  assert.doesNotMatch(read('popup.css'), /body \{[^}]*zoom:/s);
});
