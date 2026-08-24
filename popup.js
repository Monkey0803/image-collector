const state = {
  images: [],
  dimensionFiltered: [],
  filtered: [],
  format: 'all',
  selected: new Set(),
  tabId: null,
  saveAs: true,
  scanId: 0,
  searchQuery: '',
  sort: 'page',
  duplicateCount: 0,
  filterValues: {
    width: { min: null, max: null },
    height: { min: null, max: null }
  },
  toastTimer: null,
  downloadJobId: null,
  retryImages: [],
  retryAsZip: false
};

const $ = (selector) => document.querySelector(selector);
const els = {
  refresh: $('#refreshButton'),
  scanStatus: $('#scanStatus'),
  pageTitle: $('#pageTitle'), pageUrl: $('#pageUrl'), pageIcon: $('#pageIcon'),
  minWidth: $('#minWidth'), maxWidth: $('#maxWidth'), minHeight: $('#minHeight'), maxHeight: $('#maxHeight'),
  widthValue: $('#widthValue'), heightValue: $('#heightValue'), widthTrack: $('#widthTrack'), heightTrack: $('#heightTrack'),
  clearFilters: $('#clearFilters'), selectAll: $('#selectAll'), resultCount: $('#resultCount'),
  selectedSummary: $('#selectedSummary'), searchInput: $('#searchInput'), sortSelect: $('#sortSelect'),
  formatTabs: [...document.querySelectorAll('[data-format]')],
  grid: $('#imageGrid'), empty: $('#emptyState'), loading: $('#loadingState'), error: $('#errorState'),
  saveAs: $('#saveAs'), download: $('#downloadButton'), zip: $('#zipButton'), selectedCount: $('#selectedCount'),
  downloadProgress: $('#downloadProgress'), progressLabel: $('#progressLabel'), progressValue: $('#progressValue'),
  progressBar: $('#progressBar'), progressDetail: $('#progressDetail'), retryButton: $('#retryButton'),
  retryCount: $('#retryCount'), toast: $('#toast')
};

document.addEventListener('DOMContentLoaded', init);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'downloadProgress' && message.jobId === state.downloadJobId) updateDownloadProgress(message);
});

async function init() {
  const saved = await chrome.storage.local.get({ filters: {}, saveAs: true, searchQuery: '', sort: 'page' });
  const savedFilters = saved.filters && typeof saved.filters === 'object' ? saved.filters : {};
  state.saveAs = typeof saved.saveAs === 'boolean' ? saved.saveAs : true;
  state.searchQuery = typeof saved.searchQuery === 'string' ? saved.searchQuery : '';
  state.sort = ['page', 'width-desc', 'height-desc', 'area-desc', 'name-asc'].includes(saved.sort) ? saved.sort : 'page';
  state.filterValues = {
    width: { min: normalizeLimit(savedFilters.minWidth), max: normalizeLimit(savedFilters.maxWidth) },
    height: { min: normalizeLimit(savedFilters.minHeight), max: normalizeLimit(savedFilters.maxHeight) }
  };
  for (const axis of ['width', 'height']) {
    const limits = state.filterValues[axis];
    if (limits.min !== null && limits.max !== null && limits.min > limits.max) limits.max = limits.min;
  }
  els.saveAs.checked = state.saveAs;
  els.searchInput.value = state.searchQuery;
  els.sortSelect.value = state.sort;
  bindEvents();
  await scanPage();
}

