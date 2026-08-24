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
  scanLimit: 500,
  autoScroll: false,
  dynamicScanTimer: null,
  filterValues: {
    width: { min: null, max: null },
    height: { min: null, max: null }
  },
  toastTimer: null,
  downloadJobId: null,
  retryImages: [],
  retryAsZip: false,
  cancelled: false,
  language: 'zh',
  filterPresets: [],
  selectionPresets: [],
  libraryCollection: '',
  collections: [],
  preview: null,
  previewZoom: 1,
  taskRecords: [],
  librarySelected: new Set(), libraryFormat: 'all', libraryMinWidth: '', libraryMaxWidth: '', libraryMinHeight: '', libraryMaxHeight: '', libraryMinSize: '', libraryMaxSize: '', librarySort: 'updated', storageStats: null,
  libraryRefreshToken: 0
};

let filterRenderFrame = null;
let libraryRefreshTimer = null;

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
  pageView: $('#pageView'), pageViewButton: $('#pageViewButton'), libraryViewButton: $('#libraryViewButton'), historyViewButton: $('#historyViewButton'), taskViewButton: $('#taskViewButton'), settingsViewButton: $('#settingsViewButton'),
  libraryView: $('#libraryView'), favoriteCount: $('#favoriteCount'), refreshLibrary: $('#refreshLibrary'), libraryScope: $('#libraryScope'),
  librarySearch: $('#librarySearch'), libraryCollection: $('#libraryCollection'), librarySummary: $('#librarySummary'), libraryGrid: $('#libraryGrid'), libraryEmpty: $('#libraryEmpty'), newCollection: $('#newCollection'), exportLibrary: $('#exportLibrary'), exportLibraryResultsJson: $('#exportLibraryResultsJson'), exportLibraryResultsCsv: $('#exportLibraryResultsCsv'), importLibrary: $('#importLibrary'), importLibraryFile: $('#importLibraryFile'), libraryBatchToolbar: $('#libraryBatchToolbar'), selectAllLibrary: $('#selectAllLibrary'), librarySelectedSummary: $('#librarySelectedSummary'), bulkFavorite: $('#bulkFavorite'), bulkTag: $('#bulkTag'), bulkCollection: $('#bulkCollection'), bulkDelete: $('#bulkDelete'), libraryDownloadSelected: $('#libraryDownloadSelected'), libraryZipSelected: $('#libraryZipSelected'), libraryFormat: $('#libraryFormat'), libraryMinWidth: $('#libraryMinWidth'), libraryMaxWidth: $('#libraryMaxWidth'), libraryMinHeight: $('#libraryMinHeight'), libraryMaxHeight: $('#libraryMaxHeight'), libraryMinSize: $('#libraryMinSize'), libraryMaxSize: $('#libraryMaxSize'), librarySort: $('#librarySort'),
  historyView: $('#historyView'), clearHistory: $('#clearHistory'), refreshHistory: $('#refreshHistory'), scanHistory: $('#scanHistory'),
  downloadHistory: $('#downloadHistory'), historyEmpty: $('#historyEmpty'),
  taskView: $('#taskView'), refreshTasks: $('#refreshTasks'), retryAllTasks: $('#retryAllTasks'), taskSummary: $('#taskSummary'), taskList: $('#taskList'), taskEmpty: $('#taskEmpty'), settingsView: $('#settingsView'), settingsViewButton: $('#settingsViewButton'), refreshStorage: $('#refreshStorage'), storageStats: $('#storageStats'), clearLibrary: $('#clearLibrary'), resetSettings: $('#resetSettings'),
  exportJson: $('#exportJson'), exportCsv: $('#exportCsv'),
  formatTabs: [...document.querySelectorAll('[data-format]')],
  grid: $('#imageGrid'), empty: $('#emptyState'), loading: $('#loadingState'), error: $('#errorState'),
  saveAs: $('#saveAs'), download: $('#downloadButton'), zip: $('#zipButton'), selectedCount: $('#selectedCount'),
  downloadProgress: $('#downloadProgress'), progressLabel: $('#progressLabel'), progressValue: $('#progressValue'),
  progressBar: $('#progressBar'), progressDetail: $('#progressDetail'), cancelButton: $('#cancelButton'), retryButton: $('#retryButton'),
  retryCount: $('#retryCount'), toast: $('#toast'), language: $('#languageButton'), filterPreset: $('#filterPreset'), saveFilterPreset: $('#saveFilterPreset'), deleteFilterPreset: $('#deleteFilterPreset'), selectionPreset: $('#selectionPreset'), saveSelectionPreset: $('#saveSelectionPreset'), invertSelection: $('#invertSelection'), previewModal: $('#previewModal'), previewImage: $('#previewImage'), previewTitle: $('#previewTitle'), previewMeta: $('#previewMeta'), closePreview: $('#closePreview'), copyImageUrl: $('#copyImageUrl'), openImageUrl: $('#openImageUrl'), zoomIn: $('#zoomIn'), zoomOut: $('#zoomOut'), zoomReset: $('#zoomReset'), zoomValue: $('#zoomValue')
};

document.addEventListener('DOMContentLoaded', init);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'downloadProgress' && message.jobId === state.downloadJobId) updateDownloadProgress(message);
  if (message?.type === 'downloadProgress' && state.view === 'tasks') loadTasks();
});

async function init() {
  const saved = await chrome.storage.local.get({ filters: {}, saveAs: true, searchQuery: '', sort: 'page', originalOnly: false, zipLayout: 'flat', filenameTemplate: '{name}', dateFolder: false, language: null, filterPresets: [], selectionPresets: [], scanLimit: 500, autoScroll: false });
  const savedFilters = saved.filters && typeof saved.filters === 'object' ? saved.filters : {};
  state.saveAs = typeof saved.saveAs === 'boolean' ? saved.saveAs : true;
  state.searchQuery = typeof saved.searchQuery === 'string' ? saved.searchQuery : '';
  state.sort = ['page', 'width-desc', 'height-desc', 'area-desc', 'name-asc'].includes(saved.sort) ? saved.sort : 'page';
  state.originalOnly = Boolean(saved.originalOnly);
  state.zipLayout = ['flat', 'domain', 'format', 'domain-format'].includes(saved.zipLayout) ? saved.zipLayout : 'flat';
  state.filenameTemplate = typeof saved.filenameTemplate === 'string' && saved.filenameTemplate.trim() ? saved.filenameTemplate : '{name}';
  state.dateFolder = Boolean(saved.dateFolder);
  state.language = saved.language === 'en' || saved.language === 'zh' ? saved.language : detectLanguage();
  state.filterPresets = Array.isArray(saved.filterPresets) ? saved.filterPresets : [];
  state.selectionPresets = Array.isArray(saved.selectionPresets) ? saved.selectionPresets : [];
  state.scanLimit = [0, 200, 500, 1000].includes(Number(saved.scanLimit)) ? Number(saved.scanLimit) : 500;
  state.autoScroll = Boolean(saved.autoScroll);
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
  els.scanLimit.value = String(state.scanLimit); els.autoScroll.checked = state.autoScroll;
  renderPresets();
  applyLanguage();
  await refreshLibraryData();
  bindEvents();
  await scanPage();
}

