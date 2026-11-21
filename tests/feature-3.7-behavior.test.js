// Behavioural coverage for the 3.7.0 pure helpers: X/Twitter original-image
// upgrade, animated-image URL recognition, and animated format classification.
//
// The main regression suite only asserts that this source text exists. These
// tests execute the real functions in a VM with minimal stubs, so a logic change
// (wrong host, wrong query value, wrong format bucket) fails here even if the
// source-text assertions still pass.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const popup = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

function between(startMarker, endMarker) {
  const start = popup.indexOf(startMarker);
  const end = popup.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return popup.slice(start, end);
}

// normalizeUrl, platformOriginalUrl and imageLikeUrl are const arrow functions
// declared inside collectPageImages. Extract them verbatim and run them with a
// tiny document stub so document.baseURI resolves relative URLs.
function createHelpers() {
  const context = {
    URL,
    document: { baseURI: 'https://example.com/' },
  };
  vm.createContext(context);
  vm.runInContext(between('  const normalizeUrl = (rawUrl) => {', '  // 3.7.0：部分 CDN 用查询参数控制图片尺寸'), context);
  vm.runInContext(between('  const platformOriginalUrl = (rawUrl) => {', '  let skippedCount = 0;'), context);
  // formatCategory is a top-level function; extract through the next function.
  vm.runInContext(between('function formatCategory(format) {', 'function updateRangeLimits()'), context);
  vm.runInContext(
    `this.helpers = { normalizeUrl, platformOriginalUrl, imageLikeUrl, formatCategory };`,
    context
  );
  return context.helpers;
}

// ------------------------------------------------------------------ original upgrade

test('platformOriginalUrl upgrades only known twimg size variants', () => {
  const { platformOriginalUrl } = createHelpers();
  const upgrade = (url) => platformOriginalUrl(url);
  assert.equal(
    upgrade('https://pbs.twimg.com/media/abc.jpg?name=small'),
    'https://pbs.twimg.com/media/abc.jpg?name=orig'
  );
  assert.match(upgrade('https://pbs.twimg.com/media/abc.jpg?name=medium'), /name=orig/);
  assert.match(upgrade('https://pbs.twimg.com/media/abc.jpg?name=LARGE'), /name=orig/);
  // twimg.cn is a supported host.
  assert.match(upgrade('https://pbs.twimg.cn/media/abc.jpg?name=thumb'), /name=orig/);
});

test('platformOriginalUrl leaves non-target URLs untouched', () => {
  const { platformOriginalUrl } = createHelpers();
  assert.equal(platformOriginalUrl('https://pbs.twimg.com/media/abc.jpg?name=orig'), '');
  assert.equal(platformOriginalUrl('https://pbs.twimg.com/media/abc.jpg?name=custom'), '');
  assert.equal(platformOriginalUrl('https://pbs.twimg.com/media/abc.jpg'), '');
  assert.equal(platformOriginalUrl('https://cdn.example.com/a.jpg?name=small'), '');
  assert.equal(platformOriginalUrl(''), '');
});

// ------------------------------------------------------------------ animated URL recognition

test('imageLikeUrl recognises animated files and relay parameters', () => {
  const { imageLikeUrl } = createHelpers();
  for (const url of [
    'https://cdn.example.com/a.gif',
    'https://cdn.example.com/a.MP4?x=1',
    'https://cdn.example.com/a.mov',
    'https://cdn.example.com/a.webm#t=1',
    'https://video.weibo.com/media/play?livephoto=https%3A%2F%2Fexample.com%2Fa.mov',
  ]) {
    assert.equal(imageLikeUrl(url), true, `expected animated URL: ${url}`);
  }
});

test('imageLikeUrl rejects unrelated URLs', () => {
  const { imageLikeUrl } = createHelpers();
  for (const url of [
    'https://cdn.example.com/a.html',
    'https://cdn.example.com/page?foo=bar',
    'https://cdn.example.com/a.txt',
  ]) {
    assert.equal(imageLikeUrl(url), false, `expected non-image URL: ${url}`);
  }
});

// ------------------------------------------------------------------ format classification

test('formatCategory routes animated formats to the animated bucket', () => {
  const { formatCategory } = createHelpers();
  for (const format of ['gif', 'mp4', 'm4v', 'mov', 'webm', 'ogv']) {
    assert.equal(formatCategory(format), 'animated', `${format} must be animated`);
  }
  for (const format of ['jpeg', 'png', 'webp', 'avif']) {
    assert.equal(formatCategory(format), format, `${format} keeps its own bucket`);
  }
  assert.equal(formatCategory('svg'), 'other');
  assert.equal(formatCategory('bmp'), 'other');
});

// ------------------------------------------------------------------ animated preview detection

function createPreviewHelpers() {
  const context = { URL };
  vm.createContext(context);
  // previewCandidates is a top-level function; extract it with its helper block.
  vm.runInContext(between('function previewCandidates(image, preferDisplay = false) {', '// 动图预览：'), context);
  vm.runInContext(between('const VIDEO_FORMATS =', 'function previewMedia(image)'), context);
  vm.runInContext(`this.helpers = { isAnimatedVideoRecord };`, context);
  return context.helpers;
}

test('isAnimatedVideoRecord recognizes video formats, MIME types, and relay URLs', () => {
  const { isAnimatedVideoRecord } = createPreviewHelpers();
  for (const record of [
    { url: 'https://cdn.example.com/a.mp4', format: 'mp4' },
    { url: 'https://cdn.example.com/a.mov', format: 'mov' },
    { url: 'https://cdn.example.com/a.webm', format: 'webm' },
    { url: 'https://cdn.example.com/media', mime: 'video/quicktime' },
    // A static-looking record that carries a video original candidate still needs <video>.
    { url: 'https://cdn.example.com/cover.jpg', format: 'jpeg', originalCandidates: ['https://cdn.example.com/clip.mp4'] },
  ]) {
    assert.equal(isAnimatedVideoRecord(record), true, `expected video record: ${record.url}`);
  }
  const relay = 'https://video.weibo.com/media/play?livephoto=' + encodeURIComponent('https://livephoto.us.sinaimg.cn/a.mov');
  assert.equal(isAnimatedVideoRecord({ url: relay, format: 'other' }), true);
});

test('isAnimatedVideoRecord leaves static images on the <img> path', () => {
  const { isAnimatedVideoRecord } = createPreviewHelpers();
  for (const record of [
    { url: 'https://cdn.example.com/a.jpg', format: 'jpeg' },
    { url: 'https://cdn.example.com/a.png', format: 'png' },
    { url: 'https://cdn.example.com/a.gif', format: 'gif' },
    { url: 'https://cdn.example.com/a.webp', format: 'webp' },
    { url: 'https://cdn.example.com/a.svg', format: 'svg' },
    {},
  ]) {
    assert.equal(isAnimatedVideoRecord(record), false, `expected static record: ${record.url || 'empty'}`);
  }
});

// ------------------------------------------------------------------ cache bound contract

test('metadata cache has a bounded size and prunes expired entries', () => {
  const worker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  assert.match(worker, /METADATA_CACHE_MAX_ENTRIES = MAX_METADATA_INSPECTIONS/);
  assert.match(worker, /function pruneMetadataCache/);
  assert.match(worker, /now - entry\.timestamp >= METADATA_CACHE_TTL/);
  assert.match(worker, /while \(metadataCache\.size > METADATA_CACHE_MAX_ENTRIES\)/);
  assert.match(worker, /pruneMetadataCache\(\);\s*\n\s*metadataCache\.set\(/);
});