function bindEvents() {
  els.refresh.addEventListener('click', scanPage);
  els.clearFilters.addEventListener('click', () => {
    els.minWidth.value = 0;
    els.maxWidth.value = els.maxWidth.max;
    els.minHeight.value = 0;
    els.maxHeight.value = els.maxHeight.max;
    els.searchInput.value = '';
    els.sortSelect.value = 'page';
    state.filterValues = {
      width: { min: null, max: null },
      height: { min: null, max: null }
    };
    state.searchQuery = '';
    state.sort = 'page';
    state.format = 'all';
    applyFilters();
  });
  els.minWidth.addEventListener('input', () => handleRangeInput('width', 'min'));
  els.maxWidth.addEventListener('input', () => handleRangeInput('width', 'max'));
  els.minHeight.addEventListener('input', () => handleRangeInput('height', 'min'));
  els.maxHeight.addEventListener('input', () => handleRangeInput('height', 'max'));
  els.searchInput.addEventListener('input', () => {
    state.searchQuery = els.searchInput.value.trim();
    chrome.storage.local.set({ searchQuery: state.searchQuery });
    applyFilters();
  });
  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    chrome.storage.local.set({ sort: state.sort });
    applyFilters();
  });
  els.formatTabs.forEach((tab) => tab.addEventListener('click', () => {
    state.format = tab.dataset.format || 'all';
    applyFilters();
  }));
  els.selectAll.addEventListener('change', () => {
    if (els.selectAll.checked) state.filtered.forEach((image) => state.selected.add(image.id));
    else state.filtered.forEach((image) => state.selected.delete(image.id));
    render();
  });
  els.saveAs.addEventListener('change', async () => {
    state.saveAs = els.saveAs.checked;
    await chrome.storage.local.set({ saveAs: state.saveAs });
  });
  els.retryButton.addEventListener('click', () => {
    if (state.retryImages.length) downloadImages([...state.retryImages], state.retryAsZip);
  });
  els.download.addEventListener('click', () => downloadSelected(false));
  els.zip.addEventListener('click', () => downloadSelected(true));
}

async function scanPage() {
  const scanId = ++state.scanId;
  setLoading(true);
  els.refresh.disabled = true;
  els.scanStatus.textContent = '扫描中';
  els.error.hidden = true;
  state.images = [];
  state.dimensionFiltered = [];
  state.filtered = [];
  state.format = 'all';
  state.selected.clear();
  state.duplicateCount = 0;
  state.retryImages = [];
  updateRetryUI();
  renderFormatTabs();
  render();
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) throw new Error('无法获取当前标签页。');
    if (scanId !== state.scanId) return;
    state.tabId = tab.id;
    els.pageTitle.textContent = tab.title || '当前页面';
    els.pageUrl.textContent = tab.url || '';
    els.pageIcon.textContent = getDomainLetter(tab.url);
    const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPageImages });
    if (scanId !== state.scanId) return;
    const payload = result[0]?.result || {};
    const rawImages = Array.isArray(payload) ? payload : payload.images || [];
    state.duplicateCount = Array.isArray(payload) ? 0 : Number(payload.duplicateCount || 0);
    state.images = rawImages.map((image, index) => ({
      ...image,
      format: image.format || 'other',
      id: `${index}-${image.url}`,
      index
    }));
    els.scanStatus.textContent = `${state.images.length} 张图片${state.duplicateCount ? ` · 去重 ${state.duplicateCount}` : ''}`;
    updateRangeLimits();
    state.selected.clear();
    applyFilters();
  } catch (error) {
    if (scanId !== state.scanId) return;
    state.images = [];
    state.dimensionFiltered = [];
    state.filtered = [];
    state.selected.clear();
    render();
    els.error.hidden = false;
    els.error.textContent = `扫描失败：${error.message || '当前页面不允许扩展访问，请切换到普通网页后重试。'}`;
    els.scanStatus.textContent = '扫描失败';
  } finally {
    if (scanId === state.scanId) {
      setLoading(false);
      els.refresh.disabled = false;
      render();
    }
  }
}