function bindEvents() {
  els.pageViewButton.addEventListener('click', () => switchView('page'));
  els.libraryViewButton.addEventListener('click', () => switchView('library'));
  els.historyViewButton.addEventListener('click', () => switchView('history'));
  els.taskViewButton.addEventListener('click', () => switchView('tasks'));
  els.settingsViewButton.addEventListener('click', () => switchView('settings'));
  els.language.addEventListener('click', async () => {
    state.language = state.language === 'zh' ? 'en' : 'zh';
    await chrome.storage.local.set({ language: state.language });
    chrome.runtime.sendMessage({ type: 'languageChanged', language: state.language }).catch(() => {});
    applyLanguage();
    render();
    renderLibrary();
    loadHistory();
    loadTasks();
    if (state.view === 'settings') loadStorageStats();
  });
  els.refreshLibrary.addEventListener('click', refreshLibraryData);
  els.libraryScope.addEventListener('change', () => {
    state.libraryScope = els.libraryScope.value;
    refreshLibraryData();
  });
  els.libraryCollection.addEventListener('change', () => {
    state.libraryCollection = els.libraryCollection.value;
    refreshLibraryData();
  });
  const syncLibraryFilters = () => {
    state.libraryFormat = els.libraryFormat.value; state.libraryMinWidth = els.libraryMinWidth.value; state.libraryMaxWidth = els.libraryMaxWidth.value; state.libraryMinHeight = els.libraryMinHeight.value; state.libraryMaxHeight = els.libraryMaxHeight.value; state.libraryMinSize = els.libraryMinSize.value; state.libraryMaxSize = els.libraryMaxSize.value; state.librarySort = els.librarySort.value; scheduleLibraryRefresh();
  };
  [els.libraryFormat, els.libraryMinWidth, els.libraryMaxWidth, els.libraryMinHeight, els.libraryMaxHeight, els.libraryMinSize, els.libraryMaxSize, els.librarySort].forEach((control) => control.addEventListener('input', syncLibraryFilters));
  els.librarySort.addEventListener('change', syncLibraryFilters);
  els.selectAllLibrary.addEventListener('change', () => {
    if (els.selectAllLibrary.checked) state.libraryResults.forEach((record) => state.librarySelected.add(record.url));
    else state.libraryResults.forEach((record) => state.librarySelected.delete(record.url));
    renderLibrary();
  });
  els.bulkFavorite.addEventListener('click', () => bulkUpdateLibrary('favorite'));
  els.bulkTag.addEventListener('click', () => bulkUpdateLibrary('tag'));
  els.bulkCollection.addEventListener('click', () => bulkUpdateLibrary('collection'));
  els.bulkDelete.addEventListener('click', () => bulkUpdateLibrary('delete'));
  els.libraryDownloadSelected.addEventListener('click', () => downloadImages(selectedLibraryImages(), false));
  els.libraryZipSelected.addEventListener('click', () => downloadImages(selectedLibraryImages(), true));
  els.exportLibraryResultsJson.addEventListener('click', () => exportLibraryResults('json'));
  els.exportLibraryResultsCsv.addEventListener('click', () => exportLibraryResults('csv'));
  els.librarySearch.addEventListener('input', () => {
    state.librarySearch = els.librarySearch.value.trim();
    scheduleLibraryRefresh();
  });
  els.refreshHistory.addEventListener('click', loadHistory);
  els.refreshTasks.addEventListener('click', loadTasks);
  els.retryAllTasks.addEventListener('click', retryAllTasks);
  els.refreshStorage.addEventListener('click', loadStorageStats);
  els.clearLibrary.addEventListener('click', clearLocalLibrary);
  els.resetSettings.addEventListener('click', resetExtensionSettings);
  els.scanLimit.addEventListener('change', async () => { state.scanLimit = Number(els.scanLimit.value) || 0; await chrome.storage.local.set({ scanLimit: state.scanLimit }); });
  els.autoScroll.addEventListener('change', async () => { state.autoScroll = els.autoScroll.checked; await chrome.storage.local.set({ autoScroll: state.autoScroll }); });
  els.newCollection.addEventListener('click', createNewCollection);
  els.exportLibrary.addEventListener('click', exportLibraryData);
  els.importLibrary.addEventListener('click', () => els.importLibraryFile.click());
  els.importLibraryFile.addEventListener('change', importLibraryData);
  els.clearHistory.addEventListener('click', async () => {
    if (!window.confirm(t('clearHistoryConfirm'))) return;
    try {
      await ImageCollectorDB.clearHistory();
      await loadHistory();
      showToast(t('historyCleared'));
    } catch { showToast(t('historyClearFailed')); }
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
    scheduleApplyFilters();
  });
  els.filterPreset.addEventListener('change', applyFilterPreset);
  els.saveFilterPreset.addEventListener('click', saveFilterPreset);
  els.deleteFilterPreset.addEventListener('click', deleteFilterPreset);
  els.minWidth.addEventListener('input', () => handleRangeInput('width', 'min'));
  els.maxWidth.addEventListener('input', () => handleRangeInput('width', 'max'));
  els.minHeight.addEventListener('input', () => handleRangeInput('height', 'min'));
  els.maxHeight.addEventListener('input', () => handleRangeInput('height', 'max'));
  els.searchInput.addEventListener('input', () => {
    state.searchQuery = els.searchInput.value.trim();
    chrome.storage.local.set({ searchQuery: state.searchQuery });
    scheduleApplyFilters();
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
  els.invertSelection.addEventListener('click', () => {
    state.filtered.forEach((image) => state.selected[state.selected.has(image.id) ? 'delete' : 'add'](image.id));
    render();
  });
  els.selectionPreset.addEventListener('change', applySelectionPreset);
  els.saveSelectionPreset.addEventListener('click', saveSelectionPreset);
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
    updateDownloadProgress({ phase: 'cancelled', percent: 100, detail: t('cancelling') });
  });
  els.exportJson.addEventListener('click', () => exportImages('json'));
  els.exportCsv.addEventListener('click', () => exportImages('csv'));
  els.download.addEventListener('click', () => downloadSelected(false));
  els.zip.addEventListener('click', () => downloadSelected(true));
  els.closePreview.addEventListener('click', closePreview);
  els.previewModal.addEventListener('click', (event) => { if (event.target.matches('[data-close-preview]')) closePreview(); });
  els.copyImageUrl.addEventListener('click', copyPreviewUrl);
  els.openImageUrl.addEventListener('click', () => { if (state.preview?.url) chrome.tabs.create({ url: state.preview.url }); });
  els.zoomIn.addEventListener('click', () => changePreviewZoom(.25));
  els.zoomOut.addEventListener('click', () => changePreviewZoom(-.25));
  els.zoomReset.addEventListener('click', () => { state.previewZoom = 1; updatePreviewZoom(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !els.previewModal.hidden) closePreview(); });
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea, select')) return;
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'a') { event.preventDefault(); els.selectAll.click(); return; }
    if (key === 'i') { event.preventDefault(); els.invertSelection.click(); return; }
    if (key === '/') { event.preventDefault(); els.searchInput.focus(); return; }
    if (key === 'r') { event.preventDefault(); scanPage(); }
  });
}

async function refreshLibraryData() {
  const refreshToken = ++state.libraryRefreshToken;
  try {
    const [records, collections] = await Promise.all([ImageCollectorDB.listImages(), ImageCollectorDB.listCollections()]);
    if (refreshToken !== state.libraryRefreshToken) return;
    state.collections = collections;
    state.libraryRecords = new Map(records.map((record) => [record.url, record]));
    state.libraryResults = records.filter((record) => {
      if (state.libraryScope === 'favorites' && !record.favorite) return false;
      if (state.libraryCollection === '__uncategorized' && record.collectionIds?.length) return false;
      if (state.libraryCollection && state.libraryCollection !== '__uncategorized' && !record.collectionIds?.includes(state.libraryCollection)) return false;
      if (state.libraryFormat !== 'all' && formatCategory(record.format) !== state.libraryFormat) return false;
      if (state.libraryMinWidth && record.width < Number(state.libraryMinWidth)) return false;
      if (state.libraryMaxWidth && record.width && record.width > Number(state.libraryMaxWidth)) return false;
      if (state.libraryMinHeight && record.height < Number(state.libraryMinHeight)) return false;
      if (state.libraryMaxHeight && record.height && record.height > Number(state.libraryMaxHeight)) return false;
      const size = Number(record.size) || 0;
      if (state.libraryMinSize && (!size || size < Number(state.libraryMinSize) * 1024)) return false;
      if (state.libraryMaxSize && size && size > Number(state.libraryMaxSize) * 1024) return false;
      if (!state.librarySearch) return true;
      const query = state.librarySearch.toLowerCase();
      return [record.url, record.domain, record.format, record.alt, ...record.tags]
        .join(' ').toLowerCase().includes(query);
    }).sort((left, right) => {
      if (state.librarySort === 'width') return (right.width || 0) - (left.width || 0);
      if (state.librarySort === 'height') return (right.height || 0) - (left.height || 0);
      if (state.librarySort === 'size') return (right.size || 0) - (left.size || 0);
      return (right.updatedAt || 0) - (left.updatedAt || 0);
    });
    const visibleUrls = new Set(state.libraryResults.map((record) => record.url));
    state.librarySelected.forEach((url) => { if (!visibleUrls.has(url)) state.librarySelected.delete(url); });
    els.favoriteCount.textContent = records.filter((record) => record.favorite).length;
    els.libraryScope.value = state.libraryScope;
    renderCollectionOptions();
    els.libraryCollection.value = state.libraryCollection;
    els.libraryFormat.value = state.libraryFormat; els.libraryMinWidth.value = state.libraryMinWidth; els.libraryMaxWidth.value = state.libraryMaxWidth; els.libraryMinHeight.value = state.libraryMinHeight; els.libraryMaxHeight.value = state.libraryMaxHeight; els.libraryMinSize.value = state.libraryMinSize; els.libraryMaxSize.value = state.libraryMaxSize; els.librarySort.value = state.librarySort;
    els.librarySearch.value = state.librarySearch;
    renderLibrary();
    if (state.view === 'page') render();
  } catch {
    if (refreshToken !== state.libraryRefreshToken) return;
    state.libraryRecords = new Map();
    state.libraryResults = [];
    els.favoriteCount.textContent = '0';
    if (state.view === 'library') {
      els.librarySummary.textContent = t('storageUnavailable');
      els.libraryGrid.replaceChildren();
      els.libraryEmpty.hidden = false;
    }
  }
}

function scheduleLibraryRefresh() {
  clearTimeout(libraryRefreshTimer);
  libraryRefreshTimer = setTimeout(() => {
    libraryRefreshTimer = null;
    refreshLibraryData();
  }, 160);
}

function renderCollectionOptions() {
  if (!els.libraryCollection) return;
  const current = state.libraryCollection;
  els.libraryCollection.replaceChildren();
  const all = document.createElement('option'); all.value = ''; all.textContent = t('allCollections'); els.libraryCollection.append(all);
  const uncategorized = document.createElement('option'); uncategorized.value = '__uncategorized'; uncategorized.textContent = t('uncategorized'); els.libraryCollection.append(uncategorized);
  state.collections.forEach((collection) => {
    const option = document.createElement('option'); option.value = collection.id; option.textContent = collection.name; els.libraryCollection.append(option);
  });
  els.libraryCollection.value = [...els.libraryCollection.options].some((option) => option.value === current) ? current : '';
}

