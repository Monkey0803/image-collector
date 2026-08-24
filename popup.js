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
  originalOnly: false,
  zipLayout: 'flat',
  filenameTemplate: '{name}',
  dateFolder: false,
  view: 'page',
  libraryScope: 'favorites',
  librarySearch: '',
  libraryRecords: new Map(),
  libraryResults: [],
  duplicateCount: 0,
  dynamicScanPasses: 0,
  dynamicScanTimer: null,
  filterValues: {
    width: { min: null, max: null },
    height: { min: null, max: null }
  },
  toastTimer: null,
  downloadJobId: null,
  retryImages: [],
  retryAsZip: false,
  cancelled: false
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
  originalOnly: $('#originalOnly'), zipLayout: $('#zipLayout'), filenameTemplate: $('#filenameTemplate'), dateFolder: $('#dateFolder'),
  pageView: $('#pageView'), pageViewButton: $('#pageViewButton'), libraryViewButton: $('#libraryViewButton'), historyViewButton: $('#historyViewButton'),
  libraryView: $('#libraryView'), favoriteCount: $('#favoriteCount'), refreshLibrary: $('#refreshLibrary'), libraryScope: $('#libraryScope'),
  librarySearch: $('#librarySearch'), librarySummary: $('#librarySummary'), libraryGrid: $('#libraryGrid'), libraryEmpty: $('#libraryEmpty'),
  historyView: $('#historyView'), clearHistory: $('#clearHistory'), refreshHistory: $('#refreshHistory'), scanHistory: $('#scanHistory'),
  downloadHistory: $('#downloadHistory'), historyEmpty: $('#historyEmpty'),
  exportJson: $('#exportJson'), exportCsv: $('#exportCsv'),
  formatTabs: [...document.querySelectorAll('[data-format]')],
  grid: $('#imageGrid'), empty: $('#emptyState'), loading: $('#loadingState'), error: $('#errorState'),
  saveAs: $('#saveAs'), download: $('#downloadButton'), zip: $('#zipButton'), selectedCount: $('#selectedCount'),
  downloadProgress: $('#downloadProgress'), progressLabel: $('#progressLabel'), progressValue: $('#progressValue'),
  progressBar: $('#progressBar'), progressDetail: $('#progressDetail'), cancelButton: $('#cancelButton'), retryButton: $('#retryButton'),
  retryCount: $('#retryCount'), toast: $('#toast')
};

document.addEventListener('DOMContentLoaded', init);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'downloadProgress' && message.jobId === state.downloadJobId) updateDownloadProgress(message);
});

async function init() {
  const saved = await chrome.storage.local.get({ filters: {}, saveAs: true, searchQuery: '', sort: 'page', originalOnly: false, zipLayout: 'flat', filenameTemplate: '{name}', dateFolder: false });
  const savedFilters = saved.filters && typeof saved.filters === 'object' ? saved.filters : {};
  state.saveAs = typeof saved.saveAs === 'boolean' ? saved.saveAs : true;
  state.searchQuery = typeof saved.searchQuery === 'string' ? saved.searchQuery : '';
  state.sort = ['page', 'width-desc', 'height-desc', 'area-desc', 'name-asc'].includes(saved.sort) ? saved.sort : 'page';
  state.originalOnly = Boolean(saved.originalOnly);
  state.zipLayout = ['flat', 'domain', 'format', 'domain-format'].includes(saved.zipLayout) ? saved.zipLayout : 'flat';
  state.filenameTemplate = typeof saved.filenameTemplate === 'string' && saved.filenameTemplate.trim() ? saved.filenameTemplate : '{name}';
  state.dateFolder = Boolean(saved.dateFolder);
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
  els.originalOnly.checked = state.originalOnly;
  els.zipLayout.value = state.zipLayout;
  els.filenameTemplate.value = state.filenameTemplate;
  els.dateFolder.checked = state.dateFolder;
  await refreshLibraryData();
  bindEvents();
  await scanPage();
}