async function collectPageImages() {
  const found = [];
  const seenUrls = new Map();
  const originalAttributes = [
    'data-original', 'data-original-src', 'data-full', 'data-full-src', 'data-large',
    'data-large-src', 'data-zoom', 'data-zoom-image', 'data-lazy-src', 'data-src'
  ];

  const formatFromUrl = (url) => {
    let parsed;
    try { parsed = new URL(url); } catch { return 'other'; }
    const queryHint = parsed.searchParams.get('format') || parsed.searchParams.get('fm') || '';
    const pathHint = parsed.pathname.split('.').pop() || '';
    const extension = (queryHint || pathHint).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (extension === 'jpg' || extension === 'jpeg') return 'jpeg';
    if (extension === 'png') return 'png';
    if (extension === 'webp') return 'webp';
    if (extension === 'avif') return 'avif';
    if (extension === 'gif') return 'gif';
    if (extension === 'svg') return 'svg';
    return 'other';
  };

  const normalizeUrl = (rawUrl) => {
    if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('javascript:')) return '';
    try {
      const url = new URL(rawUrl.trim(), document.baseURI);
      url.hash = '';
      return url.href;
    } catch { return ''; }
  };

  const imageLikeUrl = (url) => /\.(?:avif|bmp|gif|jpe?g|png|svg|webp|ico)(?:$|[?#])/i.test(url) || /[?&](?:format|fm|image|img|w|width)=/i.test(url);

  const add = (rawUrl, width, height, source, alt = '', options = {}) => {
    const url = normalizeUrl(rawUrl);
    if (!url) return;
    const entry = {
      url,
      displayUrl: options.displayUrl || url,
      width: Math.round(width || 0),
      height: Math.round(height || 0),
      source,
      alt,
      format: formatFromUrl(url),
      original: Boolean(options.original),
      quality: Number(options.quality || 0),
      widthHint: Number(options.widthHint || 0),
      element: options.element || null
    };
    const existing = seenUrls.get(url);
    if (existing) {
      if (entry.quality > existing.quality) Object.assign(existing, entry);
      return;
    }
    seenUrls.set(url, entry);
    found.push(entry);
  };

  const parseSrcset = (value) => String(value || '').split(',').map((part) => {
    const pieces = part.trim().split(/\s+/);
    const rawUrl = pieces.shift();
    const descriptor = pieces[0] || '';
    const widthHint = descriptor.endsWith('w') ? Number.parseInt(descriptor, 10) : 0;
    const density = descriptor.endsWith('x') ? Number.parseFloat(descriptor) : 1;
    return { rawUrl, widthHint, density: Number.isFinite(density) ? density : 1 };
  }).filter((candidate) => candidate.rawUrl);

  const chooseImageSource = (image) => {
    const candidates = [];
    const push = (rawUrl, quality, original, widthHint = 0) => {
      const url = normalizeUrl(rawUrl);
      if (url) candidates.push({ url, quality, original, widthHint });
    };
    originalAttributes.forEach((attribute, index) => push(image.getAttribute(attribute), 10000 - index, true));
    const parentLink = image.closest('a[href]')?.getAttribute('href');
    if (parentLink && imageLikeUrl(normalizeUrl(parentLink))) push(parentLink, 9000, true);
    image.closest('picture')?.querySelectorAll('source[srcset]').forEach((source) => {
      parseSrcset(source.getAttribute('srcset')).forEach((candidate) => push(candidate.rawUrl, 7000 + candidate.widthHint / 100, true, candidate.widthHint));
    });
    parseSrcset(image.getAttribute('srcset') || image.srcset).forEach((candidate) => {
      push(candidate.rawUrl, 6500 + candidate.widthHint / 100, false, candidate.widthHint);
    });
    push(image.currentSrc, 6000, false);
    push(image.getAttribute('src'), 5000, false);
    ['data-lazy-src', 'data-src'].forEach((attribute) => push(image.getAttribute(attribute), 4500, false));
    candidates.sort((left, right) => right.quality - left.quality || right.widthHint - left.widthHint);
    return candidates[0] || null;
  };

  const probeDimensions = (url, fallbackWidth, fallbackHeight) => new Promise((resolve) => {
    if (!url || url.startsWith('data:')) { resolve({ width: fallbackWidth, height: fallbackHeight }); return; }
    const probe = new Image();
    let settled = false;
    const finish = (width, height) => {
      if (settled) return;
      settled = true;
      resolve({ width: Math.round(width || fallbackWidth || 0), height: Math.round(height || fallbackHeight || 0) });
    };
    probe.onload = () => finish(probe.naturalWidth, probe.naturalHeight);
    probe.onerror = () => finish(fallbackWidth, fallbackHeight);
    probe.src = url;
    setTimeout(() => finish(fallbackWidth, fallbackHeight), 1800);
  });

  const fingerprint = (image) => {
    if (!image || !image.complete || !image.naturalWidth) return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 8; canvas.height = 8;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 8, 8);
      const pixels = context.getImageData(0, 0, 8, 8).data;
      let hash = 2166136261;
      for (const pixel of pixels) {
        hash ^= pixel;
        hash = Math.imul(hash, 16777619);
      }
      return `${image.naturalWidth}x${image.naturalHeight}:${hash >>> 0}`;
    } catch {
      return '';
    }
  };

  for (const image of document.images) {
    const chosen = chooseImageSource(image);
    if (!chosen) continue;
    const displayUrl = normalizeUrl(image.currentSrc || image.src || image.getAttribute('data-src')) || chosen.url;
    add(chosen.url, image.naturalWidth || image.width, image.naturalHeight || image.height, 'IMG', image.alt || '', {
      displayUrl,
      original: chosen.original || chosen.url !== displayUrl,
      quality: chosen.quality,
      widthHint: chosen.widthHint,
      element: image
    });
  }
  for (const element of document.querySelectorAll('*')) {
    const background = getComputedStyle(element).backgroundImage || '';
    const matches = background.matchAll(/url\((?:"|')?(.*?)(?:"|')?\)/g);
    for (const match of matches) {
      const rect = element.getBoundingClientRect();
      add(match[1], rect.width, rect.height, 'CSS', '背景图片', { quality: 2000 });
    }
  }

  await Promise.all(found.map(async (entry) => {
    if (entry.original && entry.url !== entry.displayUrl) {
      const dimensions = await probeDimensions(entry.url, entry.width || entry.widthHint, entry.height);
      entry.width = dimensions.width;
      entry.height = dimensions.height;
    }
    entry.contentKey = fingerprint(entry.element);
    delete entry.element;
  }));

  const unique = new Map();
  let duplicateCount = 0;
  for (const entry of found) {
    const key = entry.contentKey ? `pixel:${entry.contentKey}` : `url:${entry.url}`;
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, entry);
      continue;
    }
    duplicateCount += 1;
    const entryScore = entry.quality + (entry.width * entry.height) / 1000000;
    const existingScore = existing.quality + (existing.width * existing.height) / 1000000;
    if (entryScore > existingScore) unique.set(key, entry);
  }
  return { images: [...unique.values()].map(({ contentKey, ...image }) => image), duplicateCount };
}