function switchView(view) {
  state.view = view;
  const isPage = view === 'page';
  const isLibrary = view === 'library';
  const isTasks = view === 'tasks';
  const isSettings = view === 'settings';
  els.pageView.hidden = !isPage;
  els.libraryView.hidden = !isLibrary;
  els.historyView.hidden = isPage || isLibrary || isTasks || isSettings;
  els.taskView.hidden = !isTasks;
  els.settingsView.hidden = !isSettings;
  [[els.pageViewButton, isPage], [els.libraryViewButton, isLibrary], [els.historyViewButton, view === 'history'], [els.taskViewButton, isTasks], [els.settingsViewButton, isSettings]].forEach(([button, active]) => {
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (isLibrary) refreshLibraryData();
  if (view === 'history') loadHistory();
  if (isTasks) loadTasks();
  if (isSettings) loadStorageStats();
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
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'library-card-check'; checkbox.checked = state.librarySelected.has(record.url); checkbox.setAttribute('aria-label', t('selectNamedImage', { name: fileName(record.url) }));
  checkbox.addEventListener('click', (event) => event.stopPropagation());
  checkbox.addEventListener('change', () => { if (checkbox.checked) state.librarySelected.add(record.url); else state.librarySelected.delete(record.url); renderLibrary(); });
  const wrap = document.createElement('div'); wrap.className = 'thumbnail-wrap';
  const thumbnail = document.createElement('img'); thumbnail.className = 'thumbnail'; thumbnail.src = record.url; thumbnail.alt = record.alt || t('webImage'); thumbnail.loading = 'lazy';
  thumbnail.addEventListener('error', () => { wrap.textContent = t('previewUnavailable'); wrap.style.color = '#9ba4ac'; wrap.style.fontSize = '10px'; });
  thumbnail.addEventListener('click', (event) => { event.stopPropagation(); openPreview(record); });
  wrap.append(thumbnail);
  const actions = document.createElement('div'); actions.className = 'library-card-actions';
  const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = `library-favorite${record.favorite ? ' active' : ''}`; favorite.textContent = record.favorite ? '★' : '☆'; favorite.title = record.favorite ? t('removeFavorite') : t('favorite'); favorite.setAttribute('aria-label', favorite.title); favorite.setAttribute('aria-pressed', record.favorite ? 'true' : 'false');
  favorite.addEventListener('click', async () => { await toggleFavorite(record); });
  const download = document.createElement('button'); download.type = 'button'; download.textContent = '↓'; download.title = t('downloadImage'); download.setAttribute('aria-label', t('downloadImage'));
  download.addEventListener('click', () => downloadImages([record], false));
  actions.append(favorite, download);
  const meta = document.createElement('div'); meta.className = 'card-meta';
  const sizeRow = document.createElement('div'); sizeRow.className = 'card-size-row';
  const size = document.createElement('span'); size.className = 'card-size'; size.textContent = record.width && record.height ? `${record.width} × ${record.height}` : t('unknownSize');
  const format = document.createElement('span'); format.className = 'format-badge'; format.textContent = formatLabel(record.format);
  sizeRow.append(size, format);
  const name = document.createElement('span'); name.className = 'card-name'; name.textContent = fileName(record.url); name.title = record.url;
  meta.append(sizeRow, name);
  const tags = document.createElement('div'); tags.className = 'tag-list';
  record.tags.forEach((tag) => {
    const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'tag-chip'; chip.textContent = tag; chip.title = t('removeTag', { tag });
    chip.addEventListener('click', async () => {
      await setImageTags(record, record.tags.filter((item) => item !== tag));
    });
    tags.append(chip);
  });
  const collectionSelect = document.createElement('select'); collectionSelect.className = 'card-collection'; collectionSelect.title = t('chooseCollection'); collectionSelect.setAttribute('aria-label', t('chooseCollection'));
  const noCollection = document.createElement('option'); noCollection.value = ''; noCollection.textContent = t('uncategorized'); collectionSelect.append(noCollection);
  state.collections.forEach((collection) => { const option = document.createElement('option'); option.value = collection.id; option.textContent = collection.name; collectionSelect.append(option); });
  collectionSelect.value = record.collectionIds?.[0] || '';
  collectionSelect.addEventListener('change', async () => {
    await setImageCollections(record, collectionSelect.value ? [collectionSelect.value] : []);
  });
  const editor = document.createElement('label'); editor.className = 'tag-editor'; editor.title = t('addTag');
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 30; input.placeholder = t('addTag'); input.setAttribute('aria-label', t('addTag'));
  const add = document.createElement('button'); add.type = 'button'; add.textContent = '+'; add.setAttribute('aria-label', t('addTag'));
  const addTag = async () => {
    const tag = input.value.trim();
    if (!tag) return;
    await setImageTags(record, [...record.tags, tag]);
  };
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } });
  add.addEventListener('click', addTag);
  editor.append(input, add);
  card.append(checkbox, wrap, actions, meta, tags, collectionSelect, editor);
  return card;
}

function renderLibrary() {
  if (!els.libraryGrid) return;
  els.libraryGrid.replaceChildren();
  const results = state.libraryResults;
  els.librarySummary.textContent = state.language === 'en'
    ? `${results.length} ${t('images')}${state.libraryScope === 'favorites' ? ` · ${t('favorites')}` : ''}`
    : `${results.length} ${t('images')}${state.libraryScope === 'favorites' ? ` · ${t('favorites')}` : ''}`;
  const selectedCount = state.librarySelected.size;
  els.libraryBatchToolbar.hidden = results.length === 0;
  els.librarySelectedSummary.textContent = `${t('selected')} ${selectedCount}`;
  els.selectAllLibrary.checked = results.length > 0 && results.every((record) => state.librarySelected.has(record.url));
  els.libraryDownloadSelected.disabled = selectedCount === 0;
  els.libraryZipSelected.disabled = selectedCount === 0;
  els.libraryEmpty.hidden = results.length !== 0;
  const fragment = document.createDocumentFragment();
  results.forEach((record) => fragment.append(createLibraryCard(record)));
  els.libraryGrid.append(fragment);
}

async function toggleFavorite(image) {
  try {
    const record = await ImageCollectorDB.toggleFavorite(image.url);
    state.libraryRecords.set(record.url, record);
    await refreshLibraryData();
    showToast(record.favorite ? t('favoriteAdded') : t('favoriteRemoved'));
  } catch { showToast(t('favoriteFailed')); }
}

async function setImageTags(record, tags) {
  try {
    const updated = await ImageCollectorDB.setTags(record.url, tags);
    state.libraryRecords.set(updated.url, updated);
    await refreshLibraryData();
    showToast(t('tagUpdated'));
  } catch { showToast(t('tagSaveFailed')); }
}

async function setImageCollections(record, collectionIds) {
  try {
    await ImageCollectorDB.setImageCollections(record.url, collectionIds);
    await refreshLibraryData();
    showToast(t('collectionUpdated'));
  } catch { showToast(t('collectionUpdateFailed')); }
}

async function bulkUpdateLibrary(action) {
  const urls = [...state.librarySelected];
  if (!urls.length) { showToast(t('selectBeforeAction')); return; }
  try {
    if (action === 'favorite') {
      await ImageCollectorDB.bulkUpdateImages(urls, { favorite: true });
      showToast(t('bulkFavoriteDone'));
    } else if (action === 'tag') {
      const tag = window.prompt(t('bulkTagPrompt'));
      if (!tag?.trim()) return;
      await ImageCollectorDB.bulkUpdateImages(urls, (record) => ({ tags: [...(record.tags || []), tag] }));
      showToast(t('bulkTagDone'));
    } else if (action === 'collection') {
      if (!state.collections.length) { showToast(t('createCollectionFirst')); return; }
      const names = state.collections.map((collection, index) => `${index + 1}. ${collection.name}`).join('\n');
      const choice = Number(window.prompt(`${t('bulkCollectionPrompt')}\n${names}`));
      const collection = state.collections[choice - 1]; if (!collection) return;
      await ImageCollectorDB.bulkUpdateImages(urls, { collectionIds: [collection.id] });
      showToast(t('bulkCollectionDone'));
    } else if (action === 'delete') {
      if (!window.confirm(t('bulkDeleteConfirm'))) return;
      await ImageCollectorDB.deleteImages(urls); state.librarySelected.clear(); showToast(t('bulkDeleteDone'));
    }
    await refreshLibraryData();
  } catch { showToast(t('bulkActionFailed')); }
}

async function loadStorageStats() {
  try {
    state.storageStats = await ImageCollectorDB.getStorageStats();
    const stats = state.storageStats;
    els.storageStats.textContent = `${stats.images} ${t('images')} · ${stats.favorites} ${t('favorites')} · ${stats.collections} ${t('collections')} · ${formatBytes(stats.bytes)}`;
  } catch { els.storageStats.textContent = t('storageUnavailable'); }
}

async function clearLocalLibrary() {
  if (!window.confirm(t('clearLibraryConfirm'))) return;
  try { await ImageCollectorDB.clearLibrary(); state.librarySelected.clear(); await refreshLibraryData(); await loadStorageStats(); showToast(t('libraryCleared')); } catch { showToast(t('clearLibraryFailed')); }
}

async function resetExtensionSettings() {
  if (!window.confirm(t('resetSettingsConfirm'))) return;
  await chrome.storage.local.clear();
  showToast(t('settingsReset'));
  setTimeout(() => window.location.reload(), 250);
}

async function createNewCollection() {
  const name = window.prompt(t('newCollectionPrompt'));
  if (!name?.trim()) return;
  try {
    const collection = await ImageCollectorDB.createCollection(name);
    state.libraryCollection = collection.id;
    await refreshLibraryData();
    showToast(t('collectionCreated'));
  } catch { showToast(t('collectionCreateFailed')); }
}

async function exportLibraryData() {
  try {
    const data = await ImageCollectorDB.exportLibrary();
    downloadTextFile(JSON.stringify(data, null, 2), `image-collector-library-${dateStamp()}.json`, 'application/json');
    showToast(t('libraryExported'));
  } catch { showToast(t('libraryExportFailed')); }
}

function exportLibraryResults(type) {
  if (!state.libraryResults.length) { showToast(t('libraryResultsEmpty')); return; }
  const records = state.libraryResults.map((record) => ({
    name: fileName(record.url), url: record.url, width: record.width || 0, height: record.height || 0,
    format: record.format || 'other', mime: record.mime || '', size: record.size || 0,
    source: record.source || '', frameUrl: record.frameUrl || '', favorite: Boolean(record.favorite),
    tags: record.tags || [], collectionIds: record.collectionIds || [], updatedAt: record.updatedAt || 0
  }));
  const isJson = type === 'json';
  const content = isJson ? JSON.stringify(records, null, 2) : toCsv(records);
  downloadTextFile(content, `image-collector-filtered-${dateStamp()}.${isJson ? 'json' : 'csv'}`, isJson ? 'application/json' : 'text/csv');
  showToast(t('libraryResultsExported'));
}

function importLibraryData(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(String(reader.result || '{}'));
      const result = await ImageCollectorDB.importLibrary(data);
      await refreshLibraryData();
      showToast(`${t('libraryImported')} ${result.images || 0}`);
    } catch { showToast(t('libraryImportFailed')); }
  };
  reader.onerror = () => showToast(t('libraryImportFailed'));
  reader.readAsText(file);
}

function downloadTextFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  chrome.downloads.download({ url, filename, saveAs: true, conflictAction: 'uniquify' }).catch(() => {});
  setTimeout(() => URL.revokeObjectURL(url), 30000);
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

async function loadTasks() {
  try {
    state.taskRecords = await ImageCollectorDB.listDownloads(50);
    renderTasks();
  } catch {
    state.taskRecords = [];
    renderTasks();
  }
}