function bindEvents() {
  els.pageViewButton.addEventListener('click', () => switchView('page'));
  els.libraryViewButton.addEventListener('click', () => switchView('library'));
  els.historyViewButton.addEventListener('click', () => switchView('history'));
  els.refreshLibrary.addEventListener('click', refreshLibraryData);
  els.libraryScope.addEventListener('change', () => {
    state.libraryScope = els.libraryScope.value;
    refreshLibraryData();
  });
  els.librarySearch.addEventListener('input', () => {
    state.librarySearch = els.librarySearch.value.trim();
    refreshLibraryData();
  });
  els.refreshHistory.addEventListener('click', loadHistory);
  els.clearHistory.addEventListener('click', async () => {
    if (!window.confirm('确定清空所有扫描和下载历史吗？')) return;
    try {
      await ImageCollectorDB.clearHistory();
      await loadHistory();
      showToast('历史记录已清空');
    } catch { showToast('历史记录清理失败'); }
  });
  els.refresh.addEventListener('click', scanPage);
  els.clearFilters.addEventListener('click', () => {
    els.minWidth.value = 0;
    els.maxWidth.value = els.maxWidth.max;
    els.minHeight.value = 0;
    els.maxHeight.value = els.maxHeight.max;
    els.searchInput.value = '';
    els.sortSelect.value = 'page';
    els.originalOnly.checked = false;
    state.filterValues = {
      width: { min: null, max: null },
      height: { min: null, max: null }
    };
    state.searchQuery = '';
    state.sort = 'page';
    state.originalOnly = false;
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
  els.originalOnly.addEventListener('change', () => {
    state.originalOnly = els.originalOnly.checked;
    chrome.storage.local.set({ originalOnly: state.originalOnly });
    applyFilters();
  });
  els.zipLayout.addEventListener('change', () => {
    state.zipLayout = els.zipLayout.value;
    chrome.storage.local.set({ zipLayout: state.zipLayout });
  });
  els.filenameTemplate.addEventListener('change', () => {
    state.filenameTemplate = els.filenameTemplate.value.trim() || '{name}';
    els.filenameTemplate.value = state.filenameTemplate;
    chrome.storage.local.set({ filenameTemplate: state.filenameTemplate });
  });
  els.dateFolder.addEventListener('change', () => {
    state.dateFolder = els.dateFolder.checked;
    chrome.storage.local.set({ dateFolder: state.dateFolder });
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
  els.cancelButton.addEventListener('click', async () => {
    if (!state.downloadJobId) return;
    state.cancelled = true;
    els.cancelButton.hidden = true;
    try { await chrome.runtime.sendMessage({ type: 'cancelDownload', jobId: state.downloadJobId }); } catch { /* The worker may finish at the same time. */ }
    updateDownloadProgress({ phase: 'cancelled', percent: 100, detail: '正在取消任务…' });
  });
  els.exportJson.addEventListener('click', () => exportImages('json'));
  els.exportCsv.addEventListener('click', () => exportImages('csv'));
  els.download.addEventListener('click', () => downloadSelected(false));
  els.zip.addEventListener('click', () => downloadSelected(true));
}

async function refreshLibraryData() {
  try {
    const records = await ImageCollectorDB.listImages();
    state.libraryRecords = new Map(records.map((record) => [record.url, record]));
    state.libraryResults = records.filter((record) => {
      if (state.libraryScope === 'favorites' && !record.favorite) return false;
      if (!state.librarySearch) return true;
      const query = state.librarySearch.toLowerCase();
      return [record.url, record.domain, record.format, record.alt, ...record.tags]
        .join(' ').toLowerCase().includes(query);
    });
    els.favoriteCount.textContent = records.filter((record) => record.favorite).length;
    els.libraryScope.value = state.libraryScope;
    els.librarySearch.value = state.librarySearch;
    renderLibrary();
    if (state.view === 'page') render();
  } catch {
    state.libraryRecords = new Map();
    state.libraryResults = [];
    els.favoriteCount.textContent = '0';
    if (state.view === 'library') {
      els.librarySummary.textContent = '本地素材库暂时不可用';
      els.libraryGrid.replaceChildren();
      els.libraryEmpty.hidden = false;
    }
  }
}

function switchView(view) {
  state.view = view;
  const isPage = view === 'page';
  const isLibrary = view === 'library';
  els.pageView.hidden = !isPage;
  els.libraryView.hidden = !isLibrary;
  els.historyView.hidden = isPage || isLibrary;
  [[els.pageViewButton, isPage], [els.libraryViewButton, isLibrary], [els.historyViewButton, view === 'history']].forEach(([button, active]) => {
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (isLibrary) refreshLibraryData();
  if (view === 'history') loadHistory();
}

async function persistScanRecord(scanId) {
  try {
    await ImageCollectorDB.saveScan(state.images, {
      pageUrl: els.pageUrl.textContent,
      pageTitle: els.pageTitle.textContent,
      duplicateCount: state.duplicateCount
    });
    if (scanId === state.scanId) await refreshLibraryData();
  } catch {
    // Scanning remains available when IndexedDB is blocked or unavailable.
  }
}

function createLibraryCard(record) {
  const card = document.createElement('article');
  card.className = 'library-card';
  const wrap = document.createElement('div'); wrap.className = 'thumbnail-wrap';
  const thumbnail = document.createElement('img'); thumbnail.className = 'thumbnail'; thumbnail.src = record.url; thumbnail.alt = record.alt || '网页图片'; thumbnail.loading = 'lazy';
  thumbnail.addEventListener('error', () => { wrap.textContent = '预览不可用'; wrap.style.color = '#9ba4ac'; wrap.style.fontSize = '10px'; });
  wrap.append(thumbnail);
  const actions = document.createElement('div'); actions.className = 'library-card-actions';
  const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = `library-favorite${record.favorite ? ' active' : ''}`; favorite.textContent = record.favorite ? '★' : '☆'; favorite.title = record.favorite ? '取消收藏' : '收藏'; favorite.setAttribute('aria-label', favorite.title); favorite.setAttribute('aria-pressed', record.favorite ? 'true' : 'false');
  favorite.addEventListener('click', async () => { await toggleFavorite(record); });
  const download = document.createElement('button'); download.type = 'button'; download.textContent = '↓'; download.title = '下载图片'; download.setAttribute('aria-label', '下载图片');
  download.addEventListener('click', () => downloadImages([record], false));
  actions.append(favorite, download);
  const meta = document.createElement('div'); meta.className = 'card-meta';
  const sizeRow = document.createElement('div'); sizeRow.className = 'card-size-row';
  const size = document.createElement('span'); size.className = 'card-size'; size.textContent = record.width && record.height ? `${record.width} × ${record.height}` : '尺寸未知';
  const format = document.createElement('span'); format.className = 'format-badge'; format.textContent = formatLabel(record.format);
  sizeRow.append(size, format);
  const name = document.createElement('span'); name.className = 'card-name'; name.textContent = fileName(record.url); name.title = record.url;
  meta.append(sizeRow, name);
  const tags = document.createElement('div'); tags.className = 'tag-list';
  record.tags.forEach((tag) => {
    const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'tag-chip'; chip.textContent = tag; chip.title = `移除标签 ${tag}`;
    chip.addEventListener('click', async () => {
      await setImageTags(record, record.tags.filter((item) => item !== tag));
    });
    tags.append(chip);
  });
  const editor = document.createElement('label'); editor.className = 'tag-editor'; editor.title = '添加标签';
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 30; input.placeholder = '添加标签'; input.setAttribute('aria-label', '添加标签');
  const add = document.createElement('button'); add.type = 'button'; add.textContent = '+'; add.setAttribute('aria-label', '添加标签');
  const addTag = async () => {
    const tag = input.value.trim();
    if (!tag) return;
    await setImageTags(record, [...record.tags, tag]);
  };
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } });
  add.addEventListener('click', addTag);
  editor.append(input, add);
  card.append(wrap, actions, meta, tags, editor);
  return card;
}

function renderLibrary() {
  if (!els.libraryGrid) return;
  els.libraryGrid.replaceChildren();
  const results = state.libraryResults;
  els.librarySummary.textContent = `${results.length} 张图片${state.libraryScope === 'favorites' ? ' · 收藏' : ''}`;
  els.libraryEmpty.hidden = results.length !== 0;
  results.forEach((record) => els.libraryGrid.append(createLibraryCard(record)));
}

async function toggleFavorite(image) {
  try {
    const record = await ImageCollectorDB.toggleFavorite(image.url);
    state.libraryRecords.set(record.url, record);
    await refreshLibraryData();
    showToast(record.favorite ? '已加入收藏' : '已取消收藏');
  } catch { showToast('收藏操作失败'); }
}

async function setImageTags(record, tags) {
  try {
    const updated = await ImageCollectorDB.setTags(record.url, tags);
    state.libraryRecords.set(updated.url, updated);
    await refreshLibraryData();
    showToast('标签已更新');
  } catch { showToast('标签保存失败'); }
}

async function loadHistory() {
  try {
    const [scans, downloads] = await Promise.all([ImageCollectorDB.listScans(30), ImageCollectorDB.listDownloads(30)]);
    renderHistory(scans, downloads);
  } catch {
    els.scanHistory.replaceChildren();
    els.downloadHistory.replaceChildren();
    els.historyEmpty.hidden = false;
  }
}

function renderHistory(scans, downloads) {
  els.scanHistory.replaceChildren();
  els.downloadHistory.replaceChildren();
  scans.forEach((scan) => {
    const item = document.createElement('div'); item.className = 'history-item';
    const icon = document.createElement('span'); icon.className = 'history-item-icon'; icon.textContent = '⌕';
    const copy = document.createElement('div'); copy.className = 'history-item-copy';
    const title = document.createElement('strong'); title.textContent = scan.pageTitle || '未命名页面'; title.title = scan.pageUrl || '';
    const detail = document.createElement('span'); detail.textContent = `${formatDateTime(scan.createdAt)} · ${scan.count} 张图片${scan.duplicateCount ? ` · 去重 ${scan.duplicateCount}` : ''}`;
    copy.append(title, detail); item.append(icon, copy); els.scanHistory.append(item);
  });
  downloads.forEach((download) => {
    const item = document.createElement('div'); item.className = 'history-item';
    const icon = document.createElement('span'); icon.className = 'history-item-icon'; icon.textContent = download.kind === 'zip' ? '▣' : '↓';
    const copy = document.createElement('div'); copy.className = 'history-item-copy';
    const title = document.createElement('strong'); title.textContent = download.kind === 'zip' ? '下载 ZIP' : '下载图片';
    const status = download.status === 'cancelled' ? '已取消' : download.status === 'failed' ? '失败' : download.status === 'partial' ? `部分失败 ${download.failed}` : '已提交';
    const detail = document.createElement('span'); detail.textContent = `${formatDateTime(download.createdAt)} · ${download.count} 项 · ${status}${download.error ? ` · ${download.error}` : ''}`;
    copy.append(title, detail); item.append(icon, copy); els.downloadHistory.append(item);
  });
  els.historyEmpty.hidden = scans.length !== 0 || downloads.length !== 0;
}

function formatDateTime(timestamp) {
  if (!timestamp) return '时间未知';
  return new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function scanPage(options = {}) {
  const quiet = Boolean(options?.quiet);
  if (!quiet && state.dynamicScanTimer) {
    clearTimeout(state.dynamicScanTimer);
    state.dynamicScanTimer = null;
    state.dynamicScanPasses = 0;
  }
  const scanId = ++state.scanId;
  if (!quiet) setLoading(true);
  els.refresh.disabled = true;
  els.scanStatus.textContent = quiet ? '更新中' : '扫描中';
  els.error.hidden = true;
  const previousSelectedUrls = new Set(selectedImages().map((image) => image.url));
  if (!quiet) {
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
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) throw new Error('无法获取当前标签页。');
    if (scanId !== state.scanId) return;
    state.tabId = tab.id;
    els.pageTitle.textContent = tab.title || '当前页面';
    els.pageUrl.textContent = tab.url || '';
    els.pageIcon.textContent = getDomainLetter(tab.url);
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: collectPageImages });
    if (scanId !== state.scanId) return;
    const merged = new Map();
    let duplicateCount = 0;
    for (const result of results || []) {
      const payload = result?.result || {};
      const rawImages = Array.isArray(payload) ? payload : payload.images || [];
      duplicateCount += Array.isArray(payload) ? 0 : Number(payload.duplicateCount || 0);
      for (const image of rawImages) {
        const existing = merged.get(image.url);
        if (existing) {
          duplicateCount += 1;
          if (Boolean(image.original) && !Boolean(existing.original)) merged.set(image.url, image);
        } else {
          merged.set(image.url, image);
        }
      }
    }
    state.duplicateCount = duplicateCount;
    state.images = [...merged.values()].map((image, index) => ({
      ...image,
      format: image.format || 'other',
      id: `${index}-${image.url}`,
      index
    }));
    state.selected.clear();
    state.images.forEach((image) => { if (previousSelectedUrls.has(image.url)) state.selected.add(image.id); });
    els.scanStatus.textContent = `${state.images.length} 张图片${state.duplicateCount ? ` · 去重 ${state.duplicateCount}` : ''}`;
    updateRangeLimits();
    applyFilters();
    if (!quiet) persistScanRecord(scanId);
    loadImageMetadata(scanId);
  } catch (error) {
    if (scanId !== state.scanId) return;
    if (!quiet) {
      state.images = [];
      state.dimensionFiltered = [];
      state.filtered = [];
      state.selected.clear();
      render();
      els.error.hidden = false;
      els.error.textContent = `扫描失败：${error.message || '当前页面不允许扩展访问，请切换到普通网页后重试。'}`;
    }
    els.scanStatus.textContent = '扫描失败';
  } finally {
    if (scanId === state.scanId) {
      setLoading(false);
      els.refresh.disabled = false;
      render();
      scheduleDynamicRescan();
    }
  }
}

function scheduleDynamicRescan() {
  if (state.dynamicScanPasses >= 2 || state.dynamicScanTimer) return;
  const delay = state.dynamicScanPasses === 0 ? 1200 : 3000;
  state.dynamicScanPasses += 1;
  state.dynamicScanTimer = setTimeout(() => {
    state.dynamicScanTimer = null;
    scanPage({ quiet: true });
  }, delay);
}

async function loadImageMetadata(scanId) {
  const images = state.images.slice(0, 300);
  if (!images.length) return;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'inspectImages', images });
    if (scanId !== state.scanId || !Array.isArray(response?.items)) return;
    const metadata = new Map(response.items.map((item) => [item.url, item]));
    state.images.forEach((image) => {
      const item = metadata.get(image.url);
      if (!item) return;
      image.size = Number(item.size) || 0;
      image.mime = item.mime || '';
    });
    applyFilters();
    try {
      await ImageCollectorDB.upsertImages(state.images);
      await refreshLibraryData();
    } catch {
      // Metadata persistence is optional and must not affect the image grid.
    }
  } catch {
    // Metadata is optional; image discovery should remain usable when HEAD is blocked.
  }
}

