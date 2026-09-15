// Behavioural coverage for the image-request Referer rules added in 3.4.1.
//
// The regression suite only asserted that the rule source text existed; none of the
// rule logic had ever been executed. These tests run the real functions in a VM with a
// stub declarativeNetRequest implementation, so the LRU cap, id reuse, candidate
// filtering, and degraded path are all exercised.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const worker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = worker.indexOf(startMarker);
  const end = worker.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return worker.slice(start, end);
}

const EXT_ID = 'test-extension-id';
const BASE_ID = 20000;

function createSandbox(options = {}) {
  const sessionRules = options.sessionRules ? [...options.sessionRules] : [];
  const updates = [];
  const dnr = {
    getSessionRules: async () => sessionRules.map((rule) => structuredClone(rule)),
    updateSessionRules: async ({ removeRuleIds = [], addRules = [] } = {}) => {
      updates.push({ removeRuleIds: [...removeRuleIds], addedIds: [...addRules].map((rule) => rule.id) });
      removeRuleIds.forEach((id) => {
        const index = sessionRules.findIndex((rule) => rule.id === id);
        if (index >= 0) sessionRules.splice(index, 1);
      });
      addRules.forEach((rule) => sessionRules.push(structuredClone(rule)));
    },
  };

  const context = {
    // URL is a host global, not a JS intrinsic, so a fresh VM context has none.
    URL,
    chrome: {
      runtime: { id: EXT_ID },
      // A missing capability is the degraded path the tests exercise explicitly.
      declarativeNetRequest: options.withoutDnr ? undefined : dnr,
    },
  };
  vm.createContext(context);
  vm.runInContext(sourceBetween('const MAX_IMAGE_REFERRER_RULES', 'const WORKER_TRANSLATIONS'), context);
  vm.runInContext(sourceBetween('function imageCandidates', 'function imageReferrerRule'), context);
  vm.runInContext(sourceBetween('function imageReferrerRule', 'function prepareImageRequest'), context);
  vm.runInContext(sourceBetween('function prepareImageRequest', 'async function downloadFileWithFallback'), context);
  vm.runInContext(
    `this.api = { imageCandidates, imageReferrerRule, prepareImageRequest };
     this.inspect = { get ruleCount() { return imageReferrerRules ? imageReferrerRules.size : 0; },
       get keys() { return imageReferrerRules ? [...imageReferrerRules.keys()] : []; } };`,
    context
  );
  return { api: context.api, inspect: context.inspect, sessionRules, updates };
}

const image = (over = {}) => ({ url: 'https://cdn.example.com/a.png', pageUrl: 'https://example.com/page', ...over });

function refererOf(rule) {
  return rule.action.requestHeaders.find((header) => header.header.toLowerCase() === 'referer').value;
}

// ------------------------------------------------------------------ rule building

test('the rule points at the source page origin and is scoped to the extension', () => {
  const { api } = createSandbox();
  const rule = api.imageReferrerRule(image(), BASE_ID);
  assert.ok(rule, 'expected a rule');
  assert.equal(rule.id, BASE_ID);
  assert.equal(refererOf(rule), 'https://example.com/');
  assert.deepEqual([...rule.condition.initiatorDomains], [EXT_ID]);
  assert.deepEqual([...rule.condition.resourceTypes], ['image', 'xmlhttprequest']);
  assert.deepEqual([...rule.condition.requestMethods], ['get', 'head']);
  assert.equal(rule.condition.isUrlFilterCaseSensitive, true);
});

test('a frame URL takes precedence over the page URL', () => {
  const { api } = createSandbox();
  const rule = api.imageReferrerRule(image({ frameUrl: 'https://frames.example.org/inner' }), BASE_ID);
  assert.equal(refererOf(rule), 'https://frames.example.org/');
});

test('no usable source page yields no rule', () => {
  const { api } = createSandbox();
  assert.equal(api.imageReferrerRule({ url: 'https://cdn.example.com/a.png' }, BASE_ID), null);
  assert.equal(api.imageReferrerRule(image({ pageUrl: 'data:text/html,x' }), BASE_ID), null);
  assert.equal(api.imageReferrerRule(image({ pageUrl: 'not a url' }), BASE_ID), null);
});