function renderTasks() {
  if (!els.taskList) return;
  els.taskList.replaceChildren();
  const records = state.taskRecords;
  const active = records.filter((record) => ['queued', 'running', 'paused'].includes(record.status)).length;
  els.taskSummary.textContent = `${records.length} ${t('taskCount')}${active ? ` · ${active} ${t('activeTasks')}` : ''}`;
  els.taskEmpty.hidden = records.length !== 0;
  records.forEach((record) => {
    const item = document.createElement('article'); item.className = 'task-item';
    const header = document.createElement('div'); header.className = 'task-item-header';
    const title = document.createElement('strong'); title.textContent = record.kind === 'zip' ? t('downloadZip') : t('imageDownload');
    const status = document.createElement('span'); status.className = `task-status ${record.status}`; status.textContent = taskStatusLabel(record.status);
    header.append(title, status);
    const progress = document.createElement('div'); progress.className = 'task-progress-track';
    const bar = document.createElement('span'); bar.style.width = `${Math.max(0, Math.min(100, record.percent || 0))}%`; progress.append(bar);
    const detail = document.createElement('div'); detail.className = 'task-detail'; detail.textContent = record.detail || `${record.count || 0} ${t('items')}`;
    const footer = document.createElement('div'); footer.className = 'task-item-footer';
    const time = document.createElement('span'); time.textContent = formatDateTime(record.updatedAt || record.createdAt);
    footer.append(time);
    if (['queued', 'running', 'paused'].includes(record.status) && record.jobId) {
      const pause = document.createElement('button'); pause.type = 'button'; pause.className = 'subtle-button'; pause.textContent = record.status === 'paused' ? t('resume') : t('pause'); pause.addEventListener('click', () => sendTaskAction(record, record.status === 'paused' ? 'resumeDownload' : 'pauseDownload'));
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'subtle-button danger'; cancel.textContent = t('cancel'); cancel.addEventListener('click', () => sendTaskAction(record, 'cancelDownload'));
      footer.append(pause, cancel);
    }
    if (['failed', 'partial'].includes(record.status) && record.urls?.length) {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'subtle-button'; retry.textContent = t('retry'); retry.addEventListener('click', () => downloadImages(record.urls.map((url) => ({ url })), record.kind === 'zip'));
      footer.append(retry);
    }
    item.append(header, progress, detail, footer); els.taskList.append(item);
  });
}

function taskStatusLabel(status) {
  const labels = { queued: t('queued'), running: t('running'), paused: t('paused'), completed: t('completed'), started: t('completed'), partial: t('partial'), failed: t('failed'), cancelled: t('cancelled') };
  return labels[status] || status;
}

async function sendTaskAction(record, type) {
  try {
    await chrome.runtime.sendMessage({ type, jobId: record.jobId });
    await loadTasks();
  } catch { showToast(t('taskActionFailed')); }
}

async function retryAllTasks() {
  const failed = state.taskRecords.filter((record) => ['failed', 'partial'].includes(record.status) && record.urls?.length);
  if (!failed.length) { showToast(t('noFailedTasks')); return; }
  for (const record of failed) await downloadImages(record.urls.map((url) => ({ url })), record.kind === 'zip');
  await loadTasks();
}

function openPreview(image) {
  if (!image?.url) return;
  state.preview = image;
  state.previewZoom = 1;
  els.previewImage.src = image.url;
  els.previewImage.alt = image.alt || t('imagePreview');
  els.previewTitle.textContent = fileName(image.url);
  els.previewMeta.textContent = `${image.width && image.height ? `${image.width} × ${image.height}px` : t('unknownSize')} · ${formatLabel(image.format)}${image.original ? ` · ${t('original')}` : ''}`;
  updatePreviewZoom();
  els.previewModal.hidden = false;
  els.closePreview.focus();
}

function closePreview() {
  els.previewModal.hidden = true;
  els.previewImage.removeAttribute('src');
  state.preview = null;
}

function changePreviewZoom(delta) {
  state.previewZoom = Math.max(.25, Math.min(4, state.previewZoom + delta));
  updatePreviewZoom();
}

function updatePreviewZoom() {
  if (!state.preview) return;
  els.previewImage.style.transform = `scale(${state.previewZoom})`;
  els.zoomValue.textContent = `${Math.round(state.previewZoom * 100)}%`;
}

async function copyPreviewUrl() {
  if (!state.preview?.url) return;
  try {
    await navigator.clipboard.writeText(state.preview.url);
    showToast(t('copied'));
  } catch { showToast(t('copyFailed')); }
}

function renderHistory(scans, downloads) {
  els.scanHistory.replaceChildren();
  els.downloadHistory.replaceChildren();
  scans.forEach((scan) => {
    const item = document.createElement('div'); item.className = 'history-item';
    const icon = document.createElement('span'); icon.className = 'history-item-icon'; icon.textContent = '⌕';
    const copy = document.createElement('div'); copy.className = 'history-item-copy';
    const title = document.createElement('strong'); title.textContent = scan.pageTitle || t('unnamedPage'); title.title = scan.pageUrl || '';
    const detail = document.createElement('span'); detail.textContent = `${formatDateTime(scan.createdAt)} · ${t('imageCount', { count: scan.count })}${scan.duplicateCount ? ` · ${t('duplicates', { count: scan.duplicateCount })}` : ''}`;
    copy.append(title, detail); item.append(icon, copy); els.scanHistory.append(item);
  });
  downloads.forEach((download) => {
    const item = document.createElement('div'); item.className = 'history-item';
    const icon = document.createElement('span'); icon.className = 'history-item-icon'; icon.textContent = download.kind === 'zip' ? '▣' : '↓';
    const copy = document.createElement('div'); copy.className = 'history-item-copy';
    const title = document.createElement('strong'); title.textContent = download.kind === 'zip' ? t('downloadZip') : t('imageDownload');
    const status = download.status === 'cancelled' ? t('cancelled') : download.status === 'failed' ? t('failed') : download.status === 'partial' ? t('partialFailed', { count: download.failed }) : t('submitted');
    const detail = document.createElement('span'); detail.textContent = `${formatDateTime(download.createdAt)} · ${t('itemCount', { count: download.count })} · ${status}${download.error ? ` · ${download.error}` : ''}`;
    copy.append(title, detail); item.append(icon, copy); els.downloadHistory.append(item);
  });
  els.historyEmpty.hidden = scans.length !== 0 || downloads.length !== 0;
}

function formatDateTime(timestamp) {
  if (!timestamp) return t('unknownTime');
  return new Date(timestamp).toLocaleString(state.language === 'en' ? 'en-US' : 'zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
  els.scanStatus.textContent = quiet ? t('updating') : t('scanningStatus');
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
    if (!tab?.id) throw new Error(t('noActiveTab'));
    if (scanId !== state.scanId) return;
    state.tabId = tab.id;
    els.pageTitle.textContent = tab.title || t('currentPage');
    els.pageUrl.textContent = tab.url || '';
    els.pageIcon.textContent = getDomainLetter(tab.url);
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: collectPageImages, args: [{ limit: state.scanLimit, autoScroll: state.autoScroll, language: state.language }] });
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
    updateScanStatus();
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
      els.error.textContent = `${t('scanFailedPrefix')}${error.message || t('pageAccessError')}`;
    }
    els.scanStatus.textContent = t('scanFailed');
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

async function collectPageImages(options = {}) {
  const found = [];
  const seenUrls = new Map();
  const fingerprintCache = new WeakMap();
  const maxCssElements = 2500;
  const maxFingerprints = 400;
  const requestedLimit = Number(options.limit) || 0;
  const candidateLimit = requestedLimit > 0 ? Math.max(requestedLimit + 100, requestedLimit * 2) : 0;
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

  if (options.autoScroll) {
    const originalY = window.scrollY;
    let y = 0;
    for (let pass = 0; pass < 40; pass += 1) {
      const height = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0);
      if (y > height) break;
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 180));
      y += Math.max(window.innerHeight || 800, 800);
    }
    window.scrollTo(0, originalY);
  }
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
    if (candidateLimit && found.length >= candidateLimit) return;
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
    setTimeout(() => finish(fallbackWidth, fallbackHeight), 1200);
  });

  const fingerprint = (image) => {
    if (!image || !image.complete || !image.naturalWidth) return '';
    if (fingerprintCache.has(image)) return fingerprintCache.get(image);
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
      const value = `${image.naturalWidth}x${image.naturalHeight}:${hash >>> 0}`;
      fingerprintCache.set(image, value);
      return value;
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
    add(video.getAttribute('poster'), video.videoWidth || rect.width, video.videoHeight || rect.height, 'VIDEO', options.language === 'en' ? 'Video poster' : '视频封面', { quality: 5500 });
  }
  for (const object of document.querySelectorAll('object[data]')) {
    const url = normalizeUrl(object.getAttribute('data'));
    if (!url || !imageLikeUrl(url)) continue;
    const rect = object.getBoundingClientRect();
    add(url, rect.width, rect.height, 'OBJECT', options.language === 'en' ? 'Embedded image' : '嵌入图片', { quality: 4000 });
  }
  const allElements = [...document.querySelectorAll('*')];
  const cssElements = allElements.length > maxCssElements
    ? allElements.filter((element) => element.hasAttribute('style') || element.id || element.className).slice(0, maxCssElements)
    : allElements;
  for (const element of cssElements) {
    const background = getComputedStyle(element).backgroundImage || '';
    const matches = [...background.matchAll(/url\((?:"|')?(.*?)(?:"|')?\)/g)];
    if (!matches.length) continue;
    const rect = element.getBoundingClientRect();
    for (const match of matches) {
      add(match[1], rect?.width, rect?.height, 'CSS', options.language === 'en' ? 'Background image' : '背景图片', { quality: 2000 });
    }
  }

  const processInBatches = async (items, concurrency, worker) => {
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index], index);
      }
    });
    await Promise.all(workers);
  };
  await processInBatches(found, 8, async (entry, index) => {
    if (entry.original && entry.url !== entry.displayUrl) {
      const dimensions = await probeDimensions(entry.url, entry.width || entry.widthHint, entry.height);
      entry.width = dimensions.width;
      entry.height = dimensions.height;
    }
    entry.contentKey = index < maxFingerprints ? fingerprint(entry.element) : '';
    delete entry.element;
  });

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
  const images = [...unique.values()].map(({ contentKey, ...image }) => image);
  return { images: options.limit ? images.slice(0, Number(options.limit)) : images, duplicateCount };
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
    return [fileName(image.url), image.url, hostname, image.frameUrl, image.alt, image.format, image.source, image.original ? `${t('original')} original` : '']
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

function renderPresets() {
  const selectedFilter = els.filterPreset.value;
  els.filterPreset.replaceChildren(new Option(t('filterPreset'), ''));
  state.filterPresets.forEach((preset) => els.filterPreset.append(new Option(preset.name, preset.id)));
  els.filterPreset.value = state.filterPresets.some((preset) => preset.id === selectedFilter) ? selectedFilter : '';
  els.deleteFilterPreset.disabled = !els.filterPreset.value;
  const selectedSelection = els.selectionPreset.value;
  els.selectionPreset.replaceChildren(new Option(t('selectionPreset'), ''));
  state.selectionPresets.forEach((preset) => els.selectionPreset.append(new Option(`${preset.name} (${preset.urls.length})`, preset.id)));
  els.selectionPreset.value = state.selectionPresets.some((preset) => preset.id === selectedSelection) ? selectedSelection : '';
}