function applyFilters() {
  const minWidth = state.filterValues.width.min, maxWidth = state.filterValues.width.max;
  const minHeight = state.filterValues.height.min, maxHeight = state.filterValues.height.max;
  state.dimensionFiltered = state.images.filter((image) =>
    (minWidth === null || image.width >= minWidth) && (maxWidth === null || image.width <= maxWidth) &&
    (minHeight === null || image.height >= minHeight) && (maxHeight === null || image.height <= maxHeight)
  );
  const formatFiltered = state.format === 'all'
    ? state.dimensionFiltered
    : state.dimensionFiltered.filter((image) => formatCategory(image.format) === state.format);
  const query = state.searchQuery.toLowerCase();
  state.filtered = sortImages(formatFiltered.filter((image) => {
    if (!query) return true;
    let hostname = '';
    try { hostname = new URL(image.url).hostname; } catch { /* Keep URL search available. */ }
    return [fileName(image.url), image.url, hostname, image.alt, image.format, image.source]
      .join(' ').toLowerCase().includes(query);
  }));
  chrome.storage.local.set({ filters: {
    minWidth: serializeLimit(state.filterValues.width.min), maxWidth: serializeLimit(state.filterValues.width.max),
    minHeight: serializeLimit(state.filterValues.height.min), maxHeight: serializeLimit(state.filterValues.height.max)
  } });
  updateSliderUI('width');
  updateSliderUI('height');
  renderFormatTabs();
  render();
}

function sortImages(images) {
  const result = [...images];
  if (state.sort === 'width-desc') return result.sort((a, b) => (b.width || 0) - (a.width || 0) || a.index - b.index);
  if (state.sort === 'height-desc') return result.sort((a, b) => (b.height || 0) - (a.height || 0) || a.index - b.index);
  if (state.sort === 'area-desc') return result.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)) || a.index - b.index);
  if (state.sort === 'name-asc') return result.sort((a, b) => fileName(a.url).localeCompare(fileName(b.url), undefined, { sensitivity: 'base' }) || a.index - b.index);
  return result.sort((a, b) => a.index - b.index);
}

function renderFormatTabs() {
  const counts = { all: state.dimensionFiltered.length, jpeg: 0, png: 0, webp: 0, avif: 0, other: 0 };
  state.dimensionFiltered.forEach((image) => {
    const category = formatCategory(image.format);
    counts[category] = (counts[category] || 0) + 1;
  });
  els.formatTabs.forEach((tab) => {
    const format = tab.dataset.format || 'all';
    const count = counts[format] || 0;
    tab.querySelector('[data-count]').textContent = count;
    tab.classList.toggle('active', state.format === format);
    tab.setAttribute('aria-pressed', state.format === format ? 'true' : 'false');
    tab.hidden = format !== 'all' && count === 0 && state.format !== format;
  });
}

function formatCategory(format) { return ['jpeg', 'png', 'webp', 'avif'].includes(format) ? format : 'other'; }

