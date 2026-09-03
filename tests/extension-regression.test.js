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

test('release metadata is aligned with the 2.9.0 milestone', () => {
  assert.equal(manifest.version, '2.9.0');
  assert.match(todo, /## 2\.9\.0 focused primary workspace/);
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

test('text scale follows the active tab zoom without scaling the whole panel', () => {
  assert.match(popup, /function applyBrowserTextScale/);
  assert.match(popup, /chrome\.tabs\.getZoom/);
  assert.match(popup, /onZoomChange/);
  assert.match(read('popup.css'), /--browser-text-scale: 1/);
  assert.match(read('popup.css'), /font-size: calc\(10px \* var\(--browser-text-scale, 1\)\)/);
  assert.doesNotMatch(read('popup.css'), /body \{[^}]*zoom:/s);
});