function currentFilterPreset() {
  return {
    width: { ...state.filterValues.width }, height: { ...state.filterValues.height }, format: state.format,
    searchQuery: state.searchQuery, sort: state.sort, originalOnly: state.originalOnly
  };
}

async function saveFilterPreset() {
  const name = window.prompt(t('filterPresetPrompt'));
  if (!name?.trim()) return;
  state.filterPresets.push({ id: `filter-${Date.now()}`, name: name.trim().slice(0, 40), ...currentFilterPreset() });
  await chrome.storage.local.set({ filterPresets: state.filterPresets });
  renderPresets();
  showToast(t('presetSaved'));
}

function applyFilterPreset() {
  const preset = state.filterPresets.find((item) => item.id === els.filterPreset.value);
  if (!preset) return;
  state.filterValues = { width: { ...preset.width }, height: { ...preset.height } };
  state.format = preset.format || 'all'; state.searchQuery = preset.searchQuery || ''; state.sort = preset.sort || 'page'; state.originalOnly = Boolean(preset.originalOnly);
  els.searchInput.value = state.searchQuery; els.sortSelect.value = state.sort; els.originalOnly.checked = state.originalOnly;
  updateRangeLimits(); applyFilters();
}

async function deleteFilterPreset() {
  const id = els.filterPreset.value;
  if (!id) return;
  state.filterPresets = state.filterPresets.filter((preset) => preset.id !== id);
  await chrome.storage.local.set({ filterPresets: state.filterPresets });
  renderPresets();
  showToast(t('presetDeleted'));
}

async function saveSelectionPreset() {
  const urls = selectedImages().map((image) => image.url);
  if (!urls.length) { showToast(t('selectBeforeSave')); return; }
  const name = window.prompt(t('selectionPresetPrompt'));
  if (!name?.trim()) return;
  state.selectionPresets.push({ id: `selection-${Date.now()}`, name: name.trim().slice(0, 40), urls });
  await chrome.storage.local.set({ selectionPresets: state.selectionPresets });
  renderPresets(); showToast(t('presetSaved'));
}

function applySelectionPreset() {
  const preset = state.selectionPresets.find((item) => item.id === els.selectionPreset.value);
  if (!preset) return;
  const urls = new Set(preset.urls || []);
  state.selected.clear(); state.images.forEach((image) => { if (urls.has(image.url)) state.selected.add(image.id); });
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
  updateSliderUI(axis);
  scheduleApplyFilters();
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
  els[`${axis}Value`].textContent = min === 0 && upper === max ? t('unlimited') : `${displayLimit(axis, min, 'min')} – ${displayLimit(axis, upper, 'max')}`;
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
  return value === 0 && side === 'min' ? t('unlimited') : value === max && side === 'max' ? t('unlimited') : `${value}px`;
}

function capitalize(value) { return value[0].toUpperCase() + value.slice(1); }

function render() {
  els.grid.replaceChildren();
  els.resultCount.textContent = t('imageCount', { count: state.filtered.length });
  els.empty.hidden = state.filtered.length !== 0 || !els.loading.hidden;
  els.selectAll.checked = state.filtered.length > 0 && state.filtered.every((image) => state.selected.has(image.id));
  const fragment = document.createDocumentFragment();
  for (const image of state.filtered) fragment.append(createCard(image));
  els.grid.append(fragment);
  const selected = selectedImages();
  els.selectedCount.textContent = selected.length;
  els.selectedSummary.textContent = t('selectedCount', { count: selected.length });
  els.download.disabled = selected.length === 0;
  els.zip.disabled = selected.length === 0;
}

function scheduleApplyFilters() {
  if (filterRenderFrame !== null) return;
  const schedule = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : ((callback) => window.setTimeout(callback, 0));
  filterRenderFrame = schedule(() => {
    filterRenderFrame = null;
    applyFilters();
  });
}