async function collectPageImages() {
  const found = [];
  const seenUrls = new Map();
  const originalAttributes = [
    'data-original', 'data-original-src', 'data-full', 'data-full-src', 'data-large',
    'data-large-src', 'data-zoom', 'data-zoom-image', 'data-fallback-src', 'data-image-url',
    'data-lazy', 'data-lazy-src', 'data-original-url', 'data-src'
  ];

  const waitForPageToSettle = () => new Promise((resolve) => {
    const root = document.documentElement;
    if (!root || typeof MutationObserver === 'undefined') { setTimeout(resolve, 250); return; }
    let timer = setTimeout(done, 450);
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(done, 350);
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: [
      'src', 'srcset', 'poster', 'data-src', 'data-srcset', 'data-original', 'data-lazy-src', 'style', 'class'
    ] });
    function done() {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    }
    setTimeout(done, 1800);
  });

  await waitForPageToSettle();

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
      frameUrl: location.href,
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
    [image.getAttribute('srcset'), image.srcset, image.getAttribute('data-srcset')].forEach((srcset) => {
      parseSrcset(srcset).forEach((candidate) => {
        push(candidate.rawUrl, 6500 + candidate.widthHint / 100, false, candidate.widthHint);
      });
    });
    push(image.currentSrc, 6000, false);
    push(image.getAttribute('src'), 5000, false);
    ['data-lazy-src', 'data-src', 'data-fallback-src'].forEach((attribute) => push(image.getAttribute(attribute), 4500, false));
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
  for (const video of document.querySelectorAll('video[poster]')) {
    const rect = video.getBoundingClientRect();
    add(video.getAttribute('poster'), video.videoWidth || rect.width, video.videoHeight || rect.height, 'VIDEO', '视频封面', { quality: 5500 });
  }
  for (const object of document.querySelectorAll('object[data]')) {
    const url = normalizeUrl(object.getAttribute('data'));
    if (!url || !imageLikeUrl(url)) continue;
    const rect = object.getBoundingClientRect();
    add(url, rect.width, rect.height, 'OBJECT', '嵌入图片', { quality: 4000 });
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
  const dimensionMatched = state.images.filter((image) =>
    (minWidth === null || image.width >= minWidth) && (maxWidth === null || image.width <= maxWidth) &&
    (minHeight === null || image.height >= minHeight) && (maxHeight === null || image.height <= maxHeight)
  );
  state.dimensionFiltered = dimensionMatched.filter((image) => !state.originalOnly || image.original);
  const formatFiltered = state.format === 'all'
    ? state.dimensionFiltered
    : state.dimensionFiltered.filter((image) => formatCategory(image.format) === state.format);
  const query = state.searchQuery.toLowerCase();
  state.filtered = sortImages(formatFiltered.filter((image) => {
    if (!query) return true;
    let hostname = '';
    try { hostname = new URL(image.url).hostname; } catch { /* Keep URL search available. */ }
    return [fileName(image.url), image.url, hostname, image.frameUrl, image.alt, image.format, image.source, image.original ? '原图 original' : '']
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
  const savedRecord = state.libraryRecords.get(image.url);
  const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = `card-favorite${savedRecord?.favorite ? ' active' : ''}`; favorite.textContent = savedRecord?.favorite ? '★' : '☆'; favorite.title = savedRecord?.favorite ? '取消收藏' : '收藏图片'; favorite.setAttribute('aria-label', favorite.title); favorite.setAttribute('aria-pressed', savedRecord?.favorite ? 'true' : 'false');
  favorite.addEventListener('click', (event) => { event.stopPropagation(); toggleFavorite(image); });
  const wrap = document.createElement('div'); wrap.className = 'thumbnail-wrap';
  const thumbnail = document.createElement('img'); thumbnail.className = 'thumbnail'; thumbnail.src = image.url; thumbnail.alt = image.alt || '网页图片'; thumbnail.loading = 'lazy';
  thumbnail.addEventListener('error', () => { wrap.textContent = '预览不可用'; wrap.style.color = '#9ba4ac'; wrap.style.fontSize = '10px'; });
  wrap.append(thumbnail);
  const meta = document.createElement('div'); meta.className = 'card-meta';
  const size = document.createElement('span'); size.className = 'card-size'; size.textContent = image.width && image.height ? `${image.width} × ${image.height}` : '尺寸未知';
  const sizeRow = document.createElement('div'); sizeRow.className = 'card-size-row';
  const format = document.createElement('span'); format.className = 'format-badge'; format.textContent = image.original ? `${formatLabel(image.format)} · 原图` : formatLabel(image.format);
  const info = document.createElement('span'); info.className = 'card-info'; info.textContent = image.size ? formatBytes(image.size) : image.mime ? image.mime.replace(/^image\//, '') : '';
  info.title = image.mime ? image.mime : '';
  const name = document.createElement('span'); name.className = 'card-name'; name.textContent = fileName(image.url); name.title = image.url;
  sizeRow.append(size, format);
  meta.append(sizeRow, info, name);
  const single = document.createElement('button'); single.type = 'button'; single.className = 'single-download'; single.title = '下载这张图片'; single.setAttribute('aria-label', '下载这张图片'); single.textContent = '↓';
  single.addEventListener('click', (event) => { event.stopPropagation(); downloadImages([image], false); });
  card.append(checkbox, favorite, wrap, meta, single);
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
  state.cancelled = false;
  updateRetryUI();
  els.download.disabled = true;
  els.zip.disabled = true;
  updateDownloadProgress({ phase: 'starting', completed: 0, total: images.length, failed: 0, percent: 0, detail: asZip ? '准备生成 ZIP…' : '准备下载图片…' });
  try {
    const response = await chrome.runtime.sendMessage({
      type: asZip ? 'downloadZip' : 'downloadImages', images, saveAs: state.saveAs,
      zipLayout: state.zipLayout, filenameTemplate: state.filenameTemplate, dateFolder: state.dateFolder, jobId
    });
    const failed = Array.isArray(response?.failed) ? response.failed : [];
    const byUrl = new Map(images.map((image) => [image.url, image]));
    state.retryImages = failed.map((item) => byUrl.get(item.url)).filter(Boolean);
    state.retryAsZip = asZip;
    updateRetryUI();
    if (response?.cancelled) {
      updateDownloadProgress({ phase: 'cancelled', completed: images.length, total: images.length, failed: state.retryImages.length, percent: 100, detail: '任务已取消' });
      showToast('下载任务已取消');
      return;
    }
    if (!response?.ok) throw new Error(response?.error || '下载失败');
    if (failed.length) {
      const reason = failed[0]?.error ? `：${failed[0].error}` : '';
      updateDownloadProgress({ phase: 'complete', completed: images.length, total: images.length, failed: failed.length, percent: 100, detail: `已处理 ${images.length} 张，失败 ${failed.length}${reason}` });
      showToast(`已开始下载，${failed.length} 张图片失败，可点击重试`);
    }
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
  els.progressLabel.textContent = progress.phase === 'compressing' ? '正在压缩' : progress.phase === 'failed' ? '任务失败' : progress.phase === 'cancelled' ? '任务已取消' : progress.phase === 'complete' ? '任务完成' : '下载进度';
  els.progressDetail.textContent = progress.detail || `已处理 ${progress.completed || 0}/${progress.total || 0}`;
  els.cancelButton.hidden = ['complete', 'failed', 'cancelled'].includes(progress.phase);
}

function updateRetryUI() {
  const count = state.retryImages.length;
  els.retryCount.textContent = count;
  els.retryButton.hidden = count === 0;
}

function exportImages(type) {
  if (!state.filtered.length) {
    showToast('当前没有可导出的图片');
    return;
  }
  const records = state.filtered.map((image) => ({
    name: fileName(image.url), url: image.url, width: image.width || 0, height: image.height || 0,
    format: image.format || 'other', mime: image.mime || '', size: image.size || 0,
    source: image.source || '', frameUrl: image.frameUrl || ''
  }));
  const isJson = type === 'json';
  const content = isJson ? JSON.stringify(records, null, 2) : toCsv(records);
  const blob = new Blob([content], { type: isJson ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: `image-list-${dateStamp()}.${isJson ? 'json' : 'csv'}`,
    saveAs: state.saveAs,
    conflictAction: 'uniquify'
  }).then(() => showToast(`${isJson ? 'JSON' : 'CSV'} 清单已开始下载`)).catch((error) => showToast(error.message || '清单导出失败'));
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function toCsv(records) {
  const headers = ['name', 'url', 'width', 'height', 'format', 'mime', 'size', 'source', 'frameUrl'];
  return [headers, ...records.map((record) => headers.map((header) => record[header] ?? ''))]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dateStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
}

function setLoading(loading) { els.loading.hidden = !loading; if (loading) { els.grid.replaceChildren(); els.empty.hidden = true; } }
function fileName(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image'); } catch { return 'image'; } }
function getDomainLetter(url) { try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 1).toUpperCase() || '◎'; } catch { return '◎'; } }
function showToast(message) { clearTimeout(state.toastTimer); els.toast.textContent = message; els.toast.classList.add('show'); state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200); }
