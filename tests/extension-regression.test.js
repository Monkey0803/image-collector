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

test('release metadata is aligned with the 2.8.0 milestone', () => {
  assert.equal(manifest.version, '2.8.0');
  assert.match(todo, /## 2\.8\.0 smart collections and visual filters/);
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

test('the 2.8.0 checklist has no unfinished entries', () => {
  const section = todo.split('## 2.8.0 smart collections and visual filters')[1].split('## 2.9.0')[0];
  assert.doesNotMatch(section, /- \[ \]/);
});
