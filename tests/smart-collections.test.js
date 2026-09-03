const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const popup = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = popup.indexOf(startMarker);
  const end = popup.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return popup.slice(start, end);
}

function createLogicApi() {
  const context = {
    SMART_COLLECTIONS_VERSION: 1,
    SMART_RANGE_FIELDS: ['width', 'height', 'size', 'aspect'],
    SMART_CONDITION_FIELDS: ['width', 'height', 'size', 'aspect', 'format', 'domain', 'source', 'date'],
    SMART_FORMATS: ['jpeg', 'png', 'webp', 'avif', 'other'],
    SMART_DATE_PRESETS: ['today', 'week', 'month', 'older'],
    state: { smartCollections: [] },
    formatCategory: (format) => ['jpeg', 'png', 'webp', 'avif'].includes(format) ? format : 'other',
    sourceCategory: (source) => ['IMG', 'CSS', 'VIDEO', 'RULE'].includes(String(source || '').toUpperCase()) ? String(source).toUpperCase() : 'other',
    t: (key) => key,
    els: {}
  };
  vm.createContext(context);
  vm.runInContext(sourceBetween('function normalizeSmartNumber', 'function syncConfigurationPayload'), context);
  vm.runInContext(sourceBetween('function matchesSmartCollection', 'function switchView'), context);
  vm.runInContext(sourceBetween('function matchesSharedMetricFilters', 'function applyFilters'), context);
  vm.runInContext('this.api = { normalizeSmartCondition, smartConditionHasValue, smartCollectionsConfigSupported, normalizeSmartCollections, matchesSmartCollection, smartConditionMatches, matchesSmartRule, matchesSharedMetricFilters };', context);
  return context.api;
}

const api = createLogicApi();

test('smart rules evaluate AND and OR conditions against real popup logic', () => {
  const png = { width: 1200, height: 800, size: 200 * 1024, format: 'png', domain: 'example.com', source: 'IMG', updatedAt: Date.now() };
  const jpg = { width: 400, height: 400, size: 20 * 1024, format: 'jpeg', domain: 'other.test', source: 'CSS', updatedAt: Date.now() };
  const rule = { logic: 'AND', conditions: [{ field: 'width', min: 1000 }, { field: 'format', value: 'png' }] };
  assert.equal(api.matchesSmartRule(png, rule), true);
  assert.equal(api.matchesSmartRule(jpg, rule), false);
  assert.equal(api.matchesSmartRule(jpg, { logic: 'OR', conditions: [{ field: 'format', value: 'png' }, { field: 'source', value: 'CSS' }] }), true);
});

test('empty smart conditions cannot become an always-true rule', () => {
  assert.equal(api.smartConditionHasValue({ field: 'domain', value: '' }), false);
  assert.equal(api.smartConditionMatches({ domain: 'example.com' }, { field: 'domain', value: '' }), false);
  assert.deepEqual(api.normalizeSmartCollections([{ name: 'Empty', conditions: [{ field: 'domain', value: '' }] }]), []);
});

test('smart collection versions are rejected consistently', () => {
  assert.equal(api.smartCollectionsConfigSupported(1, [{ version: 1 }]), true);
  assert.equal(api.smartCollectionsConfigSupported(0, [{ version: 1 }]), false);
  assert.equal(api.smartCollectionsConfigSupported(1, [{ version: 2 }]), false);
});

test('shared metric matching keeps unknown values for max-only filters', () => {
  const unknown = { width: 0, height: 0, size: 0 };
  assert.equal(api.matchesSharedMetricFilters(unknown, { width: { min: null, max: 1000 }, height: { min: null, max: 1000 }, size: { min: null, max: 100 }, aspectRange: { min: 0.25, max: 5 } }), true);
  assert.equal(api.matchesSharedMetricFilters(unknown, { width: { min: 100, max: null }, aspectRange: { min: 0.25, max: 5 } }), false);
});
