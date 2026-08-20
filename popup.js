const state = {
  images: [],
  dimensionFiltered: [],
  filtered: [],
  format: 'all',
  selected: new Set(),
  tabId: null,
  saveAs: true,
  scanId: 0,
  filterValues: {
    width: { min: null, max: null },
    height: { min: null, max: null }
  },
  toastTimer: null
};

const $ = (selector) => document.querySelector(selector);
const els = {
  refresh: $('#refreshButton'),
  scanStatus: $('#scanStatus'),
  pageTitle: $('#pageTitle'), pageUrl: $('#pageUrl'), pageIcon: $('#pageIcon'),
  minWidth: $('#minWidth'), maxWidth: $('#maxWidth'), minHeight: $('#minHeight'), maxHeight: $('#maxHeight'),
  widthValue: $('#widthValue'), heightValue: $('#heightValue'), widthTrack: $('#widthTrack'), heightTrack: $('#heightTrack'),
  clearFilters: $('#clearFilters'), selectAll: $('#selectAll'), resultCount: $('#resultCount'),
  selectedSummary: $('#selectedSummary'),
  formatTabs: [...document.querySelectorAll('[data-format]')],
  grid: $('#imageGrid'), empty: $('#emptyState'), loading: $('#loadingState'), error: $('#errorState'),
  saveAs: $('#saveAs'), download: $('#downloadButton'), zip: $('#zipButton'), selectedCount: $('#selectedCount'), toast: $('#toast')
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const saved = await chrome.storage.local.get({ filters: {}, saveAs: true });
  const savedFilters = saved.filters && typeof saved.filters === 'object' ? saved.filters : {};
  state.saveAs = typeof saved.saveAs === 'boolean' ? saved.saveAs : true;
  state.filterValues = {
    width: { min: normalizeLimit(savedFilters.minWidth), max: normalizeLimit(savedFilters.maxWidth) },
    height: { min: normalizeLimit(savedFilters.minHeight), max: normalizeLimit(savedFilters.maxHeight) }
  };
  for (const axis of ['width', 'height']) {
    const limits = state.filterValues[axis];
    if (limits.min !== null && limits.max !== null && limits.min > limits.max) limits.max = limits.min;
  }
  els.saveAs.checked = state.saveAs;
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
    state.filterValues = {
      width: { min: null, max: null },
      height: { min: null, max: null }
    };
    state.format = 'all';
    applyFilters();
  });
  els.minWidth.addEventListener('input', () => handleRangeInput('width', 'min'));
  els.maxWidth.addEventListener('input', () => handleRangeInput('width', 'max'));
  els.minHeight.addEventListener('input', () => handleRangeInput('height', 'min'));
  els.maxHeight.addEventListener('input', () => handleRangeInput('height', 'max'));
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
    state.images = (result[0]?.result || []).map((image, index) => ({ ...image, format: image.format || 'other', id: `${index}-${image.url}` }));
    els.scanStatus.textContent = `${state.images.length} 张图片`;
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

function collectPageImages() {
  const found = [];
  const seen = new Set();
  const add = (rawUrl, width, height, source, alt = '') => {
    if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('javascript:')) return;
    let url;
    try { url = new URL(rawUrl, document.baseURI).href; } catch { return; }
    if (seen.has(url)) return;
    seen.add(url);
    found.push({ url, width: Math.round(width || 0), height: Math.round(height || 0), source, alt, format: formatFromUrl(url) });
  };
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
  for (const image of document.images) {
    const url = image.currentSrc || image.src || image.getAttribute('data-src') || image.getAttribute('data-original');
    add(url, image.naturalWidth || image.width, image.naturalHeight || image.height, 'IMG', image.alt || '');
  }
  for (const element of document.querySelectorAll('*')) {
    const background = getComputedStyle(element).backgroundImage || '';
    const matches = background.matchAll(/url\((?:"|')?(.*?)(?:"|')?\)/g);
    for (const match of matches) {
      const rect = element.getBoundingClientRect();
      add(match[1], rect.width, rect.height, 'CSS', '背景图片');
    }
  }
  return found;
}

function applyFilters() {
  const minWidth = state.filterValues.width.min, maxWidth = state.filterValues.width.max;
  const minHeight = state.filterValues.height.min, maxHeight = state.filterValues.height.max;
  state.dimensionFiltered = state.images.filter((image) =>
    (minWidth === null || image.width >= minWidth) && (maxWidth === null || image.width <= maxWidth) &&
    (minHeight === null || image.height >= minHeight) && (maxHeight === null || image.height <= maxHeight)
  );
  state.filtered = state.format === 'all'
    ? state.dimensionFiltered
    : state.dimensionFiltered.filter((image) => formatCategory(image.format) === state.format);
  chrome.storage.local.set({ filters: {
    minWidth: serializeLimit(state.filterValues.width.min), maxWidth: serializeLimit(state.filterValues.width.max),
    minHeight: serializeLimit(state.filterValues.height.min), maxHeight: serializeLimit(state.filterValues.height.max)
  } });
  updateSliderUI('width');
  updateSliderUI('height');
  renderFormatTabs();
  render();
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

function formatCategory(format) {
  return ['jpeg', 'png', 'webp', 'avif'].includes(format) ? format : 'other';
}

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
  const format = document.createElement('span'); format.className = 'format-badge'; format.textContent = formatLabel(image.format);
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
  els.download.disabled = true; els.zip.disabled = true;
  showToast(asZip ? '正在生成 ZIP…' : `正在准备下载 ${images.length} 张图片…`);
  try {
    const response = await chrome.runtime.sendMessage({ type: asZip ? 'downloadZip' : 'downloadImages', images, saveAs: state.saveAs });
    if (!response?.ok) throw new Error(response?.error || '下载失败');
    if (response.failed?.length) showToast(`已开始下载，${response.failed.length} 张图片无法加入 ZIP`);
    else showToast(asZip ? 'ZIP 已开始下载' : '下载已开始');
  } catch (error) {
    showToast(error.message || '下载失败，请重试');
  } finally {
    render();
  }
}

function setLoading(loading) { els.loading.hidden = !loading; if (loading) { els.grid.replaceChildren(); els.empty.hidden = true; } }
function fileName(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image'); } catch { return 'image'; } }
function getDomainLetter(url) { try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 1).toUpperCase() || '◎'; } catch { return '◎'; } }
function showToast(message) { clearTimeout(state.toastTimer); els.toast.textContent = message; els.toast.classList.add('show'); state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200); }