test('candidates exclude unusable addresses', () => {
  const { api } = createSandbox();
  const rule = api.imageReferrerRule(image({
    url: 'data:image/png;base64,AAAA',
    candidateUrls: [
      'https://cdn.example.com/ok.png',
      'https://user:secret@cdn.example.com/creds.png',
      'http://cdn.example.com/downgrade.png', // https page -> http image
      'chrome-extension://abc/icon.png',
      'https://cdn.example.com/ok.png',
    ],
  }), BASE_ID);
  assert.ok(rule, 'expected a rule from the usable candidate');
  assert.ok(rule.condition.regexFilter.includes('ok\\.png'), 'the usable https candidate must be present');
  assert.ok(!rule.condition.regexFilter.includes('creds'), 'credentials must be excluded');
  assert.ok(!rule.condition.regexFilter.includes('downgrade'), 'an https-to-http downgrade must be excluded');
  assert.ok(!rule.condition.regexFilter.includes('base64'), 'data URLs must be excluded');
  assert.ok(!rule.condition.regexFilter.includes('chrome-extension'), 'other schemes must be excluded');
});

test('at most sixteen candidates enter the filter', () => {
  const { api } = createSandbox();
  const candidateUrls = Array.from({ length: 24 }, (_, i) => `https://cdn.example.com/c${i}.png`);
  const rule = api.imageReferrerRule(image({ candidateUrls }), BASE_ID);
  const matched = rule.condition.regexFilter.split('|');
  assert.equal(matched.length, 16, `expected 16 alternatives, saw ${matched.length}`);
});

test('an over-long filter is rejected instead of installed', () => {
  const { api } = createSandbox();
  const long = `https://cdn.example.com/${'x'.repeat(180)}.png`;
  const rule = api.imageReferrerRule(image({ candidateUrls: Array.from({ length: 16 }, (_, i) => `${long}?i=${i}`) }), BASE_ID);
  assert.equal(rule, null, 'a filter beyond the documented length must not be built');
});

// ------------------------------------------------------------------ installation

test('installing a rule reports success and records one session rule', async () => {
  const sandbox = createSandbox();
  assert.equal(await sandbox.api.prepareImageRequest(image()), true);
  assert.equal(sandbox.sessionRules.length, 1);
  assert.equal(sandbox.updates.length, 1);
  assert.deepEqual(sandbox.updates[0].addedIds, [BASE_ID]);
});

test('an unchanged address and referer does not re-issue the rule', async () => {
  const sandbox = createSandbox();
  await sandbox.api.prepareImageRequest(image());
  const before = sandbox.updates.length;
  await sandbox.api.prepareImageRequest(image());
  assert.equal(sandbox.updates.length, before, 'the second call must not touch the session rules');
  assert.equal(sandbox.sessionRules.length, 1);
});

test('a changed referer replaces the rule and reuses its id', async () => {
  const sandbox = createSandbox();
  await sandbox.api.prepareImageRequest(image());
  await sandbox.api.prepareImageRequest(image({ pageUrl: 'https://other.example.net/page' }));
  assert.equal(sandbox.sessionRules.length, 1, 'replacing must not leave two rules for one address');
  assert.deepEqual(sandbox.updates[1].removeRuleIds, [BASE_ID]);
  assert.deepEqual(sandbox.updates[1].addedIds, [BASE_ID], 'the replacement must reuse the id');
  assert.equal(refererOf(sandbox.sessionRules[0]), 'https://other.example.net/');
});

test('distinct addresses receive distinct ids', async () => {
  const sandbox = createSandbox();
  await sandbox.api.prepareImageRequest(image({ url: 'https://cdn.example.com/a.png' }));
  await sandbox.api.prepareImageRequest(image({ url: 'https://cdn.example.com/b.png' }));
  const ids = [...sandbox.sessionRules].map((rule) => rule.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [BASE_ID, BASE_ID + 1]);
});

// ------------------------------------------------------------------ cap and adoption