function updateRangeLimits() {
  const dimensions = {
    width: state.images.map((image) => image.width),
    height: state.images.map((image) => image.height)
  };
  for (const axis of ['width', 'height']) {
    const values = dimensions[axis].filter((value) => value > 0);
    const largest = values.length ? Math.max(...values) : 5000;
    const requested = state.filterValues[axis];
    const requestedLargest = Math.max(requested.min || 0, requested.max || 0);
    const max = Math.max(1000, Math.ceil(Math.max(largest, requestedLargest) / 100) * 100);
    const minInput = els[`min${capitalize(axis)}`];
    const maxInput = els[`max${capitalize(axis)}`];
    minInput.max = max;
    maxInput.max = max;
    minInput.value = requested.min === null ? 0 : Math.min(requested.min, max);
    maxInput.value = requested.max === null ? max : Math.min(requested.max, max);
    if (Number(minInput.value) > Number(maxInput.value)) {
      if (requested.max === null) minInput.value = maxInput.value;
      else maxInput.value = minInput.value;
    }
  }
  updateSliderUI('width');
  updateSliderUI('height');
}

function handleRangeInput(axis, changedSide) {
  const minInput = els[`min${capitalize(axis)}`];
  const maxInput = els[`max${capitalize(axis)}`];
  if (changedSide === 'min' && Number(minInput.value) > Number(maxInput.value)) maxInput.value = minInput.value;
  if (changedSide === 'max' && Number(maxInput.value) < Number(minInput.value)) minInput.value = maxInput.value;
  state.filterValues[axis] = {
    min: Number(minInput.value) === 0 ? null : Number(minInput.value),
    max: Number(maxInput.value) === Number(maxInput.max) ? null : Number(maxInput.value)
  };
  applyFilters();
}

function updateSliderUI(axis) {
  const minInput = els[`min${capitalize(axis)}`];
  const maxInput = els[`max${capitalize(axis)}`];
  const max = Number(maxInput.max) || 5000;
  const min = Number(minInput.value);
  const upper = Number(maxInput.value);
  const track = els[`${axis}Track`];
  track.style.setProperty('--start', `${(min / max) * 100}%`);
  track.style.setProperty('--end', `${(upper / max) * 100}%`);
  els[`${axis}Value`].textContent = min === 0 && upper === max ? '不限' : `${displayLimit(axis, min, 'min')} – ${displayLimit(axis, upper, 'max')}`;
}

function normalizeLimit(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const normalized = Number(value.trim());
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
}

function serializeLimit(value) { return value === null ? '' : String(value); }

function displayLimit(axis, value, side) {
  const max = Number(els[`max${capitalize(axis)}`].max);
  return value === 0 && side === 'min' ? '不限' : value === max && side === 'max' ? '不限' : `${value}px`;
}

function capitalize(value) { return value[0].toUpperCase() + value.slice(1); }

function render() {
  els.grid.replaceChildren();
  els.resultCount.textContent = `${state.filtered.length} 张图片`;
  els.empty.hidden = state.filtered.length !== 0 || !els.loading.hidden;
  els.selectAll.checked = state.filtered.length > 0 && state.filtered.every((image) => state.selected.has(image.id));
  for (const image of state.filtered) els.grid.append(createCard(image));
  const selected = selectedImages();
  els.selectedCount.textContent = selected.length;
  els.selectedSummary.textContent = `已选 ${selected.length}`;
  els.download.disabled = selected.length === 0;
  els.zip.disabled = selected.length === 0;
}

