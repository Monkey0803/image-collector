const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('release metadata is aligned with the 3.2.2 milestone', () => {
  assert.equal(manifest.version, '3.2.2');
  assert.match(todo, /## 3\.1\.0 asset management and deduplication/);
  const milestone = todo.split('## 3.1.0 asset management and deduplication')[1].split('## 3.2.0 release quality and validation')[0];
  assert.doesNotMatch(milestone, /- \[ \]/);
  assert.match(todo, /## 3\.0\.0 multi-page collection workflows/);
  assert.match(read('README.md'), /current webpage or multiple tabs/);
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
    ['## 3.2.0 release quality and validation', '## 3.2.1'],
    ['## 3.2.1 metadata coverage and index cleanup', '## 3.2.2'],
    ['## 3.2.2 side panel shortcut reliability', null],
  ];
  const tally = (text) => ({
    total: (text.match(/^- \[[ x]\]/gm) || []).length,
    unfinished: (text.match(/^- \[ \]/gm) || []).length,
  });
  for (const [heading, next] of milestones) {
    const tail = todo.split(heading)[1];
    assert.ok(tail, `${heading} must exist in TODO.md`);
    const section = next ? tail.split(next)[0] : tail;
    const [chinese, english] = section.split('### English');
    assert.ok(chinese && english, `${heading} must document both languages`);
    assert.ok(tally(chinese).total > 0, `${heading} must list tasks`);
    assert.deepEqual(tally(chinese), tally(english), `${heading} task states must match across languages`);
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