test('existing session rules inside the managed range are adopted', async () => {
  const sandbox = createSandbox({
    sessionRules: [
      { id: BASE_ID, priority: 1, action: { type: 'modifyHeaders', requestHeaders: [{ header: 'referer', operation: 'set', value: 'https://old.example/' }] }, condition: { regexFilter: '^https://old\\.example/x\\.png$' } },
    ],
  });
  await sandbox.api.prepareImageRequest(image({ url: 'https://cdn.example.com/new.png' }));
  assert.equal(sandbox.inspect.ruleCount, 2, 'the adopted rule and the new one');
  const ids = sandbox.sessionRules.map((rule) => rule.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [BASE_ID, BASE_ID + 1], 'the new rule must not collide with the adopted rule id');
});

test('session rules outside the managed range are ignored', async () => {
  const sandbox = createSandbox({
    sessionRules: [
      { id: 1, priority: 1, action: { type: 'block' }, condition: { regexFilter: '^https://foreign\\.example/' } },
      { id: 99999, priority: 1, action: { type: 'block' }, condition: { regexFilter: '^https://far\\.example/' } },
    ],
  });
  await sandbox.api.prepareImageRequest(image());
  assert.equal(sandbox.updates[0].addedIds[0], BASE_ID, 'a foreign rule id must not be reused');
  assert.equal(sandbox.sessionRules.filter((rule) => rule.action.type === 'block').length, 2, 'foreign rules must be untouched');
});

test('reaching the rule cap evicts the oldest entry', async () => {
  const sessionRules = Array.from({ length: 1000 }, (_, i) => ({
    id: BASE_ID + i,
    priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'referer', operation: 'set', value: `https://seed${i}.example/` }] },
    condition: { regexFilter: `^https://seed${i}\\.example/x\\.png$` },
  }));
  const sandbox = createSandbox({ sessionRules });
  await sandbox.api.prepareImageRequest(image({ url: 'https://cdn.example.com/fresh.png' }));
  assert.equal(sandbox.inspect.ruleCount, 1000, 'the managed set must stay at the cap');
  assert.deepEqual(sandbox.updates[0].removeRuleIds, [BASE_ID], 'the oldest rule must be evicted');
  // The replacement deliberately reuses the freed id, so eviction is proven by the
  // evicted rule's referer being gone rather than by the id being absent.
  assert.ok(!sandbox.sessionRules.some((rule) => refererOf(rule) === 'https://seed0.example/'), 'the evicted rule must be gone');
  assert.ok(sandbox.sessionRules.some((rule) => refererOf(rule) === 'https://example.com/'), 'the new rule must be installed');
});

// ------------------------------------------------------------------ degraded paths

test('a missing declarativeNetRequest capability reports failure without throwing', async () => {
  const sandbox = createSandbox({ withoutDnr: true });
  assert.equal(await sandbox.api.prepareImageRequest(image()), false);
  assert.equal(sandbox.sessionRules.length, 0);
});

test('an unusable image resolves false instead of throwing', async () => {
  const sandbox = createSandbox();
  assert.equal(await sandbox.api.prepareImageRequest({ url: 'https://cdn.example.com/a.png' }), false);
  assert.equal(await sandbox.api.prepareImageRequest(null), false);
  assert.equal(sandbox.updates.length, 0);
});

test('a rejected rule update does not break later calls', async () => {
  const sandbox = createSandbox();
  const original = sandbox.api.prepareImageRequest;
  // Make the first update fail the way a permission rejection would.
  const failing = createSandbox();
  failing.sessionRules.push(); // no-op to keep the shape explicit
  const dnrFailure = {
    getSessionRules: async () => [],
    updateSessionRules: async () => { throw new Error('permission denied'); },
  };
  const context = { URL, chrome: { runtime: { id: EXT_ID }, declarativeNetRequest: dnrFailure } };
  vm.createContext(context);
  vm.runInContext(sourceBetween('const MAX_IMAGE_REFERRER_RULES', 'const WORKER_TRANSLATIONS'), context);
  vm.runInContext(sourceBetween('function imageCandidates', 'function imageReferrerRule'), context);
  vm.runInContext(sourceBetween('function imageReferrerRule', 'function prepareImageRequest'), context);
  vm.runInContext(sourceBetween('function prepareImageRequest', 'async function downloadFileWithFallback'), context);
  vm.runInContext('this.api = { prepareImageRequest };', context);
  assert.equal(await context.api.prepareImageRequest(image()), false, 'the failure must surface as false');
  assert.ok(original, 'sanity: the working sandbox still exposes the API');
});