function createCard(image) {
  const card = document.createElement('article');
  card.className = `image-card${state.selected.has(image.id) ? ' selected' : ''}`;
  card.dataset.imageId = image.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${image.width && image.height ? `${image.width} × ${image.height}` : t('unknownSize')} , ${fileName(image.url)}`);
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox'; checkbox.className = 'card-check'; checkbox.checked = state.selected.has(image.id);
  checkbox.setAttribute('aria-label', t('selectImage', { dimensions: image.width && image.height ? `${image.width}×${image.height}` : t('unknownSize') }));
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
  const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = `card-favorite${savedRecord?.favorite ? ' active' : ''}`; favorite.textContent = savedRecord?.favorite ? '★' : '☆'; favorite.title = savedRecord?.favorite ? t('removeFavorite') : t('favoriteImage'); favorite.setAttribute('aria-label', favorite.title); favorite.setAttribute('aria-pressed', savedRecord?.favorite ? 'true' : 'false');
  favorite.addEventListener('click', (event) => { event.stopPropagation(); toggleFavorite(image); });
  const wrap = document.createElement('div'); wrap.className = 'thumbnail-wrap';
  const thumbnail = document.createElement('img'); thumbnail.className = 'thumbnail'; thumbnail.src = image.url; thumbnail.alt = image.alt || t('webImage'); thumbnail.loading = 'lazy';
  thumbnail.addEventListener('error', () => { wrap.textContent = t('previewUnavailable'); wrap.style.color = '#9ba4ac'; wrap.style.fontSize = '10px'; });
  thumbnail.addEventListener('click', (event) => { event.stopPropagation(); openPreview(image); });
  wrap.append(thumbnail);
  const meta = document.createElement('div'); meta.className = 'card-meta';
  const size = document.createElement('span'); size.className = 'card-size'; size.textContent = image.width && image.height ? `${image.width} × ${image.height}` : t('unknownSize');
  const sizeRow = document.createElement('div'); sizeRow.className = 'card-size-row';
  const format = document.createElement('span'); format.className = 'format-badge'; format.textContent = image.original ? `${formatLabel(image.format)} · ${t('original')}` : formatLabel(image.format);
  const info = document.createElement('span'); info.className = 'card-info'; info.textContent = image.size ? formatBytes(image.size) : image.mime ? image.mime.replace(/^image\//, '') : '';
  info.title = image.mime ? image.mime : '';
  const name = document.createElement('span'); name.className = 'card-name'; name.textContent = fileName(image.url); name.title = image.url;
  sizeRow.append(size, format);
  meta.append(sizeRow, info, name);
  const single = document.createElement('button'); single.type = 'button'; single.className = 'single-download'; single.title = t('downloadImage'); single.setAttribute('aria-label', t('downloadImage')); single.textContent = '↓';
  single.addEventListener('click', (event) => { event.stopPropagation(); downloadImages([image], false); });
  card.append(checkbox, favorite, wrap, meta, single);
  return card;
}

function selectedImages() { return state.images.filter((image) => state.selected.has(image.id)); }
function selectedLibraryImages() { return [...state.librarySelected].map((url) => state.libraryRecords.get(url)).filter(Boolean); }
function downloadSelected(asZip) { downloadImages(selectedImages(), asZip); }
function formatLabel(format) { return format === 'other' ? t('other') : (format || 'other').toUpperCase(); }

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
  updateDownloadProgress({ phase: 'starting', completed: 0, total: images.length, failed: 0, percent: 0, detail: asZip ? t('prepareZip') : t('prepareImages') });
  try {
    const response = await chrome.runtime.sendMessage({
      type: asZip ? 'downloadZip' : 'downloadImages', images, saveAs: state.saveAs,
      zipLayout: state.zipLayout, filenameTemplate: state.filenameTemplate, dateFolder: state.dateFolder, language: state.language, jobId
    });
    const failed = Array.isArray(response?.failed) ? response.failed : [];
    const byUrl = new Map(images.map((image) => [image.url, image]));
    state.retryImages = failed.map((item) => byUrl.get(item.url)).filter(Boolean);
    state.retryAsZip = asZip;
    updateRetryUI();
    if (response?.cancelled) {
      updateDownloadProgress({ phase: 'cancelled', completed: images.length, total: images.length, failed: state.retryImages.length, percent: 100, detail: t('taskCancelled') });
      showToast(t('downloadCancelled'));
      return;
    }
    if (!response?.ok) throw new Error(response?.error || t('downloadFailed'));
    if (failed.length) {
      const reason = failed[0]?.error ? `: ${failed[0].error}` : '';
      updateDownloadProgress({ phase: 'complete', completed: images.length, total: images.length, failed: failed.length, percent: 100, detail: t('processedWithFailures', { count: images.length, failed: failed.length }) + reason });
      showToast(t('downloadStartedWithFailures', { count: failed.length }));
    }
    else showToast(asZip ? t('zipStarted') : t('downloadStarted'));
  } catch (error) {
    if (!state.retryImages.length) state.retryImages = [...images];
    updateRetryUI();
    updateDownloadProgress({ phase: 'failed', completed: images.length, total: images.length, failed: state.retryImages.length, percent: 100, detail: error.message || t('downloadFailed') });
    showToast(error.message || t('downloadFailedRetry'));
  } finally {
    render();
  }
}

function updateDownloadProgress(progress) {
  els.downloadProgress.hidden = false;
  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  els.progressBar.style.width = `${percent}%`;
  els.progressValue.textContent = `${percent}%`;
  els.progressLabel.textContent = progress.phase === 'compressing' ? t('compressing') : progress.phase === 'failed' ? t('taskFailed') : progress.phase === 'cancelled' ? t('taskCancelled') : progress.phase === 'complete' ? t('taskComplete') : t('downloadProgress');
  els.progressDetail.textContent = progress.detail || t('processedProgress', { completed: progress.completed || 0, total: progress.total || 0 });
  els.cancelButton.hidden = ['complete', 'failed', 'cancelled'].includes(progress.phase);
}

function updateRetryUI() {
  const count = state.retryImages.length;
  els.retryCount.textContent = count;
  els.retryButton.hidden = count === 0;
}

function exportImages(type) {
  if (!state.filtered.length) {
    showToast(t('noImagesToExport'));
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
  }).then(() => showToast(t('exportStarted', { type: isJson ? 'JSON' : 'CSV' }))).catch((error) => showToast(error.message || t('exportFailed')));
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

const TRANSLATIONS = {
  zh: {
    page: '当前页面', library: '素材库', history: '历史', tasks: '任务', filterPreset: '筛选预设', selectionPreset: '选择预设', clear: '清除', width: '宽度', height: '高度', format: '格式', formatHint: '按文件类型查看', originalOnly: '仅显示原图候选', originalHint: '优先使用页面提供的高清地址', selectAll: '全选当前结果', sort: '排序', pageOrder: '页面顺序', widthDesc: '宽度：从大到小', heightDesc: '高度：从大到小', areaDesc: '尺寸：从大到小', nameAsc: '文件名：A–Z', searchPage: '搜索文件名、域名或 URL', noResults: '没有符合条件的图片', noResultsHint: '尝试放宽尺寸筛选，或重新扫描当前页面。', scanning: '正在扫描当前页面…', saveLocation: '下载时选择保存位置', downloadSupport: '支持普通文件与 ZIP', zipLayout: 'ZIP 分组', noGrouping: '不分组', bySite: '按网站', byFormat: '按格式', bySiteFormat: '按网站 / 格式', filenameTemplate: '文件名模板', dateFolder: '按日期建目录', json: '导出 JSON', csv: '导出 CSV', downloadSelected: '下载选中', zip: '下载 ZIP', zipNote: 'ZIP 会将当前选中的图片合并为一个文件，适合批量保存。',
    saveFilter: '保存筛选', deletePreset: '删除预设', saveSelection: '保存选择', invert: '反选', allCollections: '全部集合', uncategorized: '未分类',
    newCollection: '新建集合', exportLibrary: '导出收藏数据', importLibrary: '导入数据', taskCount: '个任务', activeTasks: '进行中', imageDownload: '图片下载', libraryTitle: '本地素材库', refresh: '刷新', allImages: '全部图片', librarySearch: '搜索图片、域名或标签', libraryMinWidth: '最小宽度', libraryMinHeight: '最小高度', libraryEmpty: '素材库还是空的', libraryEmptyHint: '在当前页面收藏图片，或从右键菜单收藏网页图片。', historyTitle: '最近活动', clearHistory: '清空历史', recentScans: '最近扫描', downloads: '下载记录', historyEmpty: '暂时没有历史记录', historyEmptyHint: '扫描网页或下载图片后，记录会显示在这里。', settings: '设置', settingsNote: '清空素材库会删除图片、收藏、标签和集合，但不会影响当前网页。', selected: '已选', images: '张图片', favorites: '收藏', collections: '个集合', storageUnavailable: '本地存储暂时不可用',
    exportFilteredJson: '导出筛选 JSON', exportFilteredCsv: '导出筛选 CSV', libraryDownloadSelected: '下载选中', libraryZipSelected: '下载 ZIP', libraryMaxWidth: '最大宽度', libraryMaxHeight: '最大高度', libraryMinSize: '最小 KB', libraryMaxSize: '最大 KB', libraryResultsEmpty: '当前筛选结果为空', libraryResultsExported: '筛选结果已导出', items: '项',
    pause: '暂停', resume: '继续', cancel: '取消', retry: '重试', queued: '排队中', running: '进行中', paused: '已暂停', completed: '已完成', partial: '部分失败', failed: '失败', cancelled: '已取消',
    preview: '图片预览', copyUrl: '复制原图地址', openUrl: '在新标签页打开', reset: '重置', original: '原图', unknownSize: '尺寸未知', imagePreview: '图片预览',
    copied: '原图地址已复制', copyFailed: '复制失败，请检查浏览器权限', collectionUpdated: '集合已更新', collectionUpdateFailed: '集合更新失败', collectionCreated: '集合已创建', collectionCreateFailed: '集合创建失败',
    libraryExported: '素材库数据已导出', libraryExportFailed: '素材库导出失败', libraryImported: '素材库数据已导入', libraryImportFailed: '导入失败，请选择有效的 JSON 文件', taskActionFailed: '任务操作失败', noFailedTasks: '没有可重试的失败任务',
    filterPresetPrompt: '请输入筛选预设名称', selectionPresetPrompt: '请输入选择预设名称', newCollectionPrompt: '请输入集合名称', presetSaved: '预设已保存', presetDeleted: '预设已删除', selectBeforeSave: '请先选择图片', selectBeforeAction: '请先选择素材', bulkFavoriteDone: '已批量收藏', bulkTagPrompt: '请输入要添加的标签', bulkTagDone: '标签已批量添加', bulkCollectionPrompt: '请输入集合序号', createCollectionFirst: '请先创建集合', bulkCollectionDone: '已批量归档', bulkDeleteConfirm: '确定删除选中的素材吗？', bulkDeleteDone: '素材已删除', bulkActionFailed: '批量操作失败', clearLibraryConfirm: '确定清空整个素材库吗？此操作不可撤销。', libraryCleared: '素材库已清空', clearLibraryFailed: '素材库清理失败', resetSettingsConfirm: '确定重置所有扩展设置吗？', settingsReset: '设置已重置',
    sizeFilterTitle: '按尺寸筛选', unlimited: '不限', imageCount: '{count} 张图片', itemCount: '{count} 项', selectedCount: '已选 {count}', duplicates: '去重 {count}', all: '全部', other: '其它', switchLanguage: '切换语言', rescan: '重新扫描', viewSwitcher: '视图切换', filterSection: '图片筛选', searchImages: '搜索图片', sortImages: '图片排序方式', saveHelp: 'ZIP 下载或单张下载时会打开 Chrome 的保存对话框', libraryScope: '素材库筛选范围', collectionFilter: '按集合筛选', waitingTask: '等待任务开始', scanLimit: '扫描上限', maxImages: '最大扫描图片数量', imageOptions: ['200 张', '500 张', '1000 张', '不限'], autoScroll: '自动滚动加载懒加载图片',
    widthMin: '最小宽度', widthMax: '最大宽度', heightMin: '最小高度', heightMax: '最大高度', formatFilter: '按图片格式筛选', saveLocationHint: 'ZIP 下载或单张下载时会打开 Chrome 的保存对话框', filenameTemplateHint: '支持 {name}、{filename}、{domain}、{format}、{width}、{height}、{date}',
    currentPage: '当前页面', readingPage: '正在读取当前页面', scanningStatus: '扫描中', updating: '更新中', scanFailed: '扫描失败', scanFailedPrefix: '扫描失败：', pageAccessError: '当前页面不允许扩展访问，请切换到普通网页后重试。', noActiveTab: '无法获取当前标签页。', unnamedPage: '未命名页面', unknownTime: '时间未知', webImage: '网页图片', previewUnavailable: '预览不可用', selectImage: '选择 {dimensions} 图片', selectNamedImage: '选择 {name}', favorite: '收藏', favoriteImage: '收藏图片', removeFavorite: '取消收藏', downloadImage: '下载图片', removeTag: '移除标签 {tag}', chooseCollection: '选择集合', addTag: '添加标签', favoriteAdded: '已加入收藏', favoriteRemoved: '已取消收藏', favoriteFailed: '收藏操作失败', tagUpdated: '标签已更新', tagSaveFailed: '标签保存失败',
    downloadZip: '下载 ZIP', submitted: '已提交', partialFailed: '部分失败 {count}', clearHistoryConfirm: '确定清空所有扫描和下载历史吗？', historyCleared: '历史记录已清空', historyClearFailed: '历史记录清理失败', taskCancelled: '任务已取消', cancelling: '正在取消任务…', downloadCancelled: '下载任务已取消', downloadFailed: '下载失败', downloadFailedRetry: '下载失败，请重试', prepareZip: '准备生成 ZIP…', prepareImages: '准备下载图片…', processedWithFailures: '已处理 {count} 张，失败 {failed}', downloadStartedWithFailures: '已开始下载，{count} 张图片失败，可点击重试', zipStarted: 'ZIP 已开始下载', downloadStarted: '下载已开始', compressing: '正在压缩', taskFailed: '任务失败', taskComplete: '任务完成', downloadProgress: '下载进度', processedProgress: '已处理 {completed}/{total}', noImagesToExport: '当前没有可导出的图片', exportStarted: '{type} 清单已开始下载', exportFailed: '清单导出失败', taskCenter: '下载任务中心', retryFailed: '重试失败任务', retryFailedItems: '重试失败项', taskEmpty: '暂时没有下载任务', taskEmptyHint: '发起图片或 ZIP 下载后，任务会显示在这里。', settingsTitle: '设置与存储', clearLibrary: '清空素材库', resetSettings: '重置设置', myFavorites: '我的收藏', bulkFavorite: '批量收藏', bulkTag: '添加标签', bulkCollection: '归档到集合', bulkDelete: '删除', closePreview: '关闭预览'
  },
  en: {
    page: 'Current', library: 'Library', history: 'History', tasks: 'Tasks', filterPreset: 'Filter preset', selectionPreset: 'Selection preset', clear: 'Clear', width: 'Width', height: 'Height', format: 'Format', formatHint: 'Filter by file type', originalOnly: 'Original candidates only', originalHint: 'Prefer high-resolution addresses from the page', selectAll: 'Select all results', sort: 'Sort', pageOrder: 'Page order', widthDesc: 'Width: largest first', heightDesc: 'Height: largest first', areaDesc: 'Area: largest first', nameAsc: 'Filename: A–Z', searchPage: 'Search filename, hostname or URL', noResults: 'No matching images', noResultsHint: 'Try widening the size range or scan the page again.', scanning: 'Scanning current page…', saveLocation: 'Ask where to save downloads', downloadSupport: 'Files and ZIP supported', zipLayout: 'ZIP folders', noGrouping: 'No folders', bySite: 'By site', byFormat: 'By format', bySiteFormat: 'By site / format', filenameTemplate: 'Filename template', dateFolder: 'Create date folder', json: 'Export JSON', csv: 'Export CSV', downloadSelected: 'Download selected', zip: 'Download ZIP', zipNote: 'Selected images will be combined into one ZIP archive.',
    saveFilter: 'Save filter', deletePreset: 'Delete preset', saveSelection: 'Save selection', invert: 'Invert', allCollections: 'All collections', uncategorized: 'Uncategorized',
    newCollection: 'New collection', exportLibrary: 'Export library', importLibrary: 'Import data', taskCount: 'tasks', activeTasks: 'active', imageDownload: 'Image download', libraryTitle: 'Local library', refresh: 'Refresh', allImages: 'All images', librarySearch: 'Search images, sites or tags', libraryMinWidth: 'Min width', libraryMinHeight: 'Min height', libraryEmpty: 'Your library is empty', libraryEmptyHint: 'Favorite an image on this page or use the context menu to save one.', historyTitle: 'Recent activity', clearHistory: 'Clear history', recentScans: 'Recent scans', downloads: 'Downloads', historyEmpty: 'No activity yet', historyEmptyHint: 'Scan a page or download an image to see activity here.', settings: 'Settings', settingsNote: 'Clearing the library removes images, favorites, tags, and collections, but does not affect the current webpage.', selected: 'Selected', images: 'images', favorites: 'favorites', collections: 'collections', storageUnavailable: 'Local storage is unavailable',
    exportFilteredJson: 'Export filtered JSON', exportFilteredCsv: 'Export filtered CSV', libraryDownloadSelected: 'Download selected', libraryZipSelected: 'Download ZIP', libraryMaxWidth: 'Max width', libraryMaxHeight: 'Max height', libraryMinSize: 'Min KB', libraryMaxSize: 'Max KB', libraryResultsEmpty: 'No filtered images', libraryResultsExported: 'Filtered results exported', items: 'items',
    pause: 'Pause', resume: 'Resume', cancel: 'Cancel', retry: 'Retry', queued: 'Queued', running: 'Running', paused: 'Paused', completed: 'Completed', partial: 'Partial', failed: 'Failed', cancelled: 'Cancelled',
    preview: 'Image preview', copyUrl: 'Copy original URL', openUrl: 'Open in new tab', reset: 'Reset', original: 'Original', unknownSize: 'Unknown size', imagePreview: 'Image preview',
    copied: 'Original URL copied', copyFailed: 'Copy failed; check browser permission', collectionUpdated: 'Collection updated', collectionUpdateFailed: 'Collection update failed', collectionCreated: 'Collection created', collectionCreateFailed: 'Collection creation failed',
    libraryExported: 'Library data exported', libraryExportFailed: 'Library export failed', libraryImported: 'Library data imported', libraryImportFailed: 'Import failed; choose a valid JSON file', taskActionFailed: 'Task action failed', noFailedTasks: 'No failed tasks to retry',
    filterPresetPrompt: 'Filter preset name', selectionPresetPrompt: 'Selection preset name', newCollectionPrompt: 'Collection name', presetSaved: 'Preset saved', presetDeleted: 'Preset deleted', selectBeforeSave: 'Select images first', selectBeforeAction: 'Select images first', bulkFavoriteDone: 'Images favorited', bulkTagPrompt: 'Tag to add', bulkTagDone: 'Tags added', bulkCollectionPrompt: 'Collection number', createCollectionFirst: 'Create a collection first', bulkCollectionDone: 'Images archived', bulkDeleteConfirm: 'Delete the selected images? This cannot be undone.', bulkDeleteDone: 'Images deleted', bulkActionFailed: 'Bulk action failed', clearLibraryConfirm: 'Clear the entire library? This cannot be undone.', libraryCleared: 'Library cleared', clearLibraryFailed: 'Could not clear library', resetSettingsConfirm: 'Reset all extension settings?', settingsReset: 'Settings reset',
    sizeFilterTitle: 'Filter by size', unlimited: 'Any', imageCount: '{count} image(s)', itemCount: '{count} item(s)', selectedCount: 'Selected {count}', duplicates: '{count} duplicates removed', all: 'All', other: 'Other', switchLanguage: 'Switch language', rescan: 'Rescan', viewSwitcher: 'View switcher', filterSection: 'Image filters', searchImages: 'Search images', sortImages: 'Image sort', saveHelp: 'Chrome opens a save dialog for ZIP or single-image downloads', libraryScope: 'Library scope', collectionFilter: 'Filter by collection', waitingTask: 'Waiting for task', scanLimit: 'Scan limit', maxImages: 'Maximum image count', imageOptions: ['200 images', '500 images', '1000 images', 'Unlimited'], autoScroll: 'Auto-scroll for lazy images',
    widthMin: 'Minimum width', widthMax: 'Maximum width', heightMin: 'Minimum height', heightMax: 'Maximum height', formatFilter: 'Filter by image format', saveLocationHint: 'Chrome opens a save dialog for ZIP or single-image downloads', filenameTemplateHint: 'Supports {name}, {filename}, {domain}, {format}, {width}, {height}, and {date}',
    currentPage: 'Current page', readingPage: 'Reading current page', scanningStatus: 'Scanning', updating: 'Updating', scanFailed: 'Scan failed', scanFailedPrefix: 'Scan failed: ', pageAccessError: 'The extension cannot access this page. Switch to a regular webpage and try again.', noActiveTab: 'Could not get the active tab.', unnamedPage: 'Untitled page', unknownTime: 'Unknown time', webImage: 'Web image', previewUnavailable: 'Preview unavailable', selectImage: 'Select {dimensions} image', selectNamedImage: 'Select {name}', favorite: 'Favorite', favoriteImage: 'Favorite image', removeFavorite: 'Remove favorite', downloadImage: 'Download image', removeTag: 'Remove tag {tag}', chooseCollection: 'Choose collection', addTag: 'Add tag', favoriteAdded: 'Added to favorites', favoriteRemoved: 'Removed from favorites', favoriteFailed: 'Favorite action failed', tagUpdated: 'Tag updated', tagSaveFailed: 'Could not save tag',
    downloadZip: 'Download ZIP', submitted: 'Submitted', partialFailed: 'Partial failure: {count}', clearHistoryConfirm: 'Clear all scan and download history?', historyCleared: 'History cleared', historyClearFailed: 'Could not clear history', taskCancelled: 'Task cancelled', cancelling: 'Cancelling…', downloadCancelled: 'Download task cancelled', downloadFailed: 'Download failed', downloadFailedRetry: 'Download failed; try again', prepareZip: 'Preparing ZIP…', prepareImages: 'Preparing image download…', processedWithFailures: 'Processed {count}; {failed} failed', downloadStartedWithFailures: 'Download started; {count} image(s) failed. You can retry them.', zipStarted: 'ZIP download started', downloadStarted: 'Download started', compressing: 'Compressing', taskFailed: 'Task failed', taskComplete: 'Task complete', downloadProgress: 'Download progress', processedProgress: 'Processed {completed}/{total}', noImagesToExport: 'There are no images to export', exportStarted: '{type} list download started', exportFailed: 'List export failed', taskCenter: 'Download task center', retryFailed: 'Retry failed tasks', retryFailedItems: 'Retry failed items', taskEmpty: 'No download tasks yet', taskEmptyHint: 'Start an image or ZIP download to see it here.', settingsTitle: 'Settings & storage', clearLibrary: 'Clear library', resetSettings: 'Reset settings', myFavorites: 'Favorites', bulkFavorite: 'Favorite', bulkTag: 'Add tag', bulkCollection: 'Archive', bulkDelete: 'Delete', closePreview: 'Close preview'
  }
};

function t(key, values = {}) {
  const raw = TRANSLATIONS[state.language]?.[key] ?? TRANSLATIONS.zh[key] ?? key;
  const text = Array.isArray(raw) ? raw : String(raw);
  if (Array.isArray(text)) return text;
  return text.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? ''));
}

function detectLanguage() {
  return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function applyLanguage() {
  document.documentElement.lang = state.language === 'en' ? 'en' : 'zh-CN';
  els.language.textContent = state.language === 'en' ? '中' : 'EN';
  els.language.title = t('switchLanguage');
  els.refresh.title = t('rescan');
  els.refresh.setAttribute('aria-label', t('rescan'));
  document.querySelector('.page-summary')?.setAttribute('aria-label', t('currentPage'));
  document.querySelector('.view-switcher')?.setAttribute('aria-label', t('viewSwitcher'));
  document.querySelector('.filter-panel')?.setAttribute('aria-label', t('filterSection'));
  document.querySelector('#libraryView')?.setAttribute('aria-label', t('libraryTitle'));
  document.querySelector('#historyView')?.setAttribute('aria-label', t('historyTitle'));
  document.querySelector('#taskView')?.setAttribute('aria-label', t('taskCenter'));
  document.querySelector('#settingsView')?.setAttribute('aria-label', t('settingsTitle'));
  document.querySelector('.search-box')?.setAttribute('aria-label', t('searchImages'));
  els.sortSelect.setAttribute('aria-label', t('sortImages'));
  els.minWidth.setAttribute('aria-label', t('widthMin')); els.maxWidth.setAttribute('aria-label', t('widthMax'));
  els.minHeight.setAttribute('aria-label', t('heightMin')); els.maxHeight.setAttribute('aria-label', t('heightMax'));
  els.formatTabs.forEach((tab) => tab.closest('.format-tabs')?.setAttribute('aria-label', t('formatFilter')));
  els.scanLimit.setAttribute('aria-label', t('maxImages'));
  document.querySelector('.save-option .help')?.setAttribute('title', t('saveHelp'));
  els.filenameTemplate.title = t('filenameTemplateHint');
  els.libraryScope.setAttribute('aria-label', t('libraryScope'));
  els.libraryCollection.setAttribute('aria-label', t('collectionFilter'));
  els.librarySearch.setAttribute('aria-label', t('librarySearch'));
  els.closePreview.setAttribute('aria-label', t('closePreview'));
  els.previewImage.alt = t('imagePreview');
  if (!state.tabId) els.pageTitle.textContent = t('readingPage');
  if (state.images.length && els.loading.hidden) updateScanStatus();
  else if (!state.images.length && els.loading.hidden) els.scanStatus.textContent = t('scanningStatus');
  els.pageViewButton.textContent = t('page');
  const favoriteCount = els.favoriteCount.textContent;
  els.libraryViewButton.innerHTML = `${t('library')} <span id="favoriteCount">${favoriteCount}</span>`;
  els.favoriteCount = $('#favoriteCount');
  els.historyViewButton.textContent = t('history'); els.taskViewButton.textContent = t('tasks'); els.settingsViewButton.textContent = t('settings');
  els.filterPreset.options[0].textContent = t('filterPreset'); els.selectionPreset.options[0].textContent = t('selectionPreset');
  els.saveFilterPreset.textContent = t('saveFilter'); els.deleteFilterPreset.textContent = t('deletePreset'); els.saveSelectionPreset.textContent = t('saveSelection'); els.invertSelection.textContent = t('invert');
  els.newCollection.textContent = t('newCollection'); els.exportLibrary.textContent = t('exportLibrary'); els.exportLibraryResultsJson.textContent = t('exportFilteredJson'); els.exportLibraryResultsCsv.textContent = t('exportFilteredCsv'); els.importLibrary.textContent = t('importLibrary');
  els.previewTitle.textContent = state.preview ? fileName(state.preview.url) : t('preview'); els.copyImageUrl.textContent = t('copyUrl'); els.openImageUrl.textContent = t('openUrl'); els.zoomReset.textContent = t('reset');
  document.querySelector('.filter-panel h2').textContent = t('sizeFilterTitle');
  els.clearFilters.textContent = t('clear');
  const dimensionLabels = [...document.querySelectorAll('.dimension-slider .slider-label > span')];
  if (dimensionLabels[0]) dimensionLabels[0].textContent = t('width');
  if (dimensionLabels[1]) dimensionLabels[1].textContent = t('height');
  const formatLabelNode = document.querySelector('.format-filter .slider-label > span'); if (formatLabelNode) formatLabelNode.textContent = t('format');
  const formatHint = document.querySelector('.format-hint'); if (formatHint) formatHint.textContent = t('formatHint');
  const originalLabel = document.querySelector('.original-filter span'); if (originalLabel) originalLabel.textContent = t('originalOnly');
  const originalHint = document.querySelector('.original-filter small'); if (originalHint) originalHint.textContent = t('originalHint');
  const selectAllLabel = document.querySelector('.select-all span'); if (selectAllLabel) selectAllLabel.textContent = t('selectAll');
  const search = document.querySelector('#searchInput'); search.placeholder = t('searchPage');
  const sortLabel = document.querySelector('.sort-control > span'); if (sortLabel) sortLabel.textContent = t('sort');
  const sortOptions = [t('pageOrder'), t('widthDesc'), t('heightDesc'), t('areaDesc'), t('nameAsc')]; [...els.sortSelect.options].forEach((option, index) => { if (sortOptions[index]) option.textContent = sortOptions[index]; });
  [...els.formatTabs].forEach((tab) => { const format = tab.dataset.format; const labels = { all: t('all'), jpeg: 'JPEG', png: 'PNG', webp: 'WEBP', avif: 'AVIF', other: t('other') }; const count = tab.querySelector('[data-count]')?.textContent || '0'; tab.innerHTML = `${labels[format] || format} <strong data-count>${count}</strong>`; });
  els.loading.lastChild.textContent = ` ${t('scanning')}`;
  const saveText = document.querySelector('.save-option > span'); if (saveText) saveText.textContent = t('saveLocation');
  const downloadCaption = document.querySelector('.download-caption-note'); if (downloadCaption) downloadCaption.textContent = t('downloadSupport');
  const settingLabels = [...document.querySelectorAll('.download-settings > label > span')]; if (settingLabels[0]) settingLabels[0].textContent = t('zipLayout'); if (settingLabels[1]) settingLabels[1].textContent = t('filenameTemplate');
  const zipOptions = [t('noGrouping'), t('bySite'), t('byFormat'), t('bySiteFormat')]; [...els.zipLayout.options].forEach((option, index) => { if (zipOptions[index]) option.textContent = zipOptions[index]; });
  const dateText = document.querySelector('.date-folder-setting span'); if (dateText) dateText.textContent = t('dateFolder');
  els.exportJson.textContent = t('json'); els.exportCsv.textContent = t('csv');
  els.download.innerHTML = `${t('downloadSelected')} <span id="selectedCount">${els.selectedCount.textContent}</span>`;
  els.selectedCount = $('#selectedCount');
  els.zip.innerHTML = `<span class="zip-icon">▣</span> ${t('zip')}`;
  const note = document.querySelector('.download-note'); if (note) note.textContent = t('zipNote');
  els.progressLabel.textContent = t('downloadProgress');
  if (!els.downloadProgress.hidden && !els.progressDetail.textContent) els.progressDetail.textContent = t('waitingTask');
  const libraryTitle = document.querySelector('#libraryView h2'); if (libraryTitle) libraryTitle.textContent = t('libraryTitle');
  if (els.refreshLibrary) els.refreshLibrary.textContent = t('refresh');
  if (els.librarySearch) els.librarySearch.placeholder = t('librarySearch');
  if (els.libraryMinWidth) els.libraryMinWidth.placeholder = t('libraryMinWidth');
  if (els.libraryMaxWidth) els.libraryMaxWidth.placeholder = t('libraryMaxWidth');
  if (els.libraryMinHeight) els.libraryMinHeight.placeholder = t('libraryMinHeight');
  if (els.libraryMaxHeight) els.libraryMaxHeight.placeholder = t('libraryMaxHeight');
  if (els.libraryMinSize) els.libraryMinSize.placeholder = t('libraryMinSize');
  if (els.libraryMaxSize) els.libraryMaxSize.placeholder = t('libraryMaxSize');
  const libraryEmptyTitle = document.querySelector('#libraryEmpty strong'); if (libraryEmptyTitle) libraryEmptyTitle.textContent = t('libraryEmpty');
  const libraryEmptyHint = document.querySelector('#libraryEmpty span'); if (libraryEmptyHint) libraryEmptyHint.textContent = t('libraryEmptyHint');
  const emptyTitle = document.querySelector('#emptyState strong'); if (emptyTitle) emptyTitle.textContent = t('noResults');
  const emptyHint = document.querySelector('#emptyState span'); if (emptyHint) emptyHint.textContent = t('noResultsHint');
  const allImagesOption = [...els.libraryScope.options].find((option) => option.value === 'all'); if (allImagesOption) allImagesOption.textContent = t('allImages');
  const favoritesOption = [...els.libraryScope.options].find((option) => option.value === 'favorites'); if (favoritesOption) favoritesOption.textContent = t('myFavorites');
  const historyTitle = document.querySelector('#historyView h2'); if (historyTitle) historyTitle.textContent = t('historyTitle');
  els.clearHistory.textContent = t('clearHistory');
  const blocks = [...document.querySelectorAll('#historyView .history-block-heading strong')]; if (blocks[0]) blocks[0].textContent = t('recentScans'); if (blocks[1]) blocks[1].textContent = t('downloads');
  const historyEmptyTitle = document.querySelector('#historyEmpty strong'); if (historyEmptyTitle) historyEmptyTitle.textContent = t('historyEmpty');
  const historyEmptyHint = document.querySelector('#historyEmpty span'); if (historyEmptyHint) historyEmptyHint.textContent = t('historyEmptyHint');
  const taskTitle = document.querySelector('#taskView h2'); if (taskTitle) taskTitle.textContent = t('taskCenter');
  if (els.refreshTasks) els.refreshTasks.textContent = t('refresh');
  if (els.retryAllTasks) els.retryAllTasks.textContent = t('retryFailed');
  const settingsTitle = document.querySelector('#settingsView h2'); if (settingsTitle) settingsTitle.textContent = t('settingsTitle');
  if (els.refreshStorage) els.refreshStorage.textContent = t('refresh');
  if (els.clearLibrary) els.clearLibrary.textContent = t('clearLibrary');
  if (els.resetSettings) els.resetSettings.textContent = t('resetSettings');
  const settingsNote = document.querySelector('.settings-note'); if (settingsNote) settingsNote.textContent = t('settingsNote');
  const scanLabel = document.querySelector('.scan-options label:first-child > span'); if (scanLabel) scanLabel.textContent = t('scanLimit');
  const scrollLabel = document.querySelector('.scan-options label:nth-child(2) > span'); if (scrollLabel) scrollLabel.textContent = t('autoScroll');
  const scanOptions = t('imageOptions'); [...els.scanLimit.options].forEach((option, index) => { option.textContent = scanOptions[index]; });
  const libraryFormatOptions = state.language === 'en' ? ['All formats', 'JPEG', 'PNG', 'WEBP', 'AVIF', 'Other'] : ['全部格式', 'JPEG', 'PNG', 'WEBP', 'AVIF', '其它']; [...els.libraryFormat.options].forEach((option, index) => { option.textContent = libraryFormatOptions[index]; });
  const librarySortOptions = state.language === 'en' ? ['Recently updated', 'Width', 'Height', 'File size'] : ['最近更新', '宽度', '高度', '文件大小']; [...els.librarySort.options].forEach((option, index) => { option.textContent = librarySortOptions[index]; });
  els.selectAllLibrary.nextElementSibling.textContent = t('selectAll'); els.bulkFavorite.textContent = t('bulkFavorite'); els.bulkTag.textContent = t('bulkTag'); els.bulkCollection.textContent = t('bulkCollection'); els.bulkDelete.textContent = t('bulkDelete'); els.libraryDownloadSelected.textContent = t('libraryDownloadSelected'); els.libraryZipSelected.textContent = t('libraryZipSelected');
  const taskEmptyTitle = document.querySelector('#taskEmpty strong'); if (taskEmptyTitle) taskEmptyTitle.textContent = t('taskEmpty');
  const taskEmptyHint = document.querySelector('#taskEmpty span'); if (taskEmptyHint) taskEmptyHint.textContent = t('taskEmptyHint');
  els.cancelButton.textContent = t('cancel');
  els.retryButton.innerHTML = `${t('retryFailedItems')} <span id="retryCount">${els.retryCount.textContent}</span>`;
  els.retryCount = $('#retryCount');
  const initialProgressDetail = els.progressDetail; if (initialProgressDetail && (!initialProgressDetail.textContent || initialProgressDetail.textContent === '等待任务开始')) initialProgressDetail.textContent = t('waitingTask');
  renderCollectionOptions();
}

function setLoading(loading) { els.loading.hidden = !loading; if (loading) { els.grid.replaceChildren(); els.empty.hidden = true; } }
function updateScanStatus() {
  els.scanStatus.textContent = `${t('imageCount', { count: state.images.length })}${state.duplicateCount ? ` · ${t('duplicates', { count: state.duplicateCount })}` : ''}`;
}
function fileName(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image'); } catch { return 'image'; } }
function getDomainLetter(url) { try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 1).toUpperCase() || '◎'; } catch { return '◎'; } }
function showToast(message) { clearTimeout(state.toastTimer); els.toast.textContent = message; els.toast.classList.add('show'); state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200); }