function createCard(image) {
  const card = document.createElement('article');
  card.className = `image-card${state.selected.has(image.id) ? ' selected' : ''}`;
  card.dataset.imageId = image.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${image.width && image.height ? `${image.width} × ${image.height}` : '尺寸未知'}，${fileName(image.url)}`);
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox'; checkbox.className = 'card-check'; checkbox.checked = state.selected.has(image.id);
  checkbox.setAttribute('aria-label', `选择 ${image.width}×${image.height} 图片`);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) state.selected.add(image.id); else state.selected.delete(image.id);
    render();
    [...els.grid.querySelectorAll('.image-card')].find((candidate) => candidate.dataset.imageId === image.id)?.focus();
  });
  card.addEventListener('click', (event) => {
    if (event.target.closest('button, input')) return;
    checkbox.click();
  });
  card.addEventListener('keydown', (event) => {
    if (event.target.closest('button, input')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    checkbox.click();
  });
  const wrap = document.createElement('div'); wrap.className = 'thumbnail-wrap';
  const thumbnail = document.createElement('img'); thumbnail.className = 'thumbnail'; thumbnail.src = image.url; thumbnail.alt = image.alt || '网页图片'; thumbnail.loading = 'lazy';
  thumbnail.addEventListener('error', () => { wrap.textContent = '预览不可用'; wrap.style.color = '#9ba4ac'; wrap.style.fontSize = '10px'; });
  wrap.append(thumbnail);
  const meta = document.createElement('div'); meta.className = 'card-meta';
  const size = document.createElement('span'); size.className = 'card-size'; size.textContent = image.width && image.height ? `${image.width} × ${image.height}` : '尺寸未知';
  const sizeRow = document.createElement('div'); sizeRow.className = 'card-size-row';
  const format = document.createElement('span'); format.className = 'format-badge'; format.textContent = image.original ? `${formatLabel(image.format)} · 原图` : formatLabel(image.format);
  const name = document.createElement('span'); name.className = 'card-name'; name.textContent = fileName(image.url); name.title = image.url;
  sizeRow.append(size, format);
  meta.append(sizeRow, name);
  const single = document.createElement('button'); single.type = 'button'; single.className = 'single-download'; single.title = '下载这张图片'; single.setAttribute('aria-label', '下载这张图片'); single.textContent = '↓';
  single.addEventListener('click', (event) => { event.stopPropagation(); downloadImages([image], false); });
  card.append(checkbox, wrap, meta, single);
  return card;
}

function selectedImages() { return state.images.filter((image) => state.selected.has(image.id)); }
function downloadSelected(asZip) { downloadImages(selectedImages(), asZip); }
function formatLabel(format) { return format === 'other' ? '其它' : (format || 'other').toUpperCase(); }

async function downloadImages(images, asZip) {
  if (!images.length) return;
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  state.downloadJobId = jobId;
  state.retryImages = [];
  state.retryAsZip = asZip;
  updateRetryUI();
  els.download.disabled = true;
  els.zip.disabled = true;
  updateDownloadProgress({ phase: 'starting', completed: 0, total: images.length, failed: 0, percent: 0, detail: asZip ? '准备生成 ZIP…' : '准备下载图片…' });
  try {
    const response = await chrome.runtime.sendMessage({ type: asZip ? 'downloadZip' : 'downloadImages', images, saveAs: state.saveAs, jobId });
    const failed = Array.isArray(response?.failed) ? response.failed : [];
    const byUrl = new Map(images.map((image) => [image.url, image]));
    state.retryImages = failed.map((item) => byUrl.get(item.url)).filter(Boolean);
    state.retryAsZip = asZip;
    updateRetryUI();
    if (!response?.ok) throw new Error(response?.error || '下载失败');
    if (failed.length) showToast(`已开始下载，${failed.length} 张图片失败，可点击重试`);
    else showToast(asZip ? 'ZIP 已开始下载' : '下载已开始');
  } catch (error) {
    if (!state.retryImages.length) state.retryImages = [...images];
    updateRetryUI();
    updateDownloadProgress({ phase: 'failed', completed: images.length, total: images.length, failed: state.retryImages.length, percent: 100, detail: error.message || '下载失败' });
    showToast(error.message || '下载失败，请重试');
  } finally {
    render();
  }
}

function updateDownloadProgress(progress) {
  els.downloadProgress.hidden = false;
  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  els.progressBar.style.width = `${percent}%`;
  els.progressValue.textContent = `${percent}%`;
  els.progressLabel.textContent = progress.phase === 'compressing' ? '正在压缩' : progress.phase === 'failed' ? '任务失败' : progress.phase === 'complete' ? '任务完成' : '下载进度';
  els.progressDetail.textContent = progress.detail || `已处理 ${progress.completed || 0}/${progress.total || 0}`;
}

function updateRetryUI() {
  const count = state.retryImages.length;
  els.retryCount.textContent = count;
  els.retryButton.hidden = count === 0;
}

function setLoading(loading) { els.loading.hidden = !loading; if (loading) { els.grid.replaceChildren(); els.empty.hidden = true; } }
function fileName(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image'); } catch { return 'image'; } }
function getDomainLetter(url) { try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 1).toUpperCase() || '◎'; } catch { return '◎'; } }
function showToast(message) { clearTimeout(state.toastTimer); els.toast.textContent = message; els.toast.classList.add('show'); state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200); }
