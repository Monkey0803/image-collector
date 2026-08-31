const state = {
  images: [],
  dimensionFiltered: [],
  filtered: [],
  format: 'all',
  source: 'all',
  selected: new Set(),
  tabId: null,
  saveAs: true,
  scanId: 0,
  scanPhase: 'idle',
  searchQuery: '',
  sort: 'page',
  originalOnly: false,
  aspectRatio: 'all',
  zipLayout: 'flat',
  conflictAction: 'uniquify',
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
    height: { min: null, max: null },
    size: { min: null, max: null }
  },
  aspectRange: { min: 0.25, max: 5 },
  toastTimer: null,
  pageBatchBusy: false,
  libraryBatchBusy: false,
  downloadJobId: null,
  retryImages: [],
  retryAsZip: false,
  cancelled: false,
  language: 'zh',
  filterPresets: [],
  selectionPresets: [],
  libraryCollection: '',
  librarySmartCollection: '',
  collections: [],
  preview: null,
  previewList: [],
  previewIndex: -1,
  previewZoom: 1,
  previewObjectUrl: '',
  taskRecords: [],
  taskRecoveryPromise: null,
  taskRefreshTimer: null,
  scanStats: { discovered: 0, duplicates: 0, skipped: 0, dimensionsChecked: 0, dimensionsFailed: 0, partial: false },
  downloadMetrics: { startedAt: 0, total: 0 },
  librarySelected: new Set(), libraryFormat: 'all', libraryMinWidth: '', libraryMaxWidth: '', libraryMinHeight: '', libraryMaxHeight: '', libraryMinSize: '', libraryMaxSize: '', librarySort: 'updated', storageStats: null,
  libraryRefreshToken: 0,
  pageRenderLimit: 120,
  libraryRenderLimit: 120,
  scanRules: { includeSelectors: '', excludeSelectors: '', scanCssBackground: true, scanVideoPosters: true, includeIframes: true },
  siteAdapters: [],
  syncSettings: false
};

const SYNC_SETTING_KEYS = ['scanRules', 'siteAdapters', 'scanLimit', 'autoScroll', 'zipLayout', 'conflictAction', 'filenameTemplate', 'dateFolder'];

function normalizeTextList(value) {
  return [...new Set(String(value || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean))].slice(0, 40);
}

function normalizeScanRules(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    includeSelectors: normalizeTextList(source.includeSelectors).join('\n'),
    excludeSelectors: normalizeTextList(source.excludeSelectors).join('\n'),
    scanCssBackground: source.scanCssBackground !== false,
    scanVideoPosters: source.scanVideoPosters !== false,
    includeIframes: source.includeIframes !== false
  };
}

function normalizeSiteAdapters(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    id: String(item?.id || ('adapter-' + Date.now() + '-' + Math.random().toString(36).slice(2))),
    hostPattern: String(item?.hostPattern || '').trim().toLowerCase().slice(0, 160),
    selector: String(item?.selector || '').trim().slice(0, 300),
    attributes: normalizeTextList(item?.attributes).slice(0, 20),
    collectionId: String(item?.collectionId || '').trim(),
    collectionName: String(item?.collectionName || '').trim().slice(0, 60)
  })).filter((item) => item.hostPattern && item.selector).slice(0, 30);
}

function syncConfigurationPayload() {
  return {
    scanRules: state.scanRules,
    siteAdapters: state.siteAdapters,
    scanLimit: state.scanLimit,
    autoScroll: state.autoScroll,
    zipLayout: state.zipLayout,
    conflictAction: state.conflictAction,
    filenameTemplate: state.filenameTemplate,
    dateFolder: state.dateFolder
  };
}

async function saveRuleConfiguration() {
  const payload = { ...syncConfigurationPayload(), syncSettings: state.syncSettings };
  await safeStorageSet(payload);
    if (state.syncSettings && chrome.storage.sync?.set) {
    try { await chrome.storage.sync.set(syncConfigurationPayload()); } catch { showToast(t('syncSaveFailed')); return false; }
  }
  return true;
}

let filterRenderFrame = null;
let libraryRefreshTimer = null;
let eventsBound = false;
let languageTouched = false;
let previewLoadToken = 0;
let interactionReady = false;
let batchDialogResolver = null;
let batchDialogAction = '';
let batchDialogReturnFocus = null;

function blockInteractionDuringInit(event) {
  if (interactionReady || !event.target.closest?.('button, input, select, textarea')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

document.addEventListener('click', blockInteractionDuringInit, true);
document.addEventListener('change', blockInteractionDuringInit, true);
document.addEventListener('input', blockInteractionDuringInit, true);
document.addEventListener('keydown', blockInteractionDuringInit, true);

function withTimeout(task, timeoutMs, timeoutMessage) {
  let timer;
  const operation = Promise.resolve().then(() => (typeof task === 'function' ? task() : task));
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

function safeStorageSet(values) {
  try {
    return Promise.resolve(chrome.storage.local.set(values)).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

const $ = (selector) => document.querySelector(selector);
const on = (element, eventName, handler, options) => element?.addEventListener(eventName, handler, options);
const setText = (element, value) => { if (element) element.textContent = value; };
const els = {
  refresh: $('#refreshButton'),
  scanStatus: $('#scanStatus'),
  pageTitle: $('#pageTitle'), pageUrl: $('#pageUrl'), pageIcon: $('#pageIcon'), scanStats: $('#scanStats'),
  minWidth: $('#minWidth'), maxWidth: $('#maxWidth'), minHeight: $('#minHeight'), maxHeight: $('#maxHeight'),
  widthValue: $('#widthValue'), heightValue: $('#heightValue'), widthTrack: $('#widthTrack'), heightTrack: $('#heightTrack'),
  widthEditor: $('#widthEditor'), heightEditor: $('#heightEditor'),
  widthMinValue: $('#widthMinValue'), widthMaxValue: $('#widthMaxValue'), heightMinValue: $('#heightMinValue'), heightMaxValue: $('#heightMaxValue'),
  sizeValue: $('#sizeValue'), sizeTrack: $('#sizeTrack'), minSize: $('#minSize'), maxSize: $('#maxSize'), sizeEditor: $('#sizeEditor'), sizeMinValue: $('#sizeMinValue'), sizeMaxValue: $('#sizeMaxValue'),
  aspectVisualTabs: [...document.querySelectorAll('.aspect-visual-tab')], minAspect: $('#minAspect'), maxAspect: $('#maxAspect'), aspectTrack: $('#aspectTrack'), aspectRangeValue: $('#aspectRangeValue'),
  clearFilters: $('#clearFilters'), selectAll: $('#selectAll'), resultCount: $('#resultCount'),
  selectedSummary: $('#selectedSummary'), searchInput: $('#searchInput'), sortSelect: $('#sortSelect'),
  originalOnly: $('#originalOnly'), aspectRatio: $('#aspectRatio'), zipLayout: $('#zipLayout'), conflictAction: $('#conflictAction'), filenameTemplate: $('#filenameTemplate'), dateFolder: $('#dateFolder'), sourceTabs: [...document.querySelectorAll('[data-source]')],
  pageView: $('#pageView'), pageViewButton: $('#pageViewButton'), libraryViewButton: $('#libraryViewButton'), historyViewButton: $('#historyViewButton'), taskViewButton: $('#taskViewButton'), settingsViewButton: $('#settingsViewButton'),
  libraryView: $('#libraryView'), favoriteCount: $('#favoriteCount'), refreshLibrary: $('#refreshLibrary'), libraryScope: $('#libraryScope'), librarySmartCollection: $('#librarySmartCollection'),
  librarySearch: $('#librarySearch'), libraryCollection: $('#libraryCollection'), librarySummary: $('#librarySummary'), libraryGrid: $('#libraryGrid'), libraryEmpty: $('#libraryEmpty'), newCollection: $('#newCollection'), exportLibrary: $('#exportLibrary'), exportLibraryResultsJson: $('#exportLibraryResultsJson'), exportLibraryResultsCsv: $('#exportLibraryResultsCsv'), importLibrary: $('#importLibrary'), importLibraryFile: $('#importLibraryFile'), libraryBatchToolbar: $('#libraryBatchToolbar'), selectAllLibrary: $('#selectAllLibrary'), librarySelectedSummary: $('#librarySelectedSummary'), invertLibrarySelection: $('#invertLibrarySelection'), clearLibrarySelection: $('#clearLibrarySelection'), bulkFavorite: $('#bulkFavorite'), bulkTag: $('#bulkTag'), bulkCollection: $('#bulkCollection'), bulkDelete: $('#bulkDelete'), libraryDownloadSelected: $('#libraryDownloadSelected'), libraryZipSelected: $('#libraryZipSelected'), libraryFormat: $('#libraryFormat'), libraryMinWidth: $('#libraryMinWidth'), libraryMaxWidth: $('#libraryMaxWidth'), libraryMinHeight: $('#libraryMinHeight'), libraryMaxHeight: $('#libraryMaxHeight'), libraryMinSize: $('#libraryMinSize'), libraryMaxSize: $('#libraryMaxSize'), librarySort: $('#librarySort'),
  libraryMinSizeRange: $('#libraryMinSizeRange'), libraryMaxSizeRange: $('#libraryMaxSizeRange'), librarySizeTrack: $('#librarySizeTrack'), librarySizeRangeValue: $('#librarySizeRangeValue'), libraryMinAspectRange: $('#libraryMinAspectRange'), libraryMaxAspectRange: $('#libraryMaxAspectRange'), libraryAspectTrack: $('#libraryAspectTrack'), libraryAspectRangeValue: $('#libraryAspectRangeValue'),
  historyView: $('#historyView'), clearHistory: $('#clearHistory'), refreshHistory: $('#refreshHistory'), scanHistory: $('#scanHistory'),
  downloadHistory: $('#downloadHistory'), historyEmpty: $('#historyEmpty'),
  taskView: $('#taskView'), refreshTasks: $('#refreshTasks'), retryAllTasks: $('#retryAllTasks'), exportFailureReport: $('#exportFailureReport'), taskSummary: $('#taskSummary'), taskList: $('#taskList'), taskEmpty: $('#taskEmpty'), settingsView: $('#settingsView'), settingsViewButton: $('#settingsViewButton'), refreshStorage: $('#refreshStorage'), storageStats: $('#storageStats'), clearLibrary: $('#clearLibrary'), resetSettings: $('#resetSettings'),
  exportJson: $('#exportJson'), exportCsv: $('#exportCsv'),
  includeSelectors: $('#includeSelectors'), excludeSelectors: $('#excludeSelectors'), scanCssBackground: $('#scanCssBackground'), scanVideoPosters: $('#scanVideoPosters'), includeIframes: $('#includeIframes'), saveScanRules: $('#saveScanRules'), adapterHost: $('#adapterHost'), adapterSelector: $('#adapterSelector'), adapterAttributes: $('#adapterAttributes'), adapterCollection: $('#adapterCollection'), saveSiteAdapter: $('#saveSiteAdapter'), clearSiteAdapter: $('#clearSiteAdapter'), siteAdapterList: $('#siteAdapterList'), syncSettings: $('#syncSettings'), saveSyncSettings: $('#saveSyncSettings'), exportScanConfig: $('#exportScanConfig'), importScanConfig: $('#importScanConfig'), importScanConfigFile: $('#importScanConfigFile'),
  formatTabs: [...document.querySelectorAll('[data-format]')],
  grid: $('#imageGrid'), empty: $('#emptyState'), loading: $('#loadingState'), loadingLabel: $('#loadingLabel'), error: $('#errorState'),
  loadMoreImages: $('#loadMoreImages'), loadMoreLibrary: $('#loadMoreLibrary'),
  saveAs: $('#saveAs'), download: $('#downloadButton'), zip: $('#zipButton'), selectedCount: $('#selectedCount'),
  downloadProgress: $('#downloadProgress'), progressLabel: $('#progressLabel'), progressValue: $('#progressValue'),
  progressBar: $('#progressBar'), progressDetail: $('#progressDetail'), progressMetrics: $('#progressMetrics'), cancelButton: $('#cancelButton'), retryButton: $('#retryButton'),
  retryCount: $('#retryCount'), toast: $('#toast'), language: $('#languageButton'), filterPreset: $('#filterPreset'), saveFilterPreset: $('#saveFilterPreset'), deleteFilterPreset: $('#deleteFilterPreset'), selectionPreset: $('#selectionPreset'), saveSelectionPreset: $('#saveSelectionPreset'), invertSelection: $('#invertSelection'), previewModal: $('#previewModal'), previewImage: $('#previewImage'), previewError: $('#previewError'), previewErrorText: $('#previewErrorText'), previewErrorDetail: $('#previewErrorDetail'), retryPreview: $('#retryPreview'), openPreviewPage: $('#openPreviewPage'), previewTitle: $('#previewTitle'), previewMeta: $('#previewMeta'), closePreview: $('#closePreview'), copyImageUrl: $('#copyImageUrl'), openImageUrl: $('#openImageUrl'), previewPrevious: $('#previewPrevious'), previewNext: $('#previewNext'), previewPosition: $('#previewPosition'), copyFilteredUrls: $('#copyFilteredUrls'), pageFavoriteSelected: $('#pageFavoriteSelected'), pageTagSelected: $('#pageTagSelected'), pageArchiveSelected: $('#pageArchiveSelected'), batchActionModal: $('#batchActionModal'), batchActionForm: $('#batchActionForm'), batchActionClose: $('#batchActionClose'), batchActionTitle: $('#batchActionTitle'), batchActionDescription: $('#batchActionDescription'), batchActionTagField: $('#batchActionTagField'), batchActionTagLabel: $('#batchActionTagLabel'), batchActionTagInput: $('#batchActionTagInput'), batchActionCollectionField: $('#batchActionCollectionField'), batchActionCollectionLabel: $('#batchActionCollectionLabel'), batchActionCollectionSelect: $('#batchActionCollectionSelect'), batchActionError: $('#batchActionError'), batchActionCancel: $('#batchActionCancel'), batchActionConfirm: $('#batchActionConfirm'), zoomIn: $('#zoomIn'), zoomOut: $('#zoomOut'), zoomReset: $('#zoomReset'), zoomValue: $('#zoomValue')
};

document.addEventListener('DOMContentLoaded', () => {
  init().catch(handleInitError);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'downloadProgress' && message.jobId === state.downloadJobId) updateDownloadProgress(message);
  if (message?.type === 'downloadProgress' && state.view === 'tasks') scheduleTaskRefresh();
});

// A side panel stays open while the user changes tabs. Keep the current-page
// view in sync with the active tab instead of requiring a manual refresh.
chrome.tabs?.onActivated?.addListener(() => {
  if (interactionReady && state.view === 'page') scanPage();
});
chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
  if (interactionReady && tabId === state.tabId && changeInfo.status === 'complete' && state.view === 'page') scanPage();
});

function handleInitError(error) {
  // An unexpected startup error must never leave the default spinner running
  // forever. Keep the popup interactive and expose a useful retry path.
  try {
    interactionReady = true;
    setLoading(false);
    if (els.refresh) els.refresh.disabled = false;
    if (els.error) {
      els.error.hidden = false;
      els.error.textContent = `${t('scanFailedPrefix')}${error?.message || t('pageAccessError')}`;
    }
    setText(els.scanStatus, t('scanFailed'));
  } catch {
    // There is no safe UI fallback if the DOM itself is unavailable.
  }
}

async function init() {
  // Render a usable default immediately while settings are loading. The
  // controls are bound immediately so the popup never presents dead controls.
  bindEvents();
  applyLanguage();

  const defaults = { filters: {}, saveAs: true, searchQuery: '', sort: 'page', originalOnly: false, aspectRatio: 'all', zipLayout: 'flat', conflictAction: 'uniquify', filenameTemplate: '{name}', dateFolder: false, language: null, filterPresets: [], selectionPresets: [], scanLimit: 500, autoScroll: false, scanRules: normalizeScanRules(), siteAdapters: [], syncSettings: false };
  let saved = defaults;
  try {
    saved = (await withTimeout(() => chrome.storage.local.get(defaults), 1500, '读取扩展设置超时')) || defaults;
  } catch {
    // Settings are optional. Continue with defaults so the page scan remains usable.
  }
  let synced = {};
  if (saved.syncSettings && chrome.storage.sync?.get) {
    try {
      synced = await withTimeout(() => chrome.storage.sync.get(SYNC_SETTING_KEYS), 1200, '读取同步设置超时');
    } catch {
      synced = {};
    }
  }
  const configuration = { ...saved, ...(synced || {}) };
  const userChangedLanguage = languageTouched;
  const savedFilters = saved.filters && typeof saved.filters === 'object' ? saved.filters : {};
  state.saveAs = typeof saved.saveAs === 'boolean' ? saved.saveAs : true;
  state.searchQuery = typeof saved.searchQuery === 'string' ? saved.searchQuery : '';
  state.sort = ['page', 'width-desc', 'height-desc', 'area-desc', 'name-asc'].includes(saved.sort) ? saved.sort : 'page';
  state.originalOnly = Boolean(saved.originalOnly);
  state.aspectRatio = ['all', 'landscape', 'portrait', 'square'].includes(saved.aspectRatio) ? saved.aspectRatio : 'all';
  state.zipLayout = ['flat', 'domain', 'format', 'domain-format'].includes(configuration.zipLayout) ? configuration.zipLayout : 'flat';
  state.conflictAction = ['uniquify', 'overwrite', 'prompt'].includes(configuration.conflictAction) ? configuration.conflictAction : 'uniquify';
  state.filenameTemplate = typeof configuration.filenameTemplate === 'string' && configuration.filenameTemplate.trim() ? configuration.filenameTemplate : '{name}';
  state.dateFolder = Boolean(configuration.dateFolder);
  if (!userChangedLanguage) state.language = saved.language === 'en' || saved.language === 'zh' ? saved.language : detectLanguage();
  state.filterPresets = Array.isArray(saved.filterPresets) ? saved.filterPresets : [];
  state.selectionPresets = Array.isArray(saved.selectionPresets) ? saved.selectionPresets : [];
  state.scanLimit = [0, 200, 500, 1000].includes(Number(configuration.scanLimit)) ? Number(configuration.scanLimit) : 500;
  state.autoScroll = Boolean(configuration.autoScroll);
  state.scanRules = normalizeScanRules(configuration.scanRules);
  state.siteAdapters = normalizeSiteAdapters(configuration.siteAdapters);
  state.syncSettings = Boolean(saved.syncSettings);
  state.filterValues = {
    width: { min: normalizeLimit(savedFilters.minWidth), max: normalizeLimit(savedFilters.maxWidth) },
    height: { min: normalizeLimit(savedFilters.minHeight), max: normalizeLimit(savedFilters.maxHeight) },
    size: { min: normalizeLimit(savedFilters.minSize), max: normalizeLimit(savedFilters.maxSize) }
  };
  state.aspectRange = {
    min: Math.max(0.25, Math.min(5, Number(savedFilters.minAspect) || 0.25)),
    max: Math.max(0.25, Math.min(5, Number(savedFilters.maxAspect) || 5))
  };
  if (state.aspectRange.min > state.aspectRange.max) state.aspectRange.max = state.aspectRange.min;
  for (const axis of ['width', 'height']) {
    const limits = state.filterValues[axis];
    if (limits.min !== null && limits.max !== null && limits.min > limits.max) limits.max = limits.min;
  }
  if (els.saveAs) els.saveAs.checked = state.saveAs;
  if (els.searchInput) els.searchInput.value = state.searchQuery;
  if (els.sortSelect) els.sortSelect.value = state.sort;
  if (els.originalOnly) els.originalOnly.checked = state.originalOnly;
  if (els.aspectRatio) els.aspectRatio.value = state.aspectRatio;
  if (els.zipLayout) els.zipLayout.value = state.zipLayout;
  if (els.conflictAction) els.conflictAction.value = state.conflictAction;
  if (els.filenameTemplate) els.filenameTemplate.value = state.filenameTemplate;
  if (els.dateFolder) els.dateFolder.checked = state.dateFolder;
  if (els.scanLimit) els.scanLimit.value = String(state.scanLimit);
  if (els.autoScroll) els.autoScroll.checked = state.autoScroll;
  if (els.includeSelectors) els.includeSelectors.value = state.scanRules.includeSelectors;
  if (els.excludeSelectors) els.excludeSelectors.value = state.scanRules.excludeSelectors;
  if (els.scanCssBackground) els.scanCssBackground.checked = state.scanRules.scanCssBackground;
  if (els.scanVideoPosters) els.scanVideoPosters.checked = state.scanRules.scanVideoPosters;
  if (els.includeIframes) els.includeIframes.checked = state.scanRules.includeIframes;
  if (els.syncSettings) els.syncSettings.checked = state.syncSettings;
  renderPresets();
  renderSiteAdapters();
  applyLanguage();
  interactionReady = true;
  void recoverTaskState();
  // Library data is secondary to the current-page scan. Do not block the
  // scan or the loading state on IndexedDB reads.
  void refreshLibraryData();
  await scanPage();
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;
  on(els.pageViewButton, 'click', () => switchView('page'));
  on(els.libraryViewButton, 'click', () => switchView('library'));
  on(els.historyViewButton, 'click', () => switchView('history'));
  on(els.taskViewButton, 'click', () => switchView('tasks'));
  on(els.settingsViewButton, 'click', () => switchView('settings'));
  on(els.language, 'click', async () => {
    languageTouched = true;
    state.language = state.language === 'zh' ? 'en' : 'zh';
    applyLanguage();
    render();
    updateScanStats();
    updateDownloadMetrics({ phase: 'running', completed: 0, total: state.downloadMetrics.total });
    renderLibrary();
    loadHistory();
    loadTasks();
    if (state.view === 'settings') loadStorageStats();
    // Update the UI first. Storage and service-worker persistence are
    // best-effort and must not prevent a language switch.
    await safeStorageSet({ language: state.language });
    try { Promise.resolve(chrome.runtime.sendMessage({ type: 'languageChanged', language: state.language })).catch(() => {}); } catch {}
  });
  on(els.refreshLibrary, 'click', refreshLibraryData);
  on(els.libraryScope, 'change', () => {
    state.libraryScope = els.libraryScope.value;
    refreshLibraryData();
  });
  on(els.librarySmartCollection, 'change', () => {
    state.librarySmartCollection = els.librarySmartCollection.value;
    refreshLibraryData();
  });
  on(els.libraryCollection, 'change', () => {
    state.libraryCollection = els.libraryCollection.value;
    refreshLibraryData();
  });
  const syncLibraryFilters = () => {
    state.libraryFormat = els.libraryFormat.value; state.libraryMinWidth = els.libraryMinWidth.value; state.libraryMaxWidth = els.libraryMaxWidth.value; state.libraryMinHeight = els.libraryMinHeight.value; state.libraryMaxHeight = els.libraryMaxHeight.value; state.libraryMinSize = els.libraryMinSize.value; state.libraryMaxSize = els.libraryMaxSize.value; state.librarySort = els.librarySort.value; scheduleLibraryRefresh();
  };
  [els.libraryFormat, els.libraryMinWidth, els.libraryMaxWidth, els.libraryMinHeight, els.libraryMaxHeight, els.libraryMinSize, els.libraryMaxSize, els.librarySort].forEach((control) => on(control, 'input', syncLibraryFilters));
  on(els.librarySort, 'change', syncLibraryFilters);
  on(els.libraryMinSizeRange, 'input', (event) => syncLibraryMetricRange('size', event));
  on(els.libraryMaxSizeRange, 'input', (event) => syncLibraryMetricRange('size', event));
  on(els.libraryMinAspectRange, 'input', (event) => syncLibraryMetricRange('aspect', event));
  on(els.libraryMaxAspectRange, 'input', (event) => syncLibraryMetricRange('aspect', event));
  on(els.libraryMinSize, 'change', () => syncLibraryNumericSizeRange());
  on(els.libraryMaxSize, 'change', () => syncLibraryNumericSizeRange());
  on(els.loadMoreImages, 'click', () => { state.pageRenderLimit += 120; render(); });
  on(els.loadMoreLibrary, 'click', () => { state.libraryRenderLimit += 120; renderLibrary(); });
  on(els.selectAllLibrary, 'change', () => {
    if (els.selectAllLibrary.checked) state.libraryResults.forEach((record) => state.librarySelected.add(record.url));
    else state.libraryResults.forEach((record) => state.librarySelected.delete(record.url));
    renderLibrary();
  });
  on(els.bulkFavorite, 'click', () => bulkUpdateLibrary('favorite'));
  on(els.bulkTag, 'click', () => bulkUpdateLibrary('tag'));
  on(els.bulkCollection, 'click', () => bulkUpdateLibrary('collection'));
  on(els.bulkDelete, 'click', () => bulkUpdateLibrary('delete'));
  on(els.invertLibrarySelection, 'click', invertLibrarySelection);
  on(els.clearLibrarySelection, 'click', clearLibrarySelection);
  on(els.libraryDownloadSelected, 'click', () => downloadImages(selectedLibraryImages(), false));
  on(els.libraryZipSelected, 'click', () => downloadImages(selectedLibraryImages(), true));
  on(els.exportLibraryResultsJson, 'click', () => exportLibraryResults('json'));
  on(els.exportLibraryResultsCsv, 'click', () => exportLibraryResults('csv'));
  on(els.librarySearch, 'input', () => {
    state.librarySearch = els.librarySearch.value.trim();
    scheduleLibraryRefresh();
  });
  on(els.refreshHistory, 'click', loadHistory);
  on(els.refreshTasks, 'click', loadTasks);
  on(els.retryAllTasks, 'click', retryAllTasks);
  on(els.exportFailureReport, 'click', exportFailureReport);
  on(els.refreshStorage, 'click', loadStorageStats);
  on(els.clearLibrary, 'click', clearLocalLibrary);
  on(els.resetSettings, 'click', resetExtensionSettings);
  on(els.scanLimit, 'change', async () => { state.scanLimit = Number(els.scanLimit.value) || 0; await saveRuleConfiguration(); });
  on(els.autoScroll, 'change', async () => { state.autoScroll = els.autoScroll.checked; await saveRuleConfiguration(); });
  on(els.saveScanRules, 'click', saveScanRules);
  on(els.saveSiteAdapter, 'click', saveSiteAdapter);
  on(els.clearSiteAdapter, 'click', clearSiteAdapterForm);
  on(els.syncSettings, 'change', async () => {
    state.syncSettings = Boolean(els.syncSettings.checked);
    const saved = await saveRuleConfiguration();
    if (!saved) {
      state.syncSettings = false;
      if (els.syncSettings) els.syncSettings.checked = false;
      return;
    }
    showToast(state.syncSettings ? t('syncEnabled') : t('syncDisabled'));
  });
  on(els.saveSyncSettings, 'click', async () => { if (await saveRuleConfiguration()) showToast(t('syncSaved')); });
  on(els.newCollection, 'click', createNewCollection);
  on(els.exportLibrary, 'click', exportLibraryData);
  on(els.importLibrary, 'click', () => els.importLibraryFile?.click());
  on(els.importLibraryFile, 'change', importLibraryData);
  on(els.clearHistory, 'click', async () => {
    if (!window.confirm(t('clearHistoryConfirm'))) return;
    try {
      await ImageCollectorDB.clearHistory();
      await loadHistory();
      showToast(t('historyCleared'));
    } catch { showToast(t('historyClearFailed')); }
  });
  on(els.refresh, 'click', scanPage);
  on(els.clearFilters, 'click', () => {
    if (els.minWidth) els.minWidth.value = 0;
    if (els.maxWidth) els.maxWidth.value = els.maxWidth.max;
    if (els.minHeight) els.minHeight.value = 0;
    if (els.maxHeight) els.maxHeight.value = els.maxHeight.max;
    if (els.minSize) els.minSize.value = 0;
    if (els.maxSize) els.maxSize.value = els.maxSize.max;
    if (els.minAspect) els.minAspect.value = els.minAspect.min;
    if (els.maxAspect) els.maxAspect.value = els.maxAspect.max;
    if (els.searchInput) els.searchInput.value = '';
    if (els.sortSelect) els.sortSelect.value = 'page';
    if (els.originalOnly) els.originalOnly.checked = false;
    if (els.aspectRatio) els.aspectRatio.value = 'all';
    state.filterValues = {
      width: { min: null, max: null },
      height: { min: null, max: null },
      size: { min: null, max: null }
    };
    state.aspectRange = { min: 0.25, max: 5 };
    state.searchQuery = '';
    state.sort = 'page';
    state.originalOnly = false;
    state.aspectRatio = 'all';
    state.format = 'all';
    state.source = 'all';
    renderSourceTabs();
    scheduleApplyFilters();
  });
  on(els.filterPreset, 'change', applyFilterPreset);
  on(els.saveFilterPreset, 'click', saveFilterPreset);
  on(els.deleteFilterPreset, 'click', deleteFilterPreset);
  on(els.minWidth, 'input', () => handleRangeInput('width', 'min'));
  on(els.maxWidth, 'input', () => handleRangeInput('width', 'max'));
  on(els.minHeight, 'input', () => handleRangeInput('height', 'min'));
  on(els.maxHeight, 'input', () => handleRangeInput('height', 'max'));
  on(els.minSize, 'input', () => handleRangeInput('size', 'min'));
  on(els.maxSize, 'input', () => handleRangeInput('size', 'max'));
  for (const axis of ['width', 'height', 'size']) {
    const valueButton = els[`${axis}Value`];
    const track = els[`${axis}Track`];
    const editor = els[`${axis}Editor`];
    on(valueButton, 'click', () => toggleDimensionEditor(axis));
    on(valueButton, 'keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleDimensionEditor(axis);
    });
    on(track, 'click', (event) => setDimensionFromTrack(axis, event));
    on(els[`${axis}MinValue`], 'change', () => applyDimensionEditor(axis, 'min'));
    on(els[`${axis}MaxValue`], 'change', () => applyDimensionEditor(axis, 'max'));
    on(els[`${axis}MinValue`], 'keydown', (event) => { if (event.key === 'Enter') applyDimensionEditor(axis, 'min'); });
    on(els[`${axis}MaxValue`], 'keydown', (event) => { if (event.key === 'Enter') applyDimensionEditor(axis, 'max'); });
    on(editor, 'click', (event) => event.stopPropagation());
  }
  on(els.minAspect, 'input', () => handleAspectRangeInput('min'));
  on(els.maxAspect, 'input', () => handleAspectRangeInput('max'));
  on(els.aspectTrack, 'click', setAspectFromTrack);
  els.aspectVisualTabs.forEach((tab) => on(tab, 'click', () => {
    state.aspectRatio = tab.dataset.aspect || 'all';
    if (els.aspectRatio) els.aspectRatio.value = state.aspectRatio;
    safeStorageSet({ aspectRatio: state.aspectRatio });
    updateAspectUI();
    applyFilters();
  }));
  on(document, 'click', (event) => {
    if (event.target.closest('.dimension-slider')) return;
    closeDimensionEditors();
  });
  on(document, 'click', (event) => {
    if (event.target.closest('.dimension-slider')) return;
    if (els.sizeEditor) {
      els.sizeEditor.hidden = true;
      els.sizeValue?.setAttribute('aria-expanded', 'false');
    }
  });
  on(els.searchInput, 'input', () => {
    state.searchQuery = els.searchInput.value.trim();
    chrome.storage.local.set({ searchQuery: state.searchQuery });
    scheduleApplyFilters();
  });
  on(els.sortSelect, 'change', () => {
    state.sort = els.sortSelect.value;
    chrome.storage.local.set({ sort: state.sort });
    applyFilters();
  });
  on(els.originalOnly, 'change', () => {
    state.originalOnly = els.originalOnly.checked;
    chrome.storage.local.set({ originalOnly: state.originalOnly });
    applyFilters();
  });
  on(els.aspectRatio, 'change', () => {
    state.aspectRatio = ['all', 'landscape', 'portrait', 'square'].includes(els.aspectRatio.value) ? els.aspectRatio.value : 'all';
    safeStorageSet({ aspectRatio: state.aspectRatio });
    updateAspectUI();
    applyFilters();
  });
  on(els.zipLayout, 'change', () => {
    state.zipLayout = els.zipLayout.value;
    saveRuleConfiguration();
  });
  on(els.conflictAction, 'change', () => {
    state.conflictAction = ['uniquify', 'overwrite', 'prompt'].includes(els.conflictAction.value) ? els.conflictAction.value : 'uniquify';
    els.conflictAction.value = state.conflictAction;
    saveRuleConfiguration();
  });
  on(els.filenameTemplate, 'change', () => {
    state.filenameTemplate = els.filenameTemplate.value.trim() || '{name}';
    els.filenameTemplate.value = state.filenameTemplate;
    saveRuleConfiguration();
  });
  on(els.dateFolder, 'change', () => {
    state.dateFolder = els.dateFolder.checked;
    saveRuleConfiguration();
  });
  on(els.exportScanConfig, 'click', exportScanConfiguration);
  on(els.importScanConfig, 'click', () => els.importScanConfigFile?.click());
  on(els.importScanConfigFile, 'change', importScanConfiguration);
  els.formatTabs.forEach((tab) => on(tab, 'click', () => {
    state.format = tab.dataset.format || 'all';
    applyFilters();
  }));
  els.sourceTabs.forEach((tab) => on(tab, 'click', () => {
    state.source = tab.dataset.source || 'all';
    renderSourceTabs();
    applyFilters();
  }));
  on(els.selectAll, 'change', () => {
    if (els.selectAll.checked) state.filtered.forEach((image) => state.selected.add(image.id));
    else state.filtered.forEach((image) => state.selected.delete(image.id));
    render();
  });
  on(els.invertSelection, 'click', () => {
    state.filtered.forEach((image) => state.selected[state.selected.has(image.id) ? 'delete' : 'add'](image.id));
    render();
  });
  on(els.selectionPreset, 'change', applySelectionPreset);
  on(els.saveSelectionPreset, 'click', saveSelectionPreset);
  on(els.saveAs, 'change', async () => {
    state.saveAs = els.saveAs.checked;
    await chrome.storage.local.set({ saveAs: state.saveAs });
  });
  on(els.retryButton, 'click', () => {
    if (state.retryImages.length) downloadImages([...state.retryImages], state.retryAsZip);
  });
  on(els.cancelButton, 'click', async () => {
    if (!state.downloadJobId) return;
    state.cancelled = true;
    els.cancelButton.hidden = true;
    try { await chrome.runtime.sendMessage({ type: 'cancelDownload', jobId: state.downloadJobId }); } catch { /* The worker may finish at the same time. */ }
    updateDownloadProgress({ phase: 'cancelled', percent: 100, detail: t('cancelling') });
  });
  on(els.exportJson, 'click', () => exportImages('json'));
  on(els.exportCsv, 'click', () => exportImages('csv'));
  on(els.download, 'click', () => downloadSelected(false));
  on(els.zip, 'click', () => downloadSelected(true));
  on(els.copyFilteredUrls, 'click', copyFilteredImageUrls);
  on(els.pageFavoriteSelected, 'click', () => bulkUpdateCurrentPage('favorite'));
  on(els.pageTagSelected, 'click', () => bulkUpdateCurrentPage('tag'));
  on(els.pageArchiveSelected, 'click', () => bulkUpdateCurrentPage('collection'));
  on(els.batchActionForm, 'submit', (event) => { event.preventDefault(); confirmBatchActionDialog(); });
  on(els.batchActionCancel, 'click', () => closeBatchActionDialog());
  on(els.batchActionClose, 'click', () => closeBatchActionDialog());
  on(els.batchActionModal, 'click', (event) => { if (event.target.matches('[data-close-batch-action]')) closeBatchActionDialog(); });
  on(els.batchActionTagInput, 'input', clearBatchActionError);
  on(els.batchActionCollectionSelect, 'change', clearBatchActionError);
  on(els.closePreview, 'click', closePreview);
  on(els.previewModal, 'click', (event) => { if (event.target.matches('[data-close-preview]')) closePreview(); });
  on(els.copyImageUrl, 'click', copyPreviewUrl);
  on(els.openImageUrl, 'click', () => { const url = previewCandidates(state.preview)[0]; if (url) chrome.tabs.create({ url }); });
  on(els.retryPreview, 'click', () => { if (state.preview) loadPreviewWithFallback(state.preview, { retry: true }); });
  on(els.openPreviewPage, 'click', () => {
    const url = state.preview ? previewCandidates(state.preview, true)[0] : '';
    if (url) chrome.tabs.create({ url });
  });
  on(els.previewPrevious, 'click', () => navigatePreview(-1));
  on(els.previewNext, 'click', () => navigatePreview(1));
  on(els.zoomIn, 'click', () => changePreviewZoom(.25));
  on(els.zoomOut, 'click', () => changePreviewZoom(-.25));
  on(els.zoomReset, 'click', () => { state.previewZoom = 1; updatePreviewZoom(); });
  document.addEventListener('keydown', (event) => {
    if (!els.batchActionModal.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); closeBatchActionDialog(); }
      else if (event.key === 'Tab') trapBatchActionFocus(event);
      return;
    }
    if (els.previewModal.hidden) return;
    if (event.key === 'Escape') { closePreview(); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigatePreview(-1); return; }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigatePreview(1); }
  });
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
    updateLibraryMetricLimits(records);
    state.collections = collections;
    state.libraryRecords = new Map(records.map((record) => [record.url, record]));
    state.libraryResults = records.filter((record) => {
      if (state.libraryScope === 'favorites' && !record.favorite) return false;
      if (!matchesSmartCollection(record, state.librarySmartCollection)) return false;
      if (state.libraryCollection === '__uncategorized' && record.collectionIds?.length) return false;
      if (state.libraryCollection && state.libraryCollection !== '__uncategorized' && !record.collectionIds?.includes(state.libraryCollection)) return false;
      if (state.libraryFormat !== 'all' && formatCategory(record.format) !== state.libraryFormat) return false;
      if (state.libraryMinWidth && record.width < Number(state.libraryMinWidth)) return false;
      if (state.libraryMaxWidth && record.width && record.width > Number(state.libraryMaxWidth)) return false;
      if (state.libraryMinHeight && record.height < Number(state.libraryMinHeight)) return false;
      if (state.libraryMaxHeight && record.height && record.height > Number(state.libraryMaxHeight)) return false;
      const size = Number(record.size) || 0;
      if (state.libraryMinSize && (!size || size < Number(state.libraryMinSize) * 1024)) return false;
      const rangeMinSize = Number(els.libraryMinSizeRange?.value || 0) * 1024;
      const rangeMaxSize = Number(els.libraryMaxSizeRange?.value || els.libraryMaxSizeRange?.max || 0) * 1024;
      if ((rangeMinSize > 0 && (!size || size < rangeMinSize)) || (rangeMaxSize > 0 && rangeMaxSize < Number(els.libraryMaxSizeRange?.max || 0) * 1024 && (!size || size > rangeMaxSize))) return false;
      const aspect = record.width && record.height ? record.width / record.height : 0;
      const minAspect = Number(els.libraryMinAspectRange?.value || 0.25);
      const maxAspect = Number(els.libraryMaxAspectRange?.value || 5);
      if ((minAspect > 0.25 || maxAspect < 5) && (!aspect || aspect < minAspect || aspect > maxAspect)) return false;
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
    renderSmartCollectionOptions(records);
    els.librarySmartCollection.value = state.librarySmartCollection;
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

function updateLibraryMetricLimits(records) {
  if (!els.libraryMinSizeRange || !els.libraryMaxSizeRange) return;
  const oldMax = Number(els.libraryMaxSizeRange.max) || 1024;
  const wasUnlimited = Number(els.libraryMaxSizeRange.value) >= oldMax;
  const largest = records.reduce((max, record) => Math.max(max, Number(record.size) / 1024), 1024);
  const nextMax = Math.max(1024, Math.ceil(largest / 100) * 100);
  els.libraryMinSizeRange.max = String(nextMax);
  els.libraryMaxSizeRange.max = String(nextMax);
  const numericMin = Number(state.libraryMinSize);
  const numericMax = Number(state.libraryMaxSize);
  els.libraryMinSizeRange.value = state.libraryMinSize ? String(Math.min(numericMin, nextMax)) : els.libraryMinSizeRange.value;
  if (state.libraryMaxSize) els.libraryMaxSizeRange.value = String(Math.min(numericMax, nextMax));
  else if (wasUnlimited) els.libraryMaxSizeRange.value = String(nextMax);
  if (Number(els.libraryMinSizeRange.value) > nextMax) els.libraryMinSizeRange.value = String(nextMax);
  syncLibraryMetricRange('size', null, false);
  syncLibraryMetricRange('aspect', null, false);
}

function syncLibraryNumericSizeRange() {
  if (!els.libraryMinSizeRange || !els.libraryMaxSizeRange) return;
  const max = Number(els.libraryMaxSizeRange.max) || 1024;
  const min = Math.max(0, Math.min(max, Number(els.libraryMinSize.value) || 0));
  const upper = Math.max(min, Math.min(max, Number(els.libraryMaxSize.value) || max));
  els.libraryMinSizeRange.value = String(min);
  els.libraryMaxSizeRange.value = String(upper);
  syncLibraryMetricRange('size');
}

function scheduleLibraryRefresh() {
  clearTimeout(libraryRefreshTimer);
  state.libraryRenderLimit = 120;
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
  renderAdapterCollectionOptions();
}

function renderAdapterCollectionOptions() {
  if (!els.adapterCollection) return;
  const current = els.adapterCollection.value;
  els.adapterCollection.replaceChildren(new Option(t('noAutoArchive'), ''));
  state.collections.forEach((collection) => els.adapterCollection.append(new Option(collection.name, collection.id)));
  els.adapterCollection.value = [...els.adapterCollection.options].some((option) => option.value === current) ? current : '';
}

function clearSiteAdapterForm() {
  [els.adapterHost, els.adapterSelector, els.adapterAttributes].forEach((input) => { if (input) input.value = ''; });
  if (els.adapterCollection) els.adapterCollection.value = '';
}

function renderSiteAdapters() {
  if (!els.siteAdapterList) return;
  renderAdapterCollectionOptions();
  els.siteAdapterList.replaceChildren();
  if (!state.siteAdapters.length) {
    const empty = document.createElement('div'); empty.className = 'site-adapter-empty'; empty.textContent = t('noSiteAdapters'); els.siteAdapterList.append(empty); return;
  }
  state.siteAdapters.forEach((adapter) => {
    const item = document.createElement('div'); item.className = 'site-adapter-item';
    const copy = document.createElement('div'); copy.className = 'site-adapter-copy';
    const title = document.createElement('strong'); title.textContent = adapter.hostPattern;
    const collection = state.collections.find((entry) => entry.id === adapter.collectionId);
    const collectionLabel = collection?.name || adapter.collectionName;
    const detail = document.createElement('span'); detail.textContent = adapter.selector + (collectionLabel ? ' · ' + t('autoArchive') + ': ' + collectionLabel : '');
    copy.append(title, detail);
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.title = t('removeSiteAdapter'); remove.setAttribute('aria-label', t('removeSiteAdapter'));
    remove.addEventListener('click', async () => {
      state.siteAdapters = state.siteAdapters.filter((entry) => entry.id !== adapter.id);
      await saveRuleConfiguration(); renderSiteAdapters(); showToast(t('siteAdapterRemoved'));
    });
    item.append(copy, remove); els.siteAdapterList.append(item);
  });
}

async function saveScanRules() {
  state.scanRules = normalizeScanRules({
    includeSelectors: els.includeSelectors?.value,
    excludeSelectors: els.excludeSelectors?.value,
    scanCssBackground: els.scanCssBackground?.checked,
    scanVideoPosters: els.scanVideoPosters?.checked,
    includeIframes: els.includeIframes?.checked
  });
  if (await saveRuleConfiguration()) { showToast(t('scanRulesSaved')); await scanPage(); }
}

function exportScanConfiguration() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: syncConfigurationPayload()
  };
  const filename = 'image-collector-scan-config-' + dateStamp() + '.json';
  downloadTextFile(JSON.stringify(payload, null, 2), filename, 'application/json');
  showToast(t('scanConfigExported'));
}

async function importScanConfiguration(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || typeof payload !== 'object' || !payload.settings || typeof payload.settings !== 'object') {
      throw new Error('Invalid scan configuration');
    }
    const settings = payload.settings;
    state.scanRules = normalizeScanRules(settings.scanRules);
    state.siteAdapters = normalizeSiteAdapters(settings.siteAdapters);
    state.scanLimit = [0, 200, 500, 1000].includes(Number(settings.scanLimit)) ? Number(settings.scanLimit) : 500;
    state.autoScroll = Boolean(settings.autoScroll);
    state.zipLayout = ['flat', 'domain', 'format', 'domain-format'].includes(settings.zipLayout) ? settings.zipLayout : 'flat';
    state.conflictAction = ['uniquify', 'overwrite', 'prompt'].includes(settings.conflictAction) ? settings.conflictAction : 'uniquify';
    state.filenameTemplate = typeof settings.filenameTemplate === 'string' && settings.filenameTemplate.trim() ? settings.filenameTemplate.trim() : '{name}';
    state.dateFolder = Boolean(settings.dateFolder);
    if (els.scanLimit) els.scanLimit.value = String(state.scanLimit);
    if (els.autoScroll) els.autoScroll.checked = state.autoScroll;
    if (els.zipLayout) els.zipLayout.value = state.zipLayout;
    if (els.conflictAction) els.conflictAction.value = state.conflictAction;
    if (els.filenameTemplate) els.filenameTemplate.value = state.filenameTemplate;
    if (els.dateFolder) els.dateFolder.checked = state.dateFolder;
    if (els.includeSelectors) els.includeSelectors.value = state.scanRules.includeSelectors;
    if (els.excludeSelectors) els.excludeSelectors.value = state.scanRules.excludeSelectors;
    if (els.scanCssBackground) els.scanCssBackground.checked = state.scanRules.scanCssBackground;
    if (els.scanVideoPosters) els.scanVideoPosters.checked = state.scanRules.scanVideoPosters;
    if (els.includeIframes) els.includeIframes.checked = state.scanRules.includeIframes;
    renderSiteAdapters();
    if (!await saveRuleConfiguration()) throw new Error('Could not save scan configuration');
    showToast(t('scanConfigImported'));
    await scanPage();
  } catch {
    showToast(t('scanConfigImportFailed'));
  }
}

async function saveSiteAdapter() {
  const hostPattern = String(els.adapterHost?.value || '').trim().toLowerCase();
  const selector = String(els.adapterSelector?.value || '').trim();
  if (!hostPattern || !selector) { showToast(t('siteAdapterRequired')); return; }
  const existingIndex = state.siteAdapters.findIndex((entry) => entry.hostPattern === hostPattern.slice(0, 160) && entry.selector === selector.slice(0, 300));
  if (existingIndex < 0 && state.siteAdapters.length >= 30) { showToast(t('siteAdapterLimit')); return; }
  const collection = state.collections.find((entry) => entry.id === String(els.adapterCollection?.value || ''));
  const adapter = {
    id: existingIndex >= 0 ? state.siteAdapters[existingIndex].id : 'adapter-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    hostPattern: hostPattern.slice(0, 160), selector: selector.slice(0, 300),
    attributes: normalizeTextList(els.adapterAttributes?.value).slice(0, 20),
    collectionId: String(els.adapterCollection?.value || ''), collectionName: collection?.name || ''
  };
  const nextAdapters = [...state.siteAdapters];
  if (existingIndex >= 0) nextAdapters[existingIndex] = adapter; else nextAdapters.push(adapter);
  state.siteAdapters = normalizeSiteAdapters(nextAdapters);
  if (await saveRuleConfiguration()) { clearSiteAdapterForm(); renderSiteAdapters(); showToast(t('siteAdapterSaved')); await scanPage(); }
}

function renderSmartCollectionOptions(records = [...state.libraryRecords.values()]) {
  if (!els.librarySmartCollection) return;
  const current = state.librarySmartCollection;
  els.librarySmartCollection.replaceChildren(new Option(t('smartCollections'), ''));
  const addGroup = (label, items) => {
    if (!items.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    items.forEach(([value, text]) => group.append(new Option(text, value)));
    els.librarySmartCollection.append(group);
  };
  addGroup(t('smartDimensions'), [['smart:landscape', t('landscape')], ['smart:portrait', t('portrait')], ['smart:square', t('square')], ['smart:large', t('smartLarge')]]);
  const formats = [...new Set(records.map((record) => formatCategory(record.format)))].filter((format) => format !== 'other');
  addGroup(t('smartFormats'), formats.map((format) => [`smart:format:${format}`, format.toUpperCase()]));
  const domains = [...new Set(records.map((record) => record.domain).filter(Boolean))].sort().slice(0, 12);
  addGroup(t('smartSites'), domains.map((domain) => [`smart:domain:${domain}`, domain]));
  addGroup(t('smartDates'), [['smart:today', t('smartToday')], ['smart:week', t('smartWeek')], ['smart:month', t('smartMonth')], ['smart:older', t('smartOlder')]]);
  els.librarySmartCollection.value = [...els.librarySmartCollection.options].some((option) => option.value === current) ? current : '';
  if (!els.librarySmartCollection.value && current) state.librarySmartCollection = '';
}

function matchesSmartCollection(record, value) {
  if (!value) return true;
  const ratio = record.width && record.height ? record.width / record.height : 0;
  if (value === 'smart:landscape') return ratio > 1.05;
  if (value === 'smart:portrait') return ratio > 0 && ratio < 0.95;
  if (value === 'smart:square') return ratio > 0 && Math.abs(ratio - 1) <= 0.05;
  if (value === 'smart:large') return (record.width >= 1920 && record.height >= 1080) || (record.width * record.height >= 2073600);
  if (value.startsWith('smart:format:')) return formatCategory(record.format) === value.slice(13);
  if (value.startsWith('smart:domain:')) return record.domain === value.slice(13);
  const age = Date.now() - (Number(record.updatedAt) || 0);
  if (value === 'smart:today') return age < 86400000;
  if (value === 'smart:week') return age < 7 * 86400000;
  if (value === 'smart:month') return age < 31 * 86400000;
  if (value === 'smart:older') return age >= 31 * 86400000;
  return true;
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

async function copyFilteredImageUrls() {
  const images = selectedImages().length ? selectedImages() : state.filtered;
  const urls = [...new Set(images.map((image) => previewCandidates(image)[0]).filter(Boolean))];
  if (!urls.length) { showToast(t('noUrlsToCopy')); return; }
  try {
    await navigator.clipboard.writeText(urls.join('\n'));
    showToast(t('urlsCopied', { count: urls.length }));
  } catch {
    showToast(t('copyFailed'));
  }
}

function clearBatchActionError() {
  if (!els.batchActionError) return;
  els.batchActionError.hidden = true;
  els.batchActionError.textContent = '';
}

function showBatchActionError(message) {
  if (!els.batchActionError) return;
  els.batchActionError.hidden = false;
  els.batchActionError.textContent = message;
}

function closeBatchActionDialog(result = null) {
  if (!els.batchActionModal || els.batchActionModal.hidden) return;
  const resolve = batchDialogResolver;
  const returnFocus = batchDialogReturnFocus;
  batchDialogResolver = null;
  batchDialogAction = '';
  batchDialogReturnFocus = null;
  els.batchActionModal.hidden = true;
  clearBatchActionError();
  if (returnFocus?.isConnected) returnFocus.focus();
  if (resolve) resolve(result);
}

function openBatchActionDialog(action, count) {
  if (!els.batchActionModal) return Promise.resolve(null);
  closeBatchActionDialog();
  batchDialogAction = action;
  batchDialogReturnFocus = document.activeElement;
  setText(els.batchActionTitle, action === 'tag' ? t('pageTagDialogTitle') : t('pageArchiveDialogTitle'));
  setText(els.batchActionDescription, t('batchDialogSelected', { count }));
  setText(els.batchActionTagLabel, t('batchDialogTagLabel'));
  setText(els.batchActionCollectionLabel, t('batchDialogCollectionLabel'));
  setText(els.batchActionCancel, t('batchDialogCancel'));
  setText(els.batchActionConfirm, t('batchDialogConfirm'));
  els.batchActionTagField.hidden = action !== 'tag';
  els.batchActionCollectionField.hidden = action !== 'collection';
  els.batchActionTagInput.value = '';
  els.batchActionTagInput.placeholder = t('batchDialogTagPlaceholder');
  els.batchActionCollectionSelect.replaceChildren();
  if (action === 'collection') {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('batchDialogChooseCollection');
    placeholder.disabled = true;
    placeholder.selected = true;
    els.batchActionCollectionSelect.append(placeholder);
    state.collections.forEach((collection) => {
      const option = document.createElement('option');
      option.value = collection.id;
      option.textContent = collection.name;
      els.batchActionCollectionSelect.append(option);
    });
  }
  clearBatchActionError();
  els.batchActionModal.hidden = false;
  requestAnimationFrame(() => {
    if (action === 'tag') els.batchActionTagInput.focus();
    else els.batchActionCollectionSelect.focus();
  });
  return new Promise((resolve) => { batchDialogResolver = resolve; });
}

function trapBatchActionFocus(event) {
  const focusable = [...els.batchActionModal.querySelectorAll('button, input, select')]
    .filter((element) => !element.hidden && !element.disabled && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function confirmBatchActionDialog() {
  if (!batchDialogResolver) return;
  if (batchDialogAction === 'tag') {
    const tag = els.batchActionTagInput.value.trim();
    if (!tag) { showBatchActionError(t('batchDialogTagRequired')); els.batchActionTagInput.focus(); return; }
    closeBatchActionDialog({ tag: tag.slice(0, 40) });
    return;
  }
  if (batchDialogAction === 'collection') {
    const collection = state.collections.find((item) => item.id === els.batchActionCollectionSelect.value);
    if (!collection) { showBatchActionError(t('batchDialogCollectionRequired')); els.batchActionCollectionSelect.focus(); return; }
    closeBatchActionDialog({ collection });
  }
}

async function bulkUpdateCurrentPage(action) {
  if (state.pageBatchBusy) return;
  const images = selectedImages();
  if (!images.length) { showToast(t('selectPageImages')); return; }
  const urls = [...new Set(images.map((image) => image.url).filter(Boolean))];
  state.pageBatchBusy = true;
  render();
  try {
    let updates;
    if (action === 'favorite') {
      updates = { favorite: true };
    } else if (action === 'tag') {
      const result = await openBatchActionDialog('tag', urls.length);
      if (!result) return;
      updates = (record) => ({ tags: [...new Set([...(record.tags || []), result.tag])] });
    } else if (action === 'collection') {
      state.collections = await ImageCollectorDB.listCollections();
      if (!state.collections.length) { showToast(t('createCollectionFirst')); return; }
      const result = await openBatchActionDialog('collection', urls.length);
      if (!result) return;
      updates = (record) => ({ collectionIds: [...new Set([...(record.collectionIds || []), result.collection.id])] });
    } else {
      return;
    }
    await ImageCollectorDB.bulkUpsertAndUpdateImages(images, updates);
    if (action === 'favorite') {
      showToast(t('pageFavoriteDone', { count: urls.length }));
    } else if (action === 'tag') {
      showToast(t('pageTagDone', { count: urls.length }));
    } else if (action === 'collection') {
      showToast(t('pageArchiveDone', { count: urls.length }));
    }
    await refreshLibraryData();
    render();
  } catch {
    showToast(t('pageBatchFailed'));
  } finally {
    state.pageBatchBusy = false;
    render();
  }
}

async function persistScanRecord(scanId) {
  try {
    await ImageCollectorDB.saveScan(state.images, {
      pageUrl: els.pageUrl.textContent,
      pageTitle: els.pageTitle.textContent,
      duplicateCount: state.duplicateCount
    });
    await archiveImagesBySiteAdapters(state.images, els.pageUrl.textContent);
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
  const thumbnail = document.createElement('img'); thumbnail.className = 'thumbnail'; thumbnail.alt = record.alt || t('webImage'); thumbnail.loading = 'lazy';
  loadThumbnailWithFallback(record, thumbnail, wrap);
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
  els.invertLibrarySelection.disabled = results.length === 0 || state.libraryBatchBusy;
  els.clearLibrarySelection.disabled = selectedCount === 0 || state.libraryBatchBusy;
  els.libraryDownloadSelected.disabled = selectedCount === 0;
  els.libraryZipSelected.disabled = selectedCount === 0;
  els.bulkFavorite.disabled = selectedCount === 0 || state.libraryBatchBusy;
  els.bulkTag.disabled = selectedCount === 0 || state.libraryBatchBusy;
  els.bulkCollection.disabled = selectedCount === 0 || state.libraryBatchBusy;
  els.bulkDelete.disabled = selectedCount === 0 || state.libraryBatchBusy;
  els.libraryEmpty.hidden = results.length !== 0;
  const visibleResults = results.slice(0, state.libraryRenderLimit);
  const fragment = document.createDocumentFragment();
  visibleResults.forEach((record) => fragment.append(createLibraryCard(record)));
  els.libraryGrid.append(fragment);
  if (els.loadMoreLibrary) {
    els.loadMoreLibrary.hidden = visibleResults.length >= results.length;
    els.loadMoreLibrary.textContent = t('loadMore', { count: Math.min(120, results.length - visibleResults.length) });
  }
}

function invertLibrarySelection() {
  if (state.libraryBatchBusy) return;
  state.libraryResults.forEach((record) => {
    if (state.librarySelected.has(record.url)) state.librarySelected.delete(record.url);
    else state.librarySelected.add(record.url);
  });
  renderLibrary();
}

function clearLibrarySelection() {
  if (state.libraryBatchBusy) return;
  state.librarySelected.clear();
  renderLibrary();
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
  if (state.libraryBatchBusy) return;
  const urls = [...state.librarySelected];
  if (!urls.length) { showToast(t('selectBeforeAction')); return; }
  state.libraryBatchBusy = true;
  renderLibrary();
  try {
    if (action === 'favorite') {
      await ImageCollectorDB.bulkUpdateImages(urls, { favorite: true });
      showToast(t('bulkFavoriteDone'));
    } else if (action === 'tag') {
      const tag = window.prompt(t('bulkTagPrompt'));
      if (!tag?.trim()) return;
      const cleanTag = tag.trim().slice(0, 40);
      await ImageCollectorDB.bulkUpdateImages(urls, (record) => ({ tags: [...new Set([...(record.tags || []), cleanTag])] }));
      showToast(t('bulkTagDone'));
    } else if (action === 'collection') {
      state.collections = await ImageCollectorDB.listCollections();
      if (!state.collections.length) { showToast(t('createCollectionFirst')); return; }
      const names = state.collections.map((collection, index) => `${index + 1}. ${collection.name}`).join('\n');
      const choice = Number(window.prompt(`${t('bulkCollectionPrompt')}\n${names}`));
      const collection = state.collections[choice - 1]; if (!collection) return;
      await ImageCollectorDB.bulkUpdateImages(urls, (record) => ({ collectionIds: [...new Set([...(record.collectionIds || []), collection.id])] }));
      showToast(t('bulkCollectionDone'));
    } else if (action === 'delete') {
      if (!window.confirm(t('bulkDeleteConfirm'))) return;
      await ImageCollectorDB.deleteImages(urls); state.librarySelected.clear(); showToast(t('bulkDeleteDone'));
    }
    await refreshLibraryData();
  } catch { showToast(t('bulkActionFailed')); }
  finally {
    state.libraryBatchBusy = false;
    renderLibrary();
  }
}

async function loadStorageStats() {
  try {
    state.storageStats = await ImageCollectorDB.getStorageStats();
    const stats = state.storageStats;
    els.storageStats.textContent = String(stats.images) + ' ' + t('images') + ' · ' + String(stats.favorites) + ' ' + t('favorites') + ' · ' + String(stats.cachedImages || 0) + ' ' + t('cachedImages') + ' · ' + formatBytes(stats.cacheBytes || 0) + ' ' + t('cachedStorage') + ' · ' + String(stats.collections) + ' ' + t('collections') + ' · ' + formatBytes(stats.bytes);
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
    await recoverTaskState();
    state.taskRecords = await ImageCollectorDB.listDownloads(50);
    renderTasks();
  } catch {
    state.taskRecords = [];
    renderTasks();
  }
}

function recoverTaskState() {
  if (state.taskRecoveryPromise) return state.taskRecoveryPromise;
  state.taskRecoveryPromise = withTimeout(
    () => chrome.runtime.sendMessage({ type: 'recoverDownloadTasks' }),
    1500,
    '任务状态恢复超时'
  ).catch(() => null);
  return state.taskRecoveryPromise;
}

function scheduleTaskRefresh() {
  if (state.taskRefreshTimer || state.view !== 'tasks') return;
  state.taskRefreshTimer = setTimeout(() => {
    state.taskRefreshTimer = null;
    void loadTasks();
  }, 250);
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
    const failedItems = failedItemsFor(record);
    let failureDetails = null;
    if (failedItems.length) {
      failureDetails = document.createElement('details'); failureDetails.className = 'task-failure-summary';
      const summary = document.createElement('summary'); summary.textContent = t('failureDetails', { count: failedItems.length });
      const list = document.createElement('div'); list.className = 'task-failure-list';
      failedItems.slice(0, 20).forEach((failure) => {
        const row = document.createElement('span');
        const code = document.createElement('strong'); code.textContent = String(failure.code || record.errorCode || 'unknown').toUpperCase();
        const message = document.createElement('span'); message.textContent = ' ' + failureMessageForUi(failure, record); message.title = failure.url || '';
        row.append(code, message); list.append(row);
      });
      if (failedItems.length > 20) {
        const more = document.createElement('span'); more.textContent = t('moreFailures', { count: failedItems.length - 20 }); list.append(more);
      }
      failureDetails.append(summary, list);
    }
    const time = document.createElement('span'); time.textContent = formatDateTime(record.updatedAt || record.createdAt);
    footer.append(time);
    if (['queued', 'running', 'paused'].includes(record.status) && record.jobId) {
      const pause = document.createElement('button'); pause.type = 'button'; pause.className = 'subtle-button'; pause.textContent = record.status === 'paused' ? t('resume') : t('pause'); pause.addEventListener('click', () => sendTaskAction(record, record.status === 'paused' ? 'resumeDownload' : 'pauseDownload'));
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'subtle-button danger'; cancel.textContent = t('cancel'); cancel.addEventListener('click', () => sendTaskAction(record, 'cancelDownload'));
      footer.append(pause, cancel);
    }
    if (['failed', 'partial'].includes(record.status) && failedItems.length) {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'subtle-button'; retry.textContent = t('retry'); retry.addEventListener('click', () => retryTask(record));
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'subtle-button'; copy.textContent = t('copyFailureUrls'); copy.addEventListener('click', () => copyFailureUrls(record));
      footer.append(retry, copy);
    }
    item.append(header, progress, detail);
    if (failureDetails) item.append(failureDetails);
    item.append(footer); els.taskList.append(item);
  });
}

function taskStatusLabel(status) {
  const labels = { queued: t('queued'), running: t('running'), paused: t('paused'), completed: t('completed'), started: t('completed'), partial: t('partial'), failed: t('failed'), cancelled: t('cancelled') };
  return labels[status] || status;
}

function failedItemsFor(record) {
  const stored = Array.isArray(record?.failedItems) ? record.failedItems.filter((item) => item?.url) : [];
  return stored;
}

function failureMessageForUi(failure, record) {
  const code = failure?.code || record?.errorCode || '';
  if (code === 'service-worker-restarted') return t('serviceWorkerRestarted');
  if (code === 'timeout') return t('requestTimeout');
  return failure?.error || record?.error || t('unknownFailure');
}

function failureReportItemsFor(record) {
  const stored = failedItemsFor(record);
  if (stored.length) return stored;
  if (!['failed', 'partial'].includes(record?.status) || (!(Number(record?.failed) > 0) && !record?.error)) return [];
  return [{ url: '', error: record.error || t('unknownFailure'), code: record.errorCode || 'unknown', stage: record.kind === 'zip' ? 'read' : 'download' }];
}

async function retryTask(record) {
  const failed = failedItemsFor(record);
  if (!failed.length) { showToast(t('noFailedTasks')); return; }
  await downloadImages(failed.map((item) => {
    const candidates = Array.isArray(item.candidateUrls) ? item.candidateUrls.filter(Boolean) : [];
    return { url: item.url || candidates[0] || '', originalUrl: candidates[1] || '', displayUrl: candidates[2] || '', sourceUrl: candidates[3] || '' };
  }), record.kind === 'zip');
}

async function copyFailureUrls(record) {
  const urls = [...new Set(failedItemsFor(record).map((item) => item.url).filter(Boolean))];
  if (!urls.length) { showToast(t('noFailedTasks')); return; }
  try {
    await navigator.clipboard.writeText(urls.join('\n'));
    showToast(t('failureUrlsCopied', { count: urls.length }));
  } catch { showToast(t('copyFailed')); }
}

function exportFailureReport() {
  const failures = state.taskRecords.flatMap((record) => failureReportItemsFor(record).map((failure) => ({
    taskId: record.jobId || record.id || '', kind: record.kind || 'images', status: record.status || '',
    createdAt: record.createdAt || record.completedAt || 0, url: failure.url || '', stage: failure.stage || '',
    code: failure.code || record.errorCode || 'unknown', error: failure.error || record.error || ''
  })));
  if (!failures.length) { showToast(t('noFailureReport')); return; }
  downloadTextFile(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), failures }, null, 2), 'image-collector-errors-' + dateStamp() + '.json', 'application/json');
  showToast(t('failureReportExported', { count: failures.length }));
}

async function sendTaskAction(record, type) {
  try {
    await chrome.runtime.sendMessage({ type, jobId: record.jobId });
    await loadTasks();
  } catch { showToast(t('taskActionFailed')); }
}

async function retryAllTasks() {
  const failed = state.taskRecords.filter((record) => failedItemsFor(record).length);
  if (!failed.length) { showToast(t('noFailedTasks')); return; }
  for (const record of failed) await retryTask(record);
  await loadTasks();
}

function previewCandidates(image, preferDisplay = false) {
  const urls = preferDisplay
    ? [image?.displayUrl, image?.url, image?.originalUrl, image?.sourceUrl]
    : [image?.url, image?.displayUrl, image?.originalUrl, image?.sourceUrl];
  return [...new Set(urls
    .map((url) => String(url || '').trim())
    .filter(Boolean))];
}

function showPreviewUnavailable(container) {
  if (!container) return;
  container.textContent = t('previewUnavailable');
  container.style.color = '#9ba4ac';
  container.style.fontSize = '10px';
}

function loadThumbnailWithFallback(image, thumbnail, wrap) {
  const candidates = previewCandidates(image, true);
  let candidateIndex = 0;
  let cacheAttempted = false;
  let objectUrl = '';
  const tryNext = () => {
    if (candidateIndex >= candidates.length) {
      if (cacheAttempted) {
        thumbnail.hidden = true;
        showPreviewUnavailable(wrap);
        return;
      }
      cacheAttempted = true;
      ImageCollectorDB.getCachedImage(image.url).then((record) => {
        if (!record?.blob) {
          thumbnail.hidden = true;
          showPreviewUnavailable(wrap);
          return;
        }
        objectUrl = URL.createObjectURL(record.blob);
        thumbnail.hidden = false;
        thumbnail.src = objectUrl;
      }).catch(() => {
        thumbnail.hidden = true;
        showPreviewUnavailable(wrap);
      });
      return;
    }
    thumbnail.src = candidates[candidateIndex++];
  };
  thumbnail.addEventListener('error', tryNext);
  thumbnail.addEventListener('load', () => {
    if (!objectUrl) return;
    const loadedUrl = objectUrl;
    objectUrl = '';
    setTimeout(() => URL.revokeObjectURL(loadedUrl), 0);
  });
  tryNext();
}

function releasePreviewObjectUrl() {
  if (!state.previewObjectUrl) return;
  URL.revokeObjectURL(state.previewObjectUrl);
  state.previewObjectUrl = '';
}

function renderPreviewNavigation() {
  const total = state.previewList.length;
  const current = state.previewIndex >= 0 ? state.previewIndex + 1 : 0;
  if (els.previewPosition) els.previewPosition.textContent = t('previewPosition', { current, total });
  if (els.previewPrevious) els.previewPrevious.disabled = state.previewIndex <= 0;
  if (els.previewNext) els.previewNext.disabled = state.previewIndex < 0 || state.previewIndex >= total - 1;
}

function updatePreviewContent(image) {
  const primaryUrl = previewCandidates(image)[0];
  if (!primaryUrl) return false;
  state.preview = image;
  state.previewZoom = 1;
  els.previewImage.alt = image.alt || t('imagePreview');
  els.previewTitle.textContent = fileName(primaryUrl);
  els.previewMeta.textContent = (image.width && image.height ? image.width + ' × ' + image.height + 'px' : t('unknownSize')) + ' · ' + formatLabel(image.format) + (image.original ? ' · ' + t('original') : '');
  updatePreviewZoom();
  renderPreviewNavigation();
  loadPreviewWithFallback(image);
  return true;
}

function openPreviewFromList(image) {
  const list = state.view === 'library' ? state.libraryResults : state.filtered;
  state.previewList = list.some((item) => item.url === image.url) ? [...list] : [image, ...list];
  state.previewIndex = state.previewList.findIndex((item) => item.url === image.url);
  if (!updatePreviewContent(image)) return;
  els.previewModal.hidden = false;
  els.closePreview.focus();
}

function navigatePreview(delta) {
  if (els.previewModal.hidden || !state.previewList.length) return;
  const nextIndex = state.previewIndex + delta;
  if (nextIndex < 0 || nextIndex >= state.previewList.length) return;
  state.previewIndex = nextIndex;
  updatePreviewContent(state.previewList[nextIndex]);
}

function showPreviewError(detail = '') {
  els.previewImage.hidden = true;
  els.previewError.hidden = false;
  els.previewErrorText.textContent = t('previewUnavailable');
  if (els.previewErrorDetail) els.previewErrorDetail.textContent = detail || t('previewFailureHint');
}

async function loadPreviewFromCache(image, token) {
  try {
    const record = await ImageCollectorDB.getCachedImage(image.url);
    if (token !== previewLoadToken) return false;
    if (!record?.blob) return false;
    releasePreviewObjectUrl();
    state.previewObjectUrl = URL.createObjectURL(record.blob);
    els.previewImage.src = state.previewObjectUrl;
    els.previewImage.hidden = false;
    els.previewError.hidden = true;
    return true;
  } catch {
    return false;
  }
}

async function loadPreviewWithFallback(image, options = {}) {
  const candidates = previewCandidates(image, Boolean(options.retry));
  const token = ++previewLoadToken;
  let candidateIndex = 0;
  let cacheTried = false;
  let usingCachedPreview = false;
  let attemptToken = 0;
  let timeoutId = null;
  const clearPreviewTimeout = () => { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } };
  releasePreviewObjectUrl();
  els.previewError.hidden = true;
  if (els.previewErrorDetail) els.previewErrorDetail.textContent = '';
  els.previewImage.hidden = false;
  const handleFailure = async () => {
    if (token !== previewLoadToken) return;
    clearPreviewTimeout();
    attemptToken += 1;
    if (candidateIndex < candidates.length) {
      const currentAttempt = attemptToken;
      els.previewImage.src = candidates[candidateIndex++];
      timeoutId = setTimeout(() => {
        if (token === previewLoadToken && currentAttempt === attemptToken) void handleFailure();
      }, 6000);
      return;
    }
    if (!cacheTried) {
      cacheTried = true;
      if (await loadPreviewFromCache(image, token)) {
        usingCachedPreview = true;
        return;
      }
    }
    if (token === previewLoadToken) showPreviewError(t('previewFailureHint', { count: candidates.length }));
  };
  els.previewImage.onerror = handleFailure;
  els.previewImage.onload = () => {
    if (token !== previewLoadToken) return;
    clearPreviewTimeout();
    attemptToken += 1;
    els.previewImage.hidden = false;
    els.previewError.hidden = true;
    if (!usingCachedPreview) void requestImageCache(image);
  };
  if (candidates.length) {
    const currentAttempt = ++attemptToken;
    els.previewImage.src = candidates[candidateIndex++];
    timeoutId = setTimeout(() => {
      if (token === previewLoadToken && currentAttempt === attemptToken) void handleFailure();
    }, 6000);
  }
  else if (!(await loadPreviewFromCache(image, token)) && token === previewLoadToken) showPreviewError(t('previewFailureHint', { count: 0 }));
}

function openPreview(image) {
  return openPreviewFromList(image);
}

function openPreviewLegacy(image) {
  const primaryUrl = previewCandidates(image)[0];
  if (!primaryUrl) return;
  state.preview = image;
  state.previewZoom = 1;
  els.previewImage.alt = image.alt || t('imagePreview');
  els.previewTitle.textContent = fileName(primaryUrl);
  els.previewMeta.textContent = `${image.width && image.height ? `${image.width} × ${image.height}px` : t('unknownSize')} · ${formatLabel(image.format)}${image.original ? ` · ${t('original')}` : ''}`;
  updatePreviewZoom();
  els.previewModal.hidden = false;
  loadPreviewWithFallback(image);
  els.closePreview.focus();
}

function closePreview() {
  previewLoadToken += 1;
  releasePreviewObjectUrl();
  els.previewModal.hidden = true;
  els.previewImage.removeAttribute('src');
  els.previewImage.hidden = false;
  els.previewImage.onerror = null;
  els.previewImage.onload = null;
  els.previewError.hidden = true;
  if (els.previewErrorDetail) els.previewErrorDetail.textContent = '';
  state.preview = null;
  state.previewList = [];
  state.previewIndex = -1;
  renderPreviewNavigation();
}

function requestImageCache(image) {
  if (!image?.url) return Promise.resolve(null);
  try {
    return Promise.resolve(chrome.runtime.sendMessage({ type: 'cacheImage', image })).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
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
  const url = previewCandidates(state.preview)[0];
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
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
  if (!quiet) setLoading(true, 'readingPage');
  els.refresh.disabled = true;
  els.scanStatus.textContent = quiet ? t('updating') : t('scanningStatus');
  els.error.hidden = true;
  const previousSelectedUrls = new Set(selectedImages().map((image) => image.url));
  const previousImageUrls = new Set(state.images.map((image) => image.url));
  if (!quiet) {
    state.images = [];
    state.dimensionFiltered = [];
    state.filtered = [];
    state.format = 'all';
    state.source = 'all';
    state.selected.clear();
    state.duplicateCount = 0;
    state.scanStats = { discovered: 0, duplicates: 0, skipped: 0, dimensionsChecked: 0, dimensionsFailed: 0, partial: false };
    state.retryImages = [];
    updateRetryUI();
    renderFormatTabs();
    renderSourceTabs();
    render();
  }
  try {
    const tabs = await withTimeout(
      () => chrome.tabs.query({ active: true, currentWindow: true }),
      5000,
      t('scanTimeout')
    );
    const tab = tabs[0];
    if (!tab?.id) throw new Error(t('noActiveTab'));
    if (scanId !== state.scanId) return;
    state.tabId = tab.id;
    els.pageTitle.textContent = tab.title || t('currentPage');
    els.pageUrl.textContent = tab.url || '';
    els.pageIcon.textContent = getDomainLetter(tab.url);
    if (!quiet) setScanPhase('discoveringImages');
    const results = await withTimeout(
      () => chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: collectPageImages, args: [{ limit: state.scanLimit, autoScroll: state.autoScroll, language: state.language, fast: !quiet, timeLimitMs: quiet ? 15000 : 5000, scanRules: state.scanRules, siteAdapters: state.siteAdapters, pageUrl: tab.url || '' }] }),
      quiet ? 30000 : 15000,
      t('scanTimeout')
    );
    if (scanId !== state.scanId) return;
    const merged = new Map();
    let duplicateCount = 0;
    let partialScan = false;
    let skippedCount = 0;
    for (const result of results || []) {
      const payload = result?.result || {};
      const rawImages = Array.isArray(payload) ? payload : payload.images || [];
      duplicateCount += Array.isArray(payload) ? 0 : Number(payload.duplicateCount || 0);
      skippedCount += Array.isArray(payload) ? 0 : Number(payload.skipped || 0);
      partialScan = partialScan || Boolean(!Array.isArray(payload) && payload.partial);
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
    state.duplicateCount = partialScan ? Math.max(state.duplicateCount, duplicateCount) : duplicateCount;
    state.scanStats = {
      ...state.scanStats,
      discovered: merged.size,
      duplicates: state.duplicateCount,
      skipped: skippedCount,
      partial: partialScan
    };
    updateScanStats();
    const discovered = [...merged.values()].map((image, index) => ({
      ...image,
      format: image.format || 'other',
      id: `${index}-${image.url}`,
      index
    }));
    if (quiet && partialScan) {
      const combined = new Map(state.images.map((image) => [image.url, image]));
      discovered.forEach((image) => {
        const previous = combined.get(image.url);
        combined.set(image.url, previous ? { ...previous, ...image, id: previous.id, index: previous.index } : image);
      });
      state.images = [...combined.values()];
    } else {
      state.images = discovered;
    }
    const newImageCount = quiet ? discovered.filter((image) => !previousImageUrls.has(image.url)).length : 0;
    state.selected.clear();
    state.images.forEach((image) => { if (previousSelectedUrls.has(image.url)) state.selected.add(image.id); });
    updateScanStatus();
    updateRangeLimits();
    applyFilters();
    if (!quiet) await persistScanRecord(scanId);
    if (!quiet) setScanPhase('readingDimensions');
    await loadImageMetadata(scanId);
    if (newImageCount > 0) showToast(t('newImagesFound', { count: newImageCount }));
  } catch (error) {
    if (scanId !== state.scanId) return;
    if (!quiet) {
      state.images = [];
      state.dimensionFiltered = [];
      state.filtered = [];
      state.selected.clear();
      state.scanStats.partial = true;
      updateScanStats();
      render();
      els.error.hidden = false;
      els.error.textContent = `${t('scanFailedPrefix')}${error.message || t('pageAccessError')}`;
    }
    if (!quiet) els.scanStatus.textContent = t('scanFailed');
    else updateScanStatus();
  } finally {
    if (scanId === state.scanId) {
      setLoading(false);
      els.refresh.disabled = false;
      if (!quiet) updateScanStatus();
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

function siteHostMatches(pattern, pageUrl) {
  let hostname = '';
  try { hostname = new URL(pageUrl).hostname.toLowerCase(); } catch { return false; }
  const normalized = String(pattern || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!normalized) return false;
  if (normalized.startsWith('*.')) return hostname === normalized.slice(2) || hostname.endsWith('.' + normalized.slice(2));
  return hostname === normalized || hostname.endsWith('.' + normalized);
}

async function archiveImagesBySiteAdapters(images, pageUrl) {
  const matchedAdapters = state.siteAdapters.filter((adapter) => siteHostMatches(adapter.hostPattern, pageUrl) && (adapter.collectionId || adapter.collectionName));
  if (!matchedAdapters.length || !images.length) return;
  let availableCollections = state.collections;
  if (!availableCollections.length) {
    try { availableCollections = await ImageCollectorDB.listCollections(); } catch { availableCollections = []; }
  }
  const collectionIds = [];
  for (const adapter of matchedAdapters) {
    if (adapter.collectionId && availableCollections.some((collection) => collection.id === adapter.collectionId)) {
      collectionIds.push(adapter.collectionId);
      continue;
    }
    if (!adapter.collectionName) continue;
    try {
      const collections = availableCollections;
      const existing = collections.find((collection) => collection.name.toLowerCase() === adapter.collectionName.toLowerCase());
      const collection = existing || await ImageCollectorDB.createCollection(adapter.collectionName);
      if (collection?.id) {
        adapter.collectionId = collection.id;
        availableCollections = [...availableCollections.filter((entry) => entry.id !== collection.id), collection];
        collectionIds.push(collection.id);
      }
    } catch {
      // A missing local collection should not interrupt scanning.
    }
  }
  const adapterIdSet = new Set(matchedAdapters.map((adapter) => adapter.id));
  const urls = images.filter((image) => (image.adapterIds || []).some((id) => adapterIdSet.has(id))).map((image) => image.url).filter(Boolean);
  if (!collectionIds.length || !urls.length) return;
  state.collections = availableCollections;
  try {
    await ImageCollectorDB.bulkUpdateImages(urls, (record) => ({ collectionIds: [...new Set([...(record.collectionIds || []), ...collectionIds])] }));
    if (state.syncSettings) await saveRuleConfiguration();
  } catch {
    // Auto-archiving is an enhancement and must never make scanning fail.
  }
}

async function loadImageMetadata(scanId) {
  const images = state.images.slice(0, 300);
  if (!images.length) {
    updateScanStats();
    return;
  }
  try {
    const response = await withTimeout(
      () => chrome.runtime.sendMessage({ type: 'inspectImages', images }),
      12000,
      t('metadataTimeout')
    );
    if (scanId !== state.scanId || !Array.isArray(response?.items)) return;
    const metadata = new Map(response.items.map((item) => [item.url, item]));
    state.scanStats.dimensionsChecked = response.items.length;
    state.scanStats.dimensionsFailed = response.items.filter((item) => !item.size && !item.mime).length;
    state.images.forEach((image) => {
      const item = metadata.get(image.url);
      if (!item) return;
      image.size = Number(item.size) || 0;
      image.mime = item.mime || '';
    });
    updateRangeLimits();
    applyFilters();
    try {
      await ImageCollectorDB.upsertImages(state.images);
      await refreshLibraryData();
    } catch {
      // Metadata persistence is optional and must not affect the image grid.
    }
  } catch {
    state.scanStats.dimensionsChecked = 0;
    state.scanStats.dimensionsFailed = images.length;
    state.scanStats.partial = true;
    // Metadata is optional; image discovery should remain usable when HEAD is blocked.
  }
  updateScanStats();
}

async function collectPageImages(options = {}) {
  const found = [];
  const seenUrls = new Map();
  const fingerprintCache = new WeakMap();
  const scanRules = {
    includeSelectors: String(options.scanRules?.includeSelectors || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
    excludeSelectors: String(options.scanRules?.excludeSelectors || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
    scanCssBackground: options.scanRules?.scanCssBackground !== false,
    scanVideoPosters: options.scanRules?.scanVideoPosters !== false,
    includeIframes: options.scanRules?.includeIframes !== false
  };
  const validSelector = (selector) => {
    try { document.querySelector(selector); return true; } catch { return false; }
  };
  scanRules.includeSelectors = scanRules.includeSelectors.filter(validSelector);
  scanRules.excludeSelectors = scanRules.excludeSelectors.filter(validSelector);
  const pageHost = String(location.hostname || '').toLowerCase();
  const hostMatches = (pattern) => {
    const normalized = String(pattern || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!normalized) return false;
    if (normalized.startsWith('*.')) return pageHost === normalized.slice(2) || pageHost.endsWith('.' + normalized.slice(2));
    return pageHost === normalized || pageHost.endsWith('.' + normalized);
  };
  const activeAdapters = (Array.isArray(options.siteAdapters) ? options.siteAdapters : []).filter((adapter) => hostMatches(adapter.hostPattern) && validSelector(adapter.selector));
  const adapterSelectors = activeAdapters.map((adapter) => adapter.selector).filter(Boolean);
  const includeSelectors = [...new Set([...scanRules.includeSelectors, ...adapterSelectors])];
  const matchesAny = (element, selectors) => selectors.some((selector) => {
    try { return Boolean(element?.matches?.(selector) || element?.closest?.(selector)); } catch { return false; }
  });
  const adapterIdsFor = (element) => activeAdapters.filter((adapter) => {
    try { return Boolean(element?.matches?.(adapter.selector) || element?.closest?.(adapter.selector)); } catch { return false; }
  }).map((adapter) => adapter.id);
  const excluded = (element) => matchesAny(element, scanRules.excludeSelectors);
  if (!scanRules.includeIframes && window.self !== window.top) return { images: [], duplicateCount: 0, partial: false };
  const maxCssElements = 2500;
  const maxFingerprints = 400;
  const fast = options.fast !== false;
  const timeLimitMs = Math.max(5000, Number(options.timeLimitMs) || 25000);
  let deadline = Date.now() + timeLimitMs;
  const expired = () => Date.now() >= deadline;
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
    let timer = setTimeout(done, Math.min(450, Math.max(0, deadline - Date.now())));
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(done, Math.min(350, Math.max(0, deadline - Date.now())));
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: [
      'src', 'srcset', 'poster', 'data-src', 'data-srcset', 'data-original', 'data-lazy-src', 'style', 'class'
    ] });
    function done() {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    }
    setTimeout(done, Math.min(1800, Math.max(0, deadline - Date.now())));
  });

  if (options.autoScroll) {
    const originalY = window.scrollY;
    let y = 0;
    const scrollDeadline = Date.now() + Math.min(7000, timeLimitMs);
    for (let pass = 0; pass < 40 && Date.now() < scrollDeadline; pass += 1) {
      const height = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0);
      if (y > height) break;
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 180));
      y += Math.max(window.innerHeight || 800, 800);
    }
    window.scrollTo(0, originalY);
    // Scrolling and collecting are separate phases. Always keep a full
    // collection budget after scrolling has finished.
    deadline = Date.now() + timeLimitMs;
  }
  if (!fast) await waitForPageToSettle();

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

  let skippedCount = 0;
  const add = (rawUrl, width, height, source, alt = '', options = {}) => {
    if (candidateLimit && found.length >= candidateLimit) { skippedCount += 1; return; }
    const url = normalizeUrl(rawUrl);
    if (!url) { skippedCount += 1; return; }
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
      adapterIds: [...new Set(Array.isArray(options.adapterIds) ? options.adapterIds : [])],
      element: options.element || null
    };
    const existing = seenUrls.get(url);
    if (existing) {
      existing.adapterIds = [...new Set([...(existing.adapterIds || []), ...(entry.adapterIds || [])])];
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
    if (expired()) { resolve({ width: fallbackWidth, height: fallbackHeight }); return; }
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
    setTimeout(() => finish(fallbackWidth, fallbackHeight), Math.min(1200, Math.max(0, deadline - Date.now())));
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

  const collectCustomElement = (element, source = 'CUSTOM', attributes = []) => {
    if (!element || excluded(element)) return;
    const tagName = String(element.tagName || '').toLowerCase();
    if (tagName === 'img') {
      const chosen = chooseImageSource(element);
      if (chosen) add(chosen.url, element.naturalWidth || element.width, element.naturalHeight || element.height, source, element.alt || '', {
        displayUrl: normalizeUrl(element.currentSrc || element.src || element.getAttribute('data-src')) || chosen.url,
        original: chosen.original, quality: chosen.quality, widthHint: chosen.widthHint, adapterIds: adapterIdsFor(element), element
      });
    }
    const values = [...new Set(['src', 'href', 'poster', 'srcset', 'data-srcset', 'data-src', 'data-original', 'data-full', 'data-large', 'data-image-url', ...attributes])];
    values.forEach((attribute) => {
      const value = attribute === 'currentSrc' ? element.currentSrc : element.getAttribute?.(attribute);
      if (!value) return;
      if (attribute.toLowerCase().includes('srcset')) {
        parseSrcset(value).forEach((candidate) => add(candidate.rawUrl, element.naturalWidth || element.width, element.naturalHeight || element.height, source, element.alt || '', { widthHint: candidate.widthHint, adapterIds: adapterIdsFor(element), element }));
      } else if (imageLikeUrl(normalizeUrl(value)) || attributes.includes(attribute) || tagName === 'img' || tagName === 'video') {
        if (tagName === 'video' && attribute === 'poster' && !scanRules.scanVideoPosters) return;
        add(value, element.naturalWidth || element.width, element.naturalHeight || element.height, source, element.alt || '', { adapterIds: adapterIdsFor(element), element });
      }
    });
  };
  if (includeSelectors.length) {
    includeSelectors.forEach((selector) => {
      try { document.querySelectorAll(selector).forEach((element) => collectCustomElement(element, 'RULE', activeAdapters.find((adapter) => adapter.selector === selector)?.attributes || [])); } catch { /* Ignore malformed user selectors. */ }
    });
  }
  for (const image of document.images) {
    if (expired()) break;
    if (excluded(image) || (includeSelectors.length && !matchesAny(image, includeSelectors))) continue;
    const chosen = chooseImageSource(image);
    if (!chosen) continue;
    const displayUrl = normalizeUrl(image.currentSrc || image.src || image.getAttribute('data-src')) || chosen.url;
    add(chosen.url, image.naturalWidth || image.width, image.naturalHeight || image.height, 'IMG', image.alt || '', {
      displayUrl,
      original: chosen.original || chosen.url !== displayUrl,
      quality: chosen.quality,
      widthHint: chosen.widthHint,
      adapterIds: adapterIdsFor(image),
      element: image
    });
  }
  for (const video of scanRules.scanVideoPosters ? document.querySelectorAll('video[poster]') : []) {
    if (expired()) break;
    if (excluded(video) || (includeSelectors.length && !matchesAny(video, includeSelectors))) continue;
    const rect = video.getBoundingClientRect();
    add(video.getAttribute('poster'), video.videoWidth || rect.width, video.videoHeight || rect.height, 'VIDEO', options.language === 'en' ? 'Video poster' : '视频封面', { quality: 5500, adapterIds: adapterIdsFor(video) });
  }
  for (const object of document.querySelectorAll('object[data]')) {
    if (expired()) break;
    if (excluded(object) || (includeSelectors.length && !matchesAny(object, includeSelectors))) continue;
    const url = normalizeUrl(object.getAttribute('data'));
    if (!url || !imageLikeUrl(url)) continue;
    const rect = object.getBoundingClientRect();
    add(url, rect.width, rect.height, 'OBJECT', options.language === 'en' ? 'Embedded image' : '嵌入图片', { quality: 4000, adapterIds: adapterIdsFor(object) });
  }
  if (scanRules.scanCssBackground) {
    const allElements = [...document.querySelectorAll('*')];
    const cssElements = allElements.length > maxCssElements
      ? allElements.filter((element) => element.hasAttribute('style') || element.id || element.className).slice(0, maxCssElements)
      : allElements;
    for (const element of cssElements) {
      if (expired()) break;
      if (excluded(element) || (includeSelectors.length && !matchesAny(element, includeSelectors))) continue;
      const background = getComputedStyle(element).backgroundImage || '';
      const matches = [...background.matchAll(/url\((?:"|')?(.*?)(?:"|')?\)/g)];
      if (!matches.length) continue;
      const rect = element.getBoundingClientRect();
      for (const match of matches) {
        if (expired()) break;
        add(match[1], rect?.width, rect?.height, 'CSS', options.language === 'en' ? 'Background image' : '背景图片', { quality: 2000, adapterIds: adapterIdsFor(element) });
      }
    }
  }

  const processInBatches = async (items, concurrency, worker) => {
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length && !expired()) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index], index);
      }
    });
    await Promise.all(workers);
  };
  if (fast) {
    found.forEach((entry) => { delete entry.element; });
  } else {
    await processInBatches(found, 16, async (entry, index) => {
      if (entry.original && entry.url !== entry.displayUrl) {
        const dimensions = await probeDimensions(entry.url, entry.width || entry.widthHint, entry.height);
        entry.width = dimensions.width;
        entry.height = dimensions.height;
      }
      entry.contentKey = index < maxFingerprints ? fingerprint(entry.element) : '';
      delete entry.element;
    });
  }

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
  const images = [...unique.values()].map(({ contentKey, element, ...image }) => image);
  return { images: options.limit ? images.slice(0, Number(options.limit)) : images, duplicateCount, skipped: skippedCount, partial: expired() };
}

function applyFilters() {
  const minWidth = state.filterValues.width.min, maxWidth = state.filterValues.width.max;
  const minHeight = state.filterValues.height.min, maxHeight = state.filterValues.height.max;
  const minSize = state.filterValues.size.min, maxSize = state.filterValues.size.max;
  const dimensionMatched = state.images.filter((image) =>
    (minWidth === null || image.width >= minWidth) && (maxWidth === null || image.width <= maxWidth) &&
    (minHeight === null || image.height >= minHeight) && (maxHeight === null || image.height <= maxHeight) &&
    (minSize === null || (image.size > 0 && image.size >= minSize * 1024)) &&
    (maxSize === null || (image.size > 0 && image.size <= maxSize * 1024)) &&
    matchesAspectRatio(image, state.aspectRatio) && matchesAspectRange(image)
  );
  state.dimensionFiltered = dimensionMatched.filter((image) => !state.originalOnly || image.original);
  const sourceFiltered = state.source === 'all'
    ? state.dimensionFiltered
    : state.dimensionFiltered.filter((image) => sourceCategory(image.source) === state.source);
  const formatFiltered = state.format === 'all'
    ? sourceFiltered
    : sourceFiltered.filter((image) => formatCategory(image.format) === state.format);
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
    minHeight: serializeLimit(state.filterValues.height.min), maxHeight: serializeLimit(state.filterValues.height.max),
    minSize: serializeLimit(state.filterValues.size.min), maxSize: serializeLimit(state.filterValues.size.max),
    minAspect: state.aspectRange.min, maxAspect: state.aspectRange.max
  } });
  updateSliderUI('width');
  updateSliderUI('height');
  updateSliderUI('size');
  updateAspectUI();
  state.pageRenderLimit = 120;
  renderFormatTabs();
  renderSourceTabs();
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
    width: { ...state.filterValues.width }, height: { ...state.filterValues.height }, size: { ...state.filterValues.size }, aspectRange: { ...state.aspectRange }, format: state.format, source: state.source,
    searchQuery: state.searchQuery, sort: state.sort, originalOnly: state.originalOnly, aspectRatio: state.aspectRatio
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
  state.filterValues = { width: { ...preset.width }, height: { ...preset.height }, size: { ...(preset.size || { min: null, max: null }) } };
  state.aspectRange = { min: Math.max(0.25, Math.min(5, Number(preset.aspectRange?.min) || 0.25)), max: Math.max(0.25, Math.min(5, Number(preset.aspectRange?.max) || 5)) };
  if (state.aspectRange.min > state.aspectRange.max) state.aspectRange.max = state.aspectRange.min;
  state.format = preset.format || 'all'; state.source = ['all', 'IMG', 'CSS', 'VIDEO', 'RULE', 'other'].includes(preset.source) ? preset.source : 'all'; state.searchQuery = preset.searchQuery || ''; state.sort = preset.sort || 'page'; state.originalOnly = Boolean(preset.originalOnly); state.aspectRatio = ['all', 'landscape', 'portrait', 'square'].includes(preset.aspectRatio) ? preset.aspectRatio : 'all';
  els.searchInput.value = state.searchQuery; els.sortSelect.value = state.sort; els.originalOnly.checked = state.originalOnly; if (els.aspectRatio) els.aspectRatio.value = state.aspectRatio;
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

function sourceCategory(source) {
  return ['IMG', 'CSS', 'VIDEO', 'RULE'].includes(String(source || '').toUpperCase()) ? String(source).toUpperCase() : 'other';
}

function renderSourceTabs() {
  const counts = { all: state.dimensionFiltered.length, IMG: 0, CSS: 0, VIDEO: 0, RULE: 0, other: 0 };
  state.dimensionFiltered.forEach((image) => { counts[sourceCategory(image.source)] += 1; });
  const labels = { all: t('all'), IMG: 'IMG', CSS: 'CSS', VIDEO: 'VIDEO', RULE: t('sourceRule'), other: t('other') };
  els.sourceTabs.forEach((tab) => {
    const source = tab.dataset.source || 'all';
    const active = state.source === source;
    const count = counts[source] || 0;
    const counter = tab.querySelector('[data-source-count]');
    if (tab.childNodes[0]) tab.childNodes[0].textContent = (labels[source] || source) + ' ';
    if (counter) counter.textContent = count;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    tab.hidden = source !== 'all' && count === 0 && !active;
  });
}

function matchesAspectRatio(image, ratio) {
  if (ratio === 'all') return true;
  if (!image.width || !image.height) return false;
  const value = image.width / image.height;
  if (ratio === 'landscape') return value > 1.05;
  if (ratio === 'portrait') return value < 0.95;
  if (ratio === 'square') return Math.abs(value - 1) <= 0.05;
  return true;
}

function matchesAspectRange(image) {
  if (state.aspectRange.min <= 0.25 && state.aspectRange.max >= 5) return true;
  if (!image.width || !image.height) return false;
  const value = image.width / image.height;
  return value >= state.aspectRange.min && value <= state.aspectRange.max;
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
  const sizeValues = state.images.map((image) => Number(image.size) / 1024).filter((value) => value > 0);
  const sizeLargest = sizeValues.length ? Math.max(...sizeValues) : 1024;
  const sizeRequested = Math.max(state.filterValues.size.min || 0, state.filterValues.size.max || 0);
  const sizeMax = Math.max(1024, Math.ceil(Math.max(sizeLargest, sizeRequested) / 100) * 100);
  els.minSize.max = sizeMax;
  els.maxSize.max = sizeMax;
  els.minSize.value = state.filterValues.size.min === null ? 0 : Math.min(state.filterValues.size.min, sizeMax);
  els.maxSize.value = state.filterValues.size.max === null ? sizeMax : Math.min(state.filterValues.size.max, sizeMax);
  if (Number(els.minSize.value) > Number(els.maxSize.value)) els.maxSize.value = els.minSize.value;
  updateSliderUI('width');
  updateSliderUI('height');
  updateSliderUI('size');
  updateAspectUI();
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

function toggleDimensionEditor(axis) {
  const editor = els[`${axis}Editor`];
  if (!editor) return;
  const shouldOpen = editor.hidden;
  closeDimensionEditors();
  if (!shouldOpen) return;
  syncDimensionEditor(axis);
  editor.hidden = false;
  els[`${axis}Value`]?.setAttribute('aria-expanded', 'true');
  els[`${axis}MinValue`]?.focus();
}

function closeDimensionEditors() {
  for (const axis of ['width', 'height', 'size']) {
    const editor = els[`${axis}Editor`];
    if (!editor) continue;
    editor.hidden = true;
    els[`${axis}Value`]?.setAttribute('aria-expanded', 'false');
  }
}

function syncDimensionEditor(axis) {
  const minRange = els[`min${capitalize(axis)}`];
  const maxRange = els[`max${capitalize(axis)}`];
  const minValue = els[`${axis}MinValue`];
  const maxValue = els[`${axis}MaxValue`];
  if (!minRange || !maxRange || !minValue || !maxValue) return;
  const max = Number(maxRange.max) || 5000;
  minValue.value = Number(minRange.value) === 0 ? '' : String(Math.round(Number(minRange.value)));
  maxValue.value = Number(maxRange.value) === max ? '' : String(Math.round(Number(maxRange.value)));
  minValue.placeholder = t('unlimited');
  maxValue.placeholder = t('unlimited');
  minValue.setAttribute('aria-label', `${t(`${axis}Min`)} px`);
  maxValue.setAttribute('aria-label', `${t(`${axis}Max`)} px`);
}

function applyDimensionEditor(axis, changedSide) {
  const minRange = els[`min${capitalize(axis)}`];
  const maxRange = els[`max${capitalize(axis)}`];
  const minValue = els[`${axis}MinValue`];
  const maxValue = els[`${axis}MaxValue`];
  if (!minRange || !maxRange || !minValue || !maxValue) return;
  const max = Number(maxRange.max) || 5000;
  const parseValue = (input, fallback) => {
    const raw = input.value.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : fallback;
  };
  let min = parseValue(minValue, 0);
  let upper = parseValue(maxValue, max);
  if (min > upper) {
    if (changedSide === 'min') upper = min;
    else min = upper;
  }
  minRange.value = String(min);
  maxRange.value = String(upper);
  handleRangeInput(axis, changedSide);
}

function setDimensionFromTrack(axis, event) {
  const track = els[`${axis}Track`];
  if (!track || event.target?.closest?.('input')) return;
  const minRange = els[`min${capitalize(axis)}`];
  const maxRange = els[`max${capitalize(axis)}`];
  const max = Number(maxRange?.max) || 5000;
  const rect = track.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const value = Math.round(ratio * max);
  const min = Number(minRange.value);
  const upper = Number(maxRange.value);
  const changedSide = Math.abs(value - min) <= Math.abs(value - upper) ? 'min' : 'max';
  const range = changedSide === 'min' ? minRange : maxRange;
  range.value = String(value);
  handleRangeInput(axis, changedSide);
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
  syncDimensionEditor(axis);
}

function handleAspectRangeInput(changedSide) {
  if (!els.minAspect || !els.maxAspect) return;
  if (changedSide === 'min' && Number(els.minAspect.value) > Number(els.maxAspect.value)) els.maxAspect.value = els.minAspect.value;
  if (changedSide === 'max' && Number(els.maxAspect.value) < Number(els.minAspect.value)) els.minAspect.value = els.maxAspect.value;
  state.aspectRange = { min: Number(els.minAspect.value), max: Number(els.maxAspect.value) };
  updateAspectUI();
  scheduleApplyFilters();
}

function setAspectFromTrack(event) {
  if (!els.aspectTrack || event.target?.closest?.('input')) return;
  const rect = els.aspectTrack.getBoundingClientRect();
  if (!rect.width) return;
  const value = 0.25 + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 4.75;
  const changedSide = Math.abs(value - Number(els.minAspect.value)) <= Math.abs(value - Number(els.maxAspect.value)) ? 'min' : 'max';
  els[changedSide === 'min' ? 'minAspect' : 'maxAspect'].value = value.toFixed(2);
  handleAspectRangeInput(changedSide);
}

function updateAspectUI() {
  if (!els.minAspect || !els.maxAspect) return;
  const min = Number(els.minAspect.value);
  const max = Number(els.maxAspect.value);
  const start = ((min - 0.25) / 4.75) * 100;
  const end = ((max - 0.25) / 4.75) * 100;
  els.aspectTrack?.style.setProperty('--start', String(start) + '%');
  els.aspectTrack?.style.setProperty('--end', String(end) + '%');
  if (els.aspectRangeValue) els.aspectRangeValue.textContent = min <= 0.25 && max >= 5 ? t('unlimited') : min.toFixed(2) + ' : 1 – ' + max.toFixed(2) + ' : 1';
  els.aspectVisualTabs.forEach((tab) => {
    const active = (tab.dataset.aspect || 'all') === state.aspectRatio;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function syncLibraryMetricRange(axis, sourceEvent, shouldRefresh = true) {
  const isSize = axis === 'size';
  const minInput = isSize ? els.libraryMinSizeRange : els.libraryMinAspectRange;
  const maxInput = isSize ? els.libraryMaxSizeRange : els.libraryMaxAspectRange;
  if (!minInput || !maxInput) return;
  if (Number(minInput.value) > Number(maxInput.value)) {
    if (sourceEvent?.target === minInput) maxInput.value = minInput.value;
    else minInput.value = maxInput.value;
  }
  const min = Number(minInput.value);
  const max = Number(maxInput.value);
  const isUnlimited = isSize ? min === 0 && max === Number(maxInput.max) : min <= 0.25 && max >= 5;
  const value = isUnlimited ? t('unlimited') : isSize ? String(min) + ' – ' + String(max) + ' KB' : min.toFixed(2) + ' : 1 – ' + max.toFixed(2) + ' : 1';
  const track = isSize ? els.librarySizeTrack : els.libraryAspectTrack;
  const label = isSize ? els.librarySizeRangeValue : els.libraryAspectRangeValue;
  const base = Number(minInput.min);
  const span = Number(minInput.max) - base || 1;
  track?.style.setProperty('--start', String(((min - base) / span) * 100) + '%');
  track?.style.setProperty('--end', String(((max - base) / span) * 100) + '%');
  if (label) label.textContent = value;
  if (isSize) {
    els.libraryMinSize.value = min ? String(min) : '';
    els.libraryMaxSize.value = max < Number(maxInput.max) ? String(max) : '';
  }
  state.libraryRenderLimit = 120;
  if (shouldRefresh) scheduleLibraryRefresh();
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
  const visibleImages = state.filtered.slice(0, state.pageRenderLimit);
  const fragment = document.createDocumentFragment();
  for (const image of visibleImages) fragment.append(createCard(image));
  els.grid.append(fragment);
  if (els.loadMoreImages) {
    els.loadMoreImages.hidden = visibleImages.length >= state.filtered.length;
    els.loadMoreImages.textContent = t('loadMore', { count: Math.min(120, state.filtered.length - visibleImages.length) });
  }
  const selected = selectedImages();
  els.selectedCount.textContent = selected.length;
  els.selectedSummary.textContent = t('selectedCount', { count: selected.length });
  els.download.disabled = selected.length === 0;
  els.zip.disabled = selected.length === 0;
  if (els.pageFavoriteSelected) els.pageFavoriteSelected.disabled = selected.length === 0 || state.pageBatchBusy;
  if (els.pageTagSelected) els.pageTagSelected.disabled = selected.length === 0 || state.pageBatchBusy;
  if (els.pageArchiveSelected) els.pageArchiveSelected.disabled = selected.length === 0 || state.pageBatchBusy;
  if (els.copyFilteredUrls) els.copyFilteredUrls.disabled = state.filtered.length === 0;
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
  const thumbnail = document.createElement('img'); thumbnail.className = 'thumbnail'; thumbnail.alt = image.alt || t('webImage'); thumbnail.loading = 'lazy';
  loadThumbnailWithFallback(image, thumbnail, wrap);
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
  state.downloadMetrics = { startedAt: Date.now(), total: images.length };
  const knownBytes = images.reduce((sum, image) => sum + (Number(image.size) || 0), 0);
  const unknownCount = images.filter((image) => !(Number(image.size) > 0)).length;
  if (knownBytes > 200 * 1024 * 1024 || images.length > 500) showToast(t('largeDownloadWarning'));
  updateRetryUI();
  els.download.disabled = true;
  els.zip.disabled = true;
  updateDownloadProgress({ phase: 'starting', completed: 0, total: images.length, failed: 0, percent: 0, detail: t('prepareWithEstimate', { action: asZip ? t('prepareZip') : t('prepareImages'), count: images.length, size: knownBytes ? formatBytes(knownBytes) : t('unknownSize'), unknown: unknownCount }) });
  try {
    const response = await chrome.runtime.sendMessage({
      type: asZip ? 'downloadZip' : 'downloadImages', images, saveAs: state.saveAs,
      zipLayout: state.zipLayout, conflictAction: state.conflictAction, filenameTemplate: state.filenameTemplate, dateFolder: state.dateFolder, language: state.language, jobId
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

function updateDownloadMetrics(progress) {
  if (['starting', 'queued'].includes(progress.phase) || !state.downloadMetrics.startedAt) {
    state.downloadMetrics.startedAt = Date.now();
    state.downloadMetrics.total = Number(progress.total) || state.downloadMetrics.total || 0;
  }
  const completed = Math.max(0, Number(progress.completed) || 0);
  const total = Number(progress.total) || state.downloadMetrics.total || 0;
  const elapsed = Math.max(0, (Date.now() - state.downloadMetrics.startedAt) / 1000);
  const speed = completed > 0 && elapsed > 0 ? completed / elapsed : 0;
  const remaining = speed > 0 ? Math.max(0, (total - completed) / speed) : 0;
  if (els.progressMetrics) {
    els.progressMetrics.textContent = t('progressMetrics', {
      completed,
      total,
      speed: speed ? speed.toFixed(1) : '—',
      eta: speed ? formatDuration(remaining) : '—'
    });
  }
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  if (value < 60) return value + 's';
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return minutes + 'm ' + String(rest).padStart(2, '0') + 's';
}

function updateDownloadProgress(progress) {
  updateDownloadMetrics(progress);
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
    page: '当前页面', library: '素材库', history: '历史', tasks: '任务', filterPreset: '筛选预设', selectionPreset: '选择预设', clear: '清除', width: '宽度', height: '高度', format: '格式', formatHint: '按文件类型查看', originalOnly: '仅显示原图候选', originalHint: '优先使用页面提供的高清地址', aspectRatio: '宽高比', allRatios: '全部比例', landscape: '横向图片', portrait: '纵向图片', square: '正方形', selectAll: '全选当前结果', sort: '排序', pageOrder: '页面顺序', widthDesc: '宽度：从大到小', heightDesc: '高度：从大到小', areaDesc: '尺寸：从大到小', nameAsc: '文件名：A–Z', searchPage: '搜索文件名、域名或 URL', noResults: '没有符合条件的图片', noResultsHint: '尝试放宽尺寸筛选，或重新扫描当前页面。', scanning: '正在扫描当前页面…', saveLocation: '下载时选择保存位置', downloadSupport: '支持普通文件与 ZIP', zipLayout: 'ZIP 分组', noGrouping: '不分组', bySite: '按网站', byFormat: '按格式', bySiteFormat: '按网站 / 格式', filenameTemplate: '文件名模板', dateFolder: '按日期建目录', json: '导出 JSON', csv: '导出 CSV', downloadSelected: '下载选中', zip: '下载 ZIP', zipNote: 'ZIP 会将当前选中的图片合并为一个文件，适合批量保存。',
    saveFilter: '保存筛选', deletePreset: '删除预设', saveSelection: '保存选择', invert: '反选', allCollections: '全部集合', uncategorized: '未分类',
    newCollection: '新建集合', exportLibrary: '导出收藏数据', importLibrary: '导入数据', taskCount: '个任务', activeTasks: '进行中', imageDownload: '图片下载', libraryTitle: '本地素材库', refresh: '刷新', allImages: '全部图片', librarySearch: '搜索图片、域名或标签', libraryMinWidth: '最小宽度', libraryMinHeight: '最小高度', libraryEmpty: '素材库还是空的', libraryEmptyHint: '在当前页面收藏图片，或从右键菜单收藏网页图片。', historyTitle: '最近活动', clearHistory: '清空历史', recentScans: '最近扫描', downloads: '下载记录', historyEmpty: '暂时没有历史记录', historyEmptyHint: '扫描网页或下载图片后，记录会显示在这里。', settings: '设置', settingsNote: '清空素材库会删除图片、缓存、收藏、标签和集合，但不会影响当前网页。', selected: '已选', images: '张图片', favorites: '收藏', collections: '个集合', cachedImages: '个缓存', cachedStorage: '缓存', storageUnavailable: '本地存储暂时不可用',
    exportFilteredJson: '导出筛选 JSON', exportFilteredCsv: '导出筛选 CSV', libraryDownloadSelected: '下载选中', libraryZipSelected: '下载 ZIP', libraryMaxWidth: '最大宽度', libraryMaxHeight: '最大高度', libraryMinSize: '最小 KB', libraryMaxSize: '最大 KB', libraryResultsEmpty: '当前筛选结果为空', libraryResultsExported: '筛选结果已导出', items: '项',
    pause: '暂停', resume: '继续', cancel: '取消', retry: '重试', queued: '排队中', running: '进行中', paused: '已暂停', completed: '已完成', partial: '部分失败', failed: '失败', cancelled: '已取消',
    preview: '图片预览', copyUrl: '复制原图地址', openUrl: '在新标签页打开', reset: '重置', original: '原图', unknownSize: '尺寸未知', imagePreview: '图片预览', previewRetry: '重新加载', openPreviewPage: '使用网页地址',
    copied: '原图地址已复制', copyFailed: '复制失败，请检查浏览器权限', collectionUpdated: '集合已更新', collectionUpdateFailed: '集合更新失败', collectionCreated: '集合已创建', collectionCreateFailed: '集合创建失败',
    libraryExported: '素材库数据已导出', libraryExportFailed: '素材库导出失败', libraryImported: '素材库数据已导入', libraryImportFailed: '导入失败，请选择有效的 JSON 文件', taskActionFailed: '任务操作失败', noFailedTasks: '没有可重试的失败任务',
    filterPresetPrompt: '请输入筛选预设名称', selectionPresetPrompt: '请输入选择预设名称', newCollectionPrompt: '请输入集合名称', presetSaved: '预设已保存', presetDeleted: '预设已删除', selectBeforeSave: '请先选择图片', selectBeforeAction: '请先选择素材', bulkFavoriteDone: '已批量收藏', bulkTagPrompt: '请输入要添加的标签', bulkTagDone: '标签已批量添加', bulkCollectionPrompt: '请输入集合序号', createCollectionFirst: '请先创建集合', bulkCollectionDone: '已批量归档', bulkDeleteConfirm: '确定删除选中的素材吗？', bulkDeleteDone: '素材已删除', bulkActionFailed: '批量操作失败', clearLibraryConfirm: '确定清空整个素材库吗？此操作不可撤销。', libraryCleared: '素材库已清空', clearLibraryFailed: '素材库清理失败', resetSettingsConfirm: '确定重置所有扩展设置吗？', settingsReset: '设置已重置',
    sizeFilterTitle: '按尺寸筛选', unlimited: '不限', imageCount: '{count} 张图片', itemCount: '{count} 项', selectedCount: '已选 {count}', duplicates: '去重 {count}', all: '全部', other: '其它', switchLanguage: '切换语言', rescan: '重新扫描', viewSwitcher: '视图切换', filterSection: '图片筛选', searchImages: '搜索图片', sortImages: '图片排序方式', saveHelp: 'ZIP 下载或单张下载时会打开 Chrome 的保存对话框', libraryScope: '素材库筛选范围', collectionFilter: '按集合筛选', waitingTask: '等待任务开始', scanLimit: '扫描上限', maxImages: '最大扫描图片数量', imageOptions: ['200 张', '500 张', '1000 张', '不限'], autoScroll: '自动滚动加载懒加载图片',
    widthMin: '最小宽度', widthMax: '最大宽度', heightMin: '最小高度', heightMax: '最大高度', minimum: '最小', maximum: '最大', formatFilter: '按图片格式筛选', saveLocationHint: 'ZIP 下载或单张下载时会打开 Chrome 的保存对话框', filenameTemplateHint: '支持 {name}、{filename}、{domain}、{format}、{width}、{height}、{date}',
    currentPage: '当前页面', readingPage: '正在读取当前页面', discoveringImages: '正在发现图片', readingDimensions: '正在探测图片尺寸', scanningStatus: '扫描中', updating: '更新中', newImagesFound: '发现 {count} 张新图片', scanFailed: '扫描失败', scanFailedPrefix: '扫描失败：', scanTimeout: '扫描超时，请重试', metadataTimeout: '尺寸探测超时，已保留已发现的图片', pageAccessError: '当前页面不允许扩展访问，请切换到普通网页后重试。', noActiveTab: '无法获取当前标签页。', unnamedPage: '未命名页面', unknownTime: '时间未知', webImage: '网页图片', previewUnavailable: '预览不可用', selectImage: '选择 {dimensions} 图片', selectNamedImage: '选择 {name}', favorite: '收藏', favoriteImage: '收藏图片', removeFavorite: '取消收藏', downloadImage: '下载图片', removeTag: '移除标签 {tag}', chooseCollection: '选择集合', addTag: '添加标签', favoriteAdded: '已加入收藏', favoriteRemoved: '已取消收藏', favoriteFailed: '收藏操作失败', tagUpdated: '标签已更新', tagSaveFailed: '标签保存失败',
    downloadZip: '下载 ZIP', submitted: '已提交', partialFailed: '部分失败 {count}', clearHistoryConfirm: '确定清空所有扫描和下载历史吗？', historyCleared: '历史记录已清空', historyClearFailed: '历史记录清理失败', taskCancelled: '任务已取消', cancelling: '正在取消任务…', downloadCancelled: '下载任务已取消', downloadFailed: '下载失败', downloadFailedRetry: '下载失败，请重试', prepareZip: '准备生成 ZIP…', prepareImages: '准备下载图片…', processedWithFailures: '已处理 {count} 张，失败 {failed}', downloadStartedWithFailures: '已开始下载，{count} 张图片失败，可点击重试', zipStarted: 'ZIP 已开始下载', downloadStarted: '下载已开始', compressing: '正在压缩', taskFailed: '任务失败', taskComplete: '任务完成', downloadProgress: '下载进度', processedProgress: '已处理 {completed}/{total}', noImagesToExport: '当前没有可导出的图片', exportStarted: '{type} 清单已开始下载', exportFailed: '清单导出失败', taskCenter: '下载任务中心', retryFailed: '重试失败任务', retryFailedItems: '重试失败项', taskEmpty: '暂时没有下载任务', taskEmptyHint: '发起图片或 ZIP 下载后，任务会显示在这里。', settingsTitle: '设置与存储', clearLibrary: '清空素材库', resetSettings: '重置设置', myFavorites: '我的收藏', bulkFavorite: '批量收藏', bulkTag: '添加标签', bulkCollection: '归档到集合', bulkDelete: '删除', closePreview: '关闭预览'
  },
  en: {
    page: 'Current', library: 'Library', history: 'History', tasks: 'Tasks', filterPreset: 'Filter preset', selectionPreset: 'Selection preset', clear: 'Clear', width: 'Width', height: 'Height', format: 'Format', formatHint: 'Filter by file type', originalOnly: 'Original candidates only', originalHint: 'Prefer high-resolution addresses from the page', aspectRatio: 'Aspect ratio', allRatios: 'All ratios', landscape: 'Landscape', portrait: 'Portrait', square: 'Square', selectAll: 'Select all results', sort: 'Sort', pageOrder: 'Page order', widthDesc: 'Width: largest first', heightDesc: 'Height: largest first', areaDesc: 'Area: largest first', nameAsc: 'Filename: A–Z', searchPage: 'Search filename, hostname or URL', noResults: 'No matching images', noResultsHint: 'Try widening the size range or scan the page again.', scanning: 'Scanning current page…', saveLocation: 'Ask where to save downloads', downloadSupport: 'Files and ZIP supported', zipLayout: 'ZIP folders', noGrouping: 'No folders', bySite: 'By site', byFormat: 'By format', bySiteFormat: 'By site / format', filenameTemplate: 'Filename template', dateFolder: 'Create date folder', json: 'Export JSON', csv: 'Export CSV', downloadSelected: 'Download selected', zip: 'Download ZIP', zipNote: 'Selected images will be combined into one ZIP archive.',
    saveFilter: 'Save filter', deletePreset: 'Delete preset', saveSelection: 'Save selection', invert: 'Invert', allCollections: 'All collections', uncategorized: 'Uncategorized',
    newCollection: 'New collection', exportLibrary: 'Export library', importLibrary: 'Import data', taskCount: 'tasks', activeTasks: 'active', imageDownload: 'Image download', libraryTitle: 'Local library', refresh: 'Refresh', allImages: 'All images', librarySearch: 'Search images, sites or tags', libraryMinWidth: 'Min width', libraryMinHeight: 'Min height', libraryEmpty: 'Your library is empty', libraryEmptyHint: 'Favorite an image on this page or use the context menu to save one.', historyTitle: 'Recent activity', clearHistory: 'Clear history', recentScans: 'Recent scans', downloads: 'Downloads', historyEmpty: 'No activity yet', historyEmptyHint: 'Scan a page or download an image to see activity here.', settings: 'Settings', settingsNote: 'Clearing the library removes images, cached files, favorites, tags, and collections, but does not affect the current webpage.', selected: 'Selected', images: 'images', favorites: 'favorites', collections: 'collections', cachedImages: 'cached', cachedStorage: 'cache', storageUnavailable: 'Local storage is unavailable',
    exportFilteredJson: 'Export filtered JSON', exportFilteredCsv: 'Export filtered CSV', libraryDownloadSelected: 'Download selected', libraryZipSelected: 'Download ZIP', libraryMaxWidth: 'Max width', libraryMaxHeight: 'Max height', libraryMinSize: 'Min KB', libraryMaxSize: 'Max KB', libraryResultsEmpty: 'No filtered images', libraryResultsExported: 'Filtered results exported', items: 'items',
    pause: 'Pause', resume: 'Resume', cancel: 'Cancel', retry: 'Retry', queued: 'Queued', running: 'Running', paused: 'Paused', completed: 'Completed', partial: 'Partial', failed: 'Failed', cancelled: 'Cancelled',
    preview: 'Image preview', copyUrl: 'Copy original URL', openUrl: 'Open in new tab', reset: 'Reset', original: 'Original', unknownSize: 'Unknown size', imagePreview: 'Image preview', previewRetry: 'Reload', openPreviewPage: 'Use page URL',
    copied: 'Original URL copied', copyFailed: 'Copy failed; check browser permission', collectionUpdated: 'Collection updated', collectionUpdateFailed: 'Collection update failed', collectionCreated: 'Collection created', collectionCreateFailed: 'Collection creation failed',
    libraryExported: 'Library data exported', libraryExportFailed: 'Library export failed', libraryImported: 'Library data imported', libraryImportFailed: 'Import failed; choose a valid JSON file', taskActionFailed: 'Task action failed', noFailedTasks: 'No failed tasks to retry',
    filterPresetPrompt: 'Filter preset name', selectionPresetPrompt: 'Selection preset name', newCollectionPrompt: 'Collection name', presetSaved: 'Preset saved', presetDeleted: 'Preset deleted', selectBeforeSave: 'Select images first', selectBeforeAction: 'Select images first', bulkFavoriteDone: 'Images favorited', bulkTagPrompt: 'Tag to add', bulkTagDone: 'Tags added', bulkCollectionPrompt: 'Collection number', createCollectionFirst: 'Create a collection first', bulkCollectionDone: 'Images archived', bulkDeleteConfirm: 'Delete the selected images? This cannot be undone.', bulkDeleteDone: 'Images deleted', bulkActionFailed: 'Bulk action failed', clearLibraryConfirm: 'Clear the entire library? This cannot be undone.', libraryCleared: 'Library cleared', clearLibraryFailed: 'Could not clear library', resetSettingsConfirm: 'Reset all extension settings?', settingsReset: 'Settings reset',
    sizeFilterTitle: 'Filter by size', unlimited: 'Any', imageCount: '{count} image(s)', itemCount: '{count} item(s)', selectedCount: 'Selected {count}', duplicates: '{count} duplicates removed', all: 'All', other: 'Other', switchLanguage: 'Switch language', rescan: 'Rescan', viewSwitcher: 'View switcher', filterSection: 'Image filters', searchImages: 'Search images', sortImages: 'Image sort', saveHelp: 'Chrome opens a save dialog for ZIP or single-image downloads', libraryScope: 'Library scope', collectionFilter: 'Filter by collection', waitingTask: 'Waiting for task', scanLimit: 'Scan limit', maxImages: 'Maximum image count', imageOptions: ['200 images', '500 images', '1000 images', 'Unlimited'], autoScroll: 'Auto-scroll for lazy images',
    widthMin: 'Minimum width', widthMax: 'Maximum width', heightMin: 'Minimum height', heightMax: 'Maximum height', minimum: 'Min', maximum: 'Max', formatFilter: 'Filter by image format', saveLocationHint: 'Chrome opens a save dialog for ZIP or single-image downloads', filenameTemplateHint: 'Supports {name}, {filename}, {domain}, {format}, {width}, {height}, and {date}',
    currentPage: 'Current page', readingPage: 'Reading current page', discoveringImages: 'Finding images', readingDimensions: 'Checking image dimensions', scanningStatus: 'Scanning', updating: 'Updating', newImagesFound: '{count} new image(s) found', scanFailed: 'Scan failed', scanFailedPrefix: 'Scan failed: ', scanTimeout: 'Scan timed out; try again', metadataTimeout: 'Dimension check timed out; discovered images were kept', pageAccessError: 'The extension cannot access this page. Switch to a regular webpage and try again.', noActiveTab: 'Could not get the active tab.', unnamedPage: 'Untitled page', unknownTime: 'Unknown time', webImage: 'Web image', previewUnavailable: 'Preview unavailable', selectImage: 'Select {dimensions} image', selectNamedImage: 'Select {name}', favorite: 'Favorite', favoriteImage: 'Favorite image', removeFavorite: 'Remove favorite', downloadImage: 'Download image', removeTag: 'Remove tag {tag}', chooseCollection: 'Choose collection', addTag: 'Add tag', favoriteAdded: 'Added to favorites', favoriteRemoved: 'Removed from favorites', favoriteFailed: 'Favorite action failed', tagUpdated: 'Tag updated', tagSaveFailed: 'Could not save tag',
    downloadZip: 'Download ZIP', submitted: 'Submitted', partialFailed: 'Partial failure: {count}', clearHistoryConfirm: 'Clear all scan and download history?', historyCleared: 'History cleared', historyClearFailed: 'Could not clear history', taskCancelled: 'Task cancelled', cancelling: 'Cancelling…', downloadCancelled: 'Download task cancelled', downloadFailed: 'Download failed', downloadFailedRetry: 'Download failed; try again', prepareZip: 'Preparing ZIP…', prepareImages: 'Preparing image download…', processedWithFailures: 'Processed {count}; {failed} failed', downloadStartedWithFailures: 'Download started; {count} image(s) failed. You can retry them.', zipStarted: 'ZIP download started', downloadStarted: 'Download started', compressing: 'Compressing', taskFailed: 'Task failed', taskComplete: 'Task complete', downloadProgress: 'Download progress', processedProgress: 'Processed {completed}/{total}', noImagesToExport: 'There are no images to export', exportStarted: '{type} list download started', exportFailed: 'List export failed', taskCenter: 'Download task center', retryFailed: 'Retry failed tasks', retryFailedItems: 'Retry failed items', taskEmpty: 'No download tasks yet', taskEmptyHint: 'Start an image or ZIP download to see it here.', settingsTitle: 'Settings & storage', clearLibrary: 'Clear library', resetSettings: 'Reset settings', myFavorites: 'Favorites', bulkFavorite: 'Favorite', bulkTag: 'Add tag', bulkCollection: 'Archive', bulkDelete: 'Delete', closePreview: 'Close preview'
  }
};

Object.assign(TRANSLATIONS.zh, {
  smartCollections: '智能集合', smartDimensions: '按尺寸', smartFormats: '按格式', smartSites: '按网站', smartDates: '按日期', smartLarge: '大图（≥ 1920×1080）', smartToday: '今天新增', smartWeek: '最近 7 天', smartMonth: '最近 31 天', smartOlder: '更早素材', loadMore: '加载更多（{count}）', fileSize: '文件大小', aspectRange: '宽高比范围', all: '全部', ratioLandscape: '横向', ratioPortrait: '纵向', ratioSquare: '方形', sizeMin: '最小文件大小', sizeMax: '最大文件大小'
});
Object.assign(TRANSLATIONS.en, {
  smartCollections: 'Smart collections', smartDimensions: 'By dimensions', smartFormats: 'By format', smartSites: 'By website', smartDates: 'By date', smartLarge: 'Large images (≥ 1920×1080)', smartToday: 'Added today', smartWeek: 'Last 7 days', smartMonth: 'Last 31 days', smartOlder: 'Older assets', loadMore: 'Load more ({count})', fileSize: 'File size', aspectRange: 'Aspect ratio range', all: 'All', ratioLandscape: 'Landscape', ratioPortrait: 'Portrait', ratioSquare: 'Square', sizeMin: 'Minimum file size', sizeMax: 'Maximum file size'
});
Object.assign(TRANSLATIONS.zh, {
  noAutoArchive: '不自动归档', noSiteAdapters: '还没有站点规则', autoArchive: '自动归档', removeSiteAdapter: '删除站点规则', siteAdapterRemoved: '站点规则已删除', siteAdapterSaved: '站点规则已保存', siteAdapterRequired: '请填写域名和图片选择器', siteAdapterLimit: '最多保存 30 条站点规则', scanRulesSaved: '扫描规则已保存', syncEnabled: '设置同步已开启', syncDisabled: '设置同步已关闭', syncSaved: '同步设置已保存', syncSaveFailed: '同步设置保存失败', customScanRules: '自定义扫描规则', appliesToSite: '按当前网站生效', includeSelectors: '包含选择器', excludeSelectors: '排除选择器', includeSelectorsHint: '每行一个 CSS 选择器；为空时使用默认扫描器。', excludeSelectorsHint: '匹配到的元素及其子元素不会加入结果。', scanCssBackground: '扫描 CSS 背景图', scanVideoPosters: '扫描视频封面', includeIframes: '扫描 iframe', saveScanRules: '保存扫描规则', siteAdapters: '站点适配与自动归档', matchesByHost: '按域名匹配', hostPattern: '域名匹配', imageSelector: '图片选择器', extraAttributes: '额外图片属性', archiveCollection: '自动归档到集合', saveSiteAdapter: '保存站点规则', clearForm: '清空表单', syncTitle: '可选设置同步', noImageSync: '不上传图片', useChromeSync: '使用 Chrome 同步设置', syncDescription: '仅同步扫描规则、站点适配器和偏好，不同步图片、缓存或历史记录。', saveSyncSettings: '保存同步设置'
});
Object.assign(TRANSLATIONS.en, {
  noAutoArchive: 'No auto archive', noSiteAdapters: 'No site rules yet', autoArchive: 'Auto archive', removeSiteAdapter: 'Remove site rule', siteAdapterRemoved: 'Site rule removed', siteAdapterSaved: 'Site rule saved', siteAdapterRequired: 'Enter a host pattern and image selector', siteAdapterLimit: 'Up to 30 site rules can be saved', scanRulesSaved: 'Scan rules saved', syncEnabled: 'Settings sync enabled', syncDisabled: 'Settings sync disabled', syncSaved: 'Sync settings saved', syncSaveFailed: 'Could not save sync settings', customScanRules: 'Custom scan rules', appliesToSite: 'Applied to the current site', includeSelectors: 'Include selectors', excludeSelectors: 'Exclude selectors', includeSelectorsHint: 'One CSS selector per line; leave empty to use the default scanner.', excludeSelectorsHint: 'Matching elements and their descendants are excluded.', scanCssBackground: 'Scan CSS backgrounds', scanVideoPosters: 'Scan video posters', includeIframes: 'Scan iframes', saveScanRules: 'Save scan rules', siteAdapters: 'Site adapters & auto archive', matchesByHost: 'Matched by host', hostPattern: 'Host pattern', imageSelector: 'Image selector', extraAttributes: 'Extra image attributes', archiveCollection: 'Auto archive to collection', saveSiteAdapter: 'Save site rule', clearForm: 'Clear form', syncTitle: 'Optional settings sync', noImageSync: 'No images uploaded', useChromeSync: 'Use Chrome sync', syncDescription: 'Only scan rules, site adapters, and preferences are synced. Images, cache, and history stay local.', saveSyncSettings: 'Save sync settings'
});
Object.assign(TRANSLATIONS.zh, {
  sourceFilter: '来源', sourceFilterHint: '按图片发现方式查看', sourceRule: '规则', configMigration: '扫描配置迁移', configMigrationNote: '导出或导入扫描规则、站点适配器和下载偏好，不包含图片、缓存、集合或历史记录。', exportScanConfig: '导出扫描配置', importScanConfig: '导入扫描配置', scanConfigExported: '扫描配置已导出', scanConfigImported: '扫描配置已导入', scanConfigImportFailed: '导入失败，请选择有效的扫描配置 JSON 文件'
});
Object.assign(TRANSLATIONS.en, {
  sourceFilter: 'Source', sourceFilterHint: 'Filter by how each image was discovered', sourceRule: 'Rule', configMigration: 'Scan configuration portability', configMigrationNote: 'Export or import scan rules, site adapters, and download preferences. Images, cache, collections, and history are not included.', exportScanConfig: 'Export scan config', importScanConfig: 'Import scan config', scanConfigExported: 'Scan configuration exported', scanConfigImported: 'Scan configuration imported', scanConfigImportFailed: 'Import failed. Choose a valid scan configuration JSON file.'
});
Object.assign(TRANSLATIONS.zh, {
  previousImage: '上一张', nextImage: '下一张', previewPosition: '{current} / {total}', copyFilteredUrls: '复制当前结果 URL', noUrlsToCopy: '没有可复制的图片地址', urlsCopied: '已复制 {count} 个图片地址'
});
Object.assign(TRANSLATIONS.en, {
  previousImage: 'Previous image', nextImage: 'Next image', previewPosition: '{current} / {total}', copyFilteredUrls: 'Copy result URLs', noUrlsToCopy: 'There are no image URLs to copy', urlsCopied: 'Copied {count} image URL(s)'
});
Object.assign(TRANSLATIONS.zh, {
  pageFavoriteSelected: '收藏选中', pageTagSelected: '给选中加标签', pageArchiveSelected: '归档选中', selectPageImages: '请先选择当前页面图片', pageFavoriteDone: '已收藏 {count} 张图片', pageTagPrompt: '请输入要添加的标签', pageTagDone: '已为 {count} 张图片添加标签', pageArchivePrompt: '请输入要归档到的集合序号', pageArchiveDone: '已将 {count} 张图片归档', pageBatchFailed: '当前页面批量操作失败'
});
Object.assign(TRANSLATIONS.en, {
  pageFavoriteSelected: 'Favorite selected', pageTagSelected: 'Tag selected', pageArchiveSelected: 'Archive selected', selectPageImages: 'Select images on the current page first', pageFavoriteDone: 'Favorited {count} image(s)', pageTagPrompt: 'Tag to add', pageTagDone: 'Added a tag to {count} image(s)', pageArchivePrompt: 'Enter the collection number', pageArchiveDone: 'Archived {count} image(s)', pageBatchFailed: 'Current-page bulk action failed'
});
Object.assign(TRANSLATIONS.zh, {
  pageTagDialogTitle: '给选中图片添加标签', pageArchiveDialogTitle: '归档到本地集合', batchDialogSelected: '已选择 {count} 张图片', batchDialogTagLabel: '标签名称', batchDialogTagPlaceholder: '例如：产品、灵感、待处理', batchDialogCollectionLabel: '目标集合', batchDialogChooseCollection: '请选择集合', batchDialogTagRequired: '请输入标签', batchDialogCollectionRequired: '请选择集合', batchDialogCancel: '取消', batchDialogConfirm: '确认', batchDialogClose: '关闭'
});
Object.assign(TRANSLATIONS.en, {
  pageTagDialogTitle: 'Tag selected images', pageArchiveDialogTitle: 'Archive to a local collection', batchDialogSelected: '{count} image(s) selected', batchDialogTagLabel: 'Tag name', batchDialogTagPlaceholder: 'For example: product, inspiration, review', batchDialogCollectionLabel: 'Target collection', batchDialogChooseCollection: 'Choose a collection', batchDialogTagRequired: 'Enter a tag', batchDialogCollectionRequired: 'Choose a collection', batchDialogCancel: 'Cancel', batchDialogConfirm: 'Confirm', batchDialogClose: 'Close'
});
Object.assign(TRANSLATIONS.zh, {
  invertLibrarySelection: '反选当前结果', clearLibrarySelection: '清除选择'
});
Object.assign(TRANSLATIONS.en, {
  invertLibrarySelection: 'Invert current results', clearLibrarySelection: 'Clear selection'
});
Object.assign(TRANSLATIONS.zh, {
  conflictAction: '文件冲突', conflictUniquify: '自动重命名', conflictOverwrite: '覆盖已有文件', conflictPrompt: '每次询问',
  exportFailureReport: '导出错误报告', failureDetails: '失败详情（{count} 项）', moreFailures: '还有 {count} 项未展开', unknownFailure: '未知错误',
  copyFailureUrls: '复制失败 URL', failureUrlsCopied: '已复制 {count} 个失败地址', noFailureReport: '暂无失败记录', failureReportExported: '已导出 {count} 条失败记录',
  previewFailureHint: '已尝试 {count} 个图片地址；可能是防盗链、登录限制、链接失效或跨域策略导致。'
});
Object.assign(TRANSLATIONS.en, {
  conflictAction: 'File conflicts', conflictUniquify: 'Rename automatically', conflictOverwrite: 'Overwrite existing', conflictPrompt: 'Ask every time',
  exportFailureReport: 'Export error report', failureDetails: 'Failure details ({count})', moreFailures: '{count} more not shown', unknownFailure: 'Unknown error',
  copyFailureUrls: 'Copy failed URLs', failureUrlsCopied: 'Copied {count} failed URL(s)', noFailureReport: 'No failure records', failureReportExported: 'Exported {count} failure record(s)',
  previewFailureHint: 'Tried {count} image URL(s); hotlink protection, sign-in requirements, expired links, or cross-origin policy may be blocking the preview.'
});

Object.assign(TRANSLATIONS.zh, {
  scanStats: '发现 {discovered} · 跳过 {skipped} · 已探测 {dimensions} · 失败 {failed}{partial}',
  scanPartial: '部分完成',
  requestTimeout: '请求超时，可能是网络较慢或图片服务器未响应',
  serviceWorkerRestarted: '后台任务因扩展服务重启而中断，请重试失败项',
  progressMetrics: '{completed}/{total} · {speed} 项/秒 · 剩余 {eta}',
  prepareWithEstimate: '{action} · {count} 张 · 已知大小 {size} · 未知 {unknown} 张',
  largeDownloadWarning: '任务较大，已限制下载节奏；请耐心等待完成。'
});
Object.assign(TRANSLATIONS.en, {
  scanStats: 'Found {discovered} · skipped {skipped} · dimensions {dimensions} · failed {failed}{partial}',
  scanPartial: 'partial',
  requestTimeout: 'Request timed out; the network may be slow or the image server may not respond',
  serviceWorkerRestarted: 'The background task was interrupted because the extension worker restarted; retry failed items',
  progressMetrics: '{completed}/{total} · {speed} items/s · {eta} remaining',
  prepareWithEstimate: '{action} · {count} image(s) · known size {size} · unknown {unknown}',
  largeDownloadWarning: 'This is a large task; download pacing is limited. Please wait for it to finish.'
});

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
  setText(els.language, state.language === 'en' ? '中' : 'EN');
  if (els.language) els.language.title = t('switchLanguage');
  if (els.refresh) {
    els.refresh.title = t('rescan');
    els.refresh.setAttribute('aria-label', t('rescan'));
  }
  document.querySelector('.page-summary')?.setAttribute('aria-label', t('currentPage'));
  document.querySelector('.view-switcher')?.setAttribute('aria-label', t('viewSwitcher'));
  document.querySelector('.filter-panel')?.setAttribute('aria-label', t('filterSection'));
  document.querySelector('#libraryView')?.setAttribute('aria-label', t('libraryTitle'));
  document.querySelector('#historyView')?.setAttribute('aria-label', t('historyTitle'));
  document.querySelector('#taskView')?.setAttribute('aria-label', t('taskCenter'));
  document.querySelector('#settingsView')?.setAttribute('aria-label', t('settingsTitle'));
  document.querySelector('.search-box')?.setAttribute('aria-label', t('searchImages'));
  els.sortSelect?.setAttribute('aria-label', t('sortImages'));
  els.minWidth?.setAttribute('aria-label', t('widthMin')); els.maxWidth?.setAttribute('aria-label', t('widthMax'));
  els.minHeight?.setAttribute('aria-label', t('heightMin')); els.maxHeight?.setAttribute('aria-label', t('heightMax'));
  els.formatTabs.forEach((tab) => tab.closest('.format-tabs')?.setAttribute('aria-label', t('formatFilter')));
  els.sourceTabs.forEach((tab) => tab.closest('.format-tabs')?.setAttribute('aria-label', t('sourceFilter')));
  els.scanLimit?.setAttribute('aria-label', t('maxImages'));
  document.querySelector('.save-option .help')?.setAttribute('title', t('saveHelp'));
  if (els.filenameTemplate) els.filenameTemplate.title = t('filenameTemplateHint');
  els.libraryScope?.setAttribute('aria-label', t('libraryScope'));
  els.libraryCollection?.setAttribute('aria-label', t('collectionFilter'));
  els.librarySearch?.setAttribute('aria-label', t('librarySearch'));
  els.conflictAction?.setAttribute('aria-label', t('conflictAction'));
  els.closePreview?.setAttribute('aria-label', t('closePreview'));
  if (els.previewImage) els.previewImage.alt = t('imagePreview');
  if (!state.tabId) setText(els.pageTitle, t('readingPage'));
  if (state.images.length && els.loading?.hidden) updateScanStatus();
  else if (!state.images.length && els.loading?.hidden) setText(els.scanStatus, t('scanningStatus'));
  setText(els.pageViewButton, t('page'));
  const favoriteCount = els.favoriteCount?.textContent || '0';
  if (els.libraryViewButton) {
    els.libraryViewButton.innerHTML = `${t('library')} <span id="favoriteCount">${favoriteCount}</span>`;
    els.favoriteCount = $('#favoriteCount');
  }
  setText(els.historyViewButton, t('history')); setText(els.taskViewButton, t('tasks')); setText(els.settingsViewButton, t('settings'));
  if (els.filterPreset?.options[0]) els.filterPreset.options[0].textContent = t('filterPreset');
  if (els.selectionPreset?.options[0]) els.selectionPreset.options[0].textContent = t('selectionPreset');
  setText(els.saveFilterPreset, t('saveFilter')); setText(els.deleteFilterPreset, t('deletePreset')); setText(els.saveSelectionPreset, t('saveSelection')); setText(els.invertSelection, t('invert'));
  setText(els.newCollection, t('newCollection')); setText(els.exportLibrary, t('exportLibrary')); setText(els.exportLibraryResultsJson, t('exportFilteredJson')); setText(els.exportLibraryResultsCsv, t('exportFilteredCsv')); setText(els.importLibrary, t('importLibrary'));
  setText(els.previewTitle, state.preview ? fileName(previewCandidates(state.preview)[0]) : t('preview')); setText(els.copyImageUrl, t('copyUrl')); setText(els.openImageUrl, t('openUrl')); setText(els.zoomReset, t('reset'));
  if (els.previewErrorText) els.previewErrorText.textContent = t('previewUnavailable');
  if (els.previewErrorDetail && !els.previewError?.hidden) els.previewErrorDetail.textContent = t('previewFailureHint', { count: state.preview ? previewCandidates(state.preview).length : 0 });
  setText(els.retryPreview, t('previewRetry')); setText(els.openPreviewPage, t('openPreviewPage'));
  if (els.previewPrevious) els.previewPrevious.setAttribute('aria-label', t('previousImage'));
  if (els.previewNext) els.previewNext.setAttribute('aria-label', t('nextImage'));
  renderPreviewNavigation();
  setText(document.querySelector('.filter-panel h2'), t('sizeFilterTitle'));
  setText(els.clearFilters, t('clear'));
  const dimensionLabels = [...document.querySelectorAll('.dimension-slider .slider-label > span')];
  if (dimensionLabels[0]) dimensionLabels[0].textContent = t('width');
  if (dimensionLabels[1]) dimensionLabels[1].textContent = t('height');
  const editorLabels = [...document.querySelectorAll('.dimension-editor label > span:first-child')];
  editorLabels.forEach((label, index) => { label.textContent = index % 2 === 0 ? t('minimum') : t('maximum'); });
  const formatLabelNode = document.querySelector('.format-filter .slider-label > span'); if (formatLabelNode) formatLabelNode.textContent = t('format');
  const formatHint = document.querySelector('.format-hint'); if (formatHint) formatHint.textContent = t('formatHint');
  const sourceLabelNode = document.querySelector('.source-filter .slider-label > span'); if (sourceLabelNode) sourceLabelNode.textContent = t('sourceFilter');
  const sourceHint = document.querySelector('.source-filter .format-hint'); if (sourceHint) sourceHint.textContent = t('sourceFilterHint');
  const originalLabel = document.querySelector('.original-filter span'); if (originalLabel) originalLabel.textContent = t('originalOnly');
  const originalHint = document.querySelector('.original-filter small'); if (originalHint) originalHint.textContent = t('originalHint');
  const aspectLabel = document.querySelector('.aspect-filter > span'); if (aspectLabel) aspectLabel.textContent = t('aspectRatio');
  const aspectOptions = [t('allRatios'), t('landscape'), t('portrait'), t('square')]; [...(els.aspectRatio?.options || [])].forEach((option, index) => { if (aspectOptions[index]) option.textContent = aspectOptions[index]; });
  const selectAllLabel = document.querySelector('.select-all span'); if (selectAllLabel) selectAllLabel.textContent = t('selectAll');
  const search = document.querySelector('#searchInput'); if (search) search.placeholder = t('searchPage');
  const sortLabel = document.querySelector('.sort-control > span'); if (sortLabel) sortLabel.textContent = t('sort');
  const sortOptions = [t('pageOrder'), t('widthDesc'), t('heightDesc'), t('areaDesc'), t('nameAsc')]; [...(els.sortSelect?.options || [])].forEach((option, index) => { if (sortOptions[index]) option.textContent = sortOptions[index]; });
  [...els.formatTabs].forEach((tab) => { const format = tab.dataset.format; const labels = { all: t('all'), jpeg: 'JPEG', png: 'PNG', webp: 'WEBP', avif: 'AVIF', other: t('other') }; const count = tab.querySelector('[data-count]')?.textContent || '0'; tab.innerHTML = `${labels[format] || format} <strong data-count>${count}</strong>`; });
  if (els.loading?.lastChild) els.loading.lastChild.textContent = ` ${t('scanning')}`;
  renderSourceTabs();
  const saveText = document.querySelector('.save-option > span'); if (saveText) saveText.textContent = t('saveLocation');
  const downloadCaption = document.querySelector('.download-caption-note'); if (downloadCaption) downloadCaption.textContent = t('downloadSupport');
  const settingLabels = [...document.querySelectorAll('.download-settings > label > span')]; if (settingLabels[0]) settingLabels[0].textContent = t('zipLayout'); if (settingLabels[1]) settingLabels[1].textContent = t('conflictAction'); if (settingLabels[2]) settingLabels[2].textContent = t('filenameTemplate'); if (settingLabels[3]) settingLabels[3].textContent = t('dateFolder');
  const zipOptions = [t('noGrouping'), t('bySite'), t('byFormat'), t('bySiteFormat')]; [...(els.zipLayout?.options || [])].forEach((option, index) => { if (zipOptions[index]) option.textContent = zipOptions[index]; });
  const conflictOptions = [t('conflictUniquify'), t('conflictOverwrite'), t('conflictPrompt')]; [...(els.conflictAction?.options || [])].forEach((option, index) => { if (conflictOptions[index]) option.textContent = conflictOptions[index]; });
  setText(els.exportJson, t('json')); setText(els.exportCsv, t('csv')); setText(els.copyFilteredUrls, t('copyFilteredUrls'));
  setText(els.pageFavoriteSelected, t('pageFavoriteSelected')); setText(els.pageTagSelected, t('pageTagSelected')); setText(els.pageArchiveSelected, t('pageArchiveSelected'));
  setText(els.batchActionTagLabel, t('batchDialogTagLabel')); setText(els.batchActionCollectionLabel, t('batchDialogCollectionLabel')); setText(els.batchActionCancel, t('batchDialogCancel')); setText(els.batchActionConfirm, t('batchDialogConfirm'));
  if (els.batchActionClose) els.batchActionClose.setAttribute('aria-label', t('batchDialogClose'));
  if (els.download) {
    els.download.innerHTML = `${t('downloadSelected')} <span id="selectedCount">${els.selectedCount?.textContent || '0'}</span>`;
    els.selectedCount = $('#selectedCount');
  }
  if (els.zip) els.zip.innerHTML = `<span class="zip-icon">▣</span> ${t('zip')}`;
  const note = document.querySelector('.download-note'); if (note) note.textContent = t('zipNote');
  setText(els.progressLabel, t('downloadProgress'));
  if (els.downloadProgress && !els.downloadProgress.hidden && els.progressDetail && !els.progressDetail.textContent) els.progressDetail.textContent = t('waitingTask');
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
  const allImagesOption = [...(els.libraryScope?.options || [])].find((option) => option.value === 'all'); if (allImagesOption) allImagesOption.textContent = t('allImages');
  const favoritesOption = [...(els.libraryScope?.options || [])].find((option) => option.value === 'favorites'); if (favoritesOption) favoritesOption.textContent = t('myFavorites');
  const historyTitle = document.querySelector('#historyView h2'); if (historyTitle) historyTitle.textContent = t('historyTitle');
  setText(els.clearHistory, t('clearHistory'));
  const blocks = [...document.querySelectorAll('#historyView .history-block-heading strong')]; if (blocks[0]) blocks[0].textContent = t('recentScans'); if (blocks[1]) blocks[1].textContent = t('downloads');
  const historyEmptyTitle = document.querySelector('#historyEmpty strong'); if (historyEmptyTitle) historyEmptyTitle.textContent = t('historyEmpty');
  const historyEmptyHint = document.querySelector('#historyEmpty span'); if (historyEmptyHint) historyEmptyHint.textContent = t('historyEmptyHint');
  const taskTitle = document.querySelector('#taskView h2'); if (taskTitle) taskTitle.textContent = t('taskCenter');
  if (els.refreshTasks) els.refreshTasks.textContent = t('refresh');
  if (els.retryAllTasks) els.retryAllTasks.textContent = t('retryFailed');
  if (els.exportFailureReport) els.exportFailureReport.textContent = t('exportFailureReport');
  const settingsTitle = document.querySelector('#settingsView h2'); if (settingsTitle) settingsTitle.textContent = t('settingsTitle');
  if (els.refreshStorage) els.refreshStorage.textContent = t('refresh');
  if (els.clearLibrary) els.clearLibrary.textContent = t('clearLibrary');
  if (els.resetSettings) els.resetSettings.textContent = t('resetSettings');
  const settingsNote = document.querySelector('.settings-note'); if (settingsNote) settingsNote.textContent = t('settingsNote');
  const scanLabel = document.querySelector('.scan-options label:first-child > span'); if (scanLabel) scanLabel.textContent = t('scanLimit');
  const sizeLabel = document.querySelector('.metric-slider .slider-label > span'); if (sizeLabel) sizeLabel.textContent = t('fileSize');
  const aspectRangeLabel = document.querySelector('.aspect-range-filter .slider-label > span'); if (aspectRangeLabel) aspectRangeLabel.textContent = t('aspectRange');
  const aspectNames = { all: t('all'), landscape: t('ratioLandscape'), portrait: t('ratioPortrait'), square: t('ratioSquare') };
  els.aspectVisualTabs.forEach((tab) => { const text = tab.querySelector('span'); if (text) text.textContent = aspectNames[tab.dataset.aspect] || tab.dataset.aspect; });
  const librarySizeLabel = document.querySelector('.library-visual-filters .mini-range-control:first-child > span'); if (librarySizeLabel) librarySizeLabel.textContent = t('fileSize');
  const libraryAspectLabel = document.querySelector('.library-visual-filters .mini-range-control:last-child > span'); if (libraryAspectLabel) libraryAspectLabel.textContent = t('aspectRatio');
  const scrollLabel = document.querySelector('.scan-options label:nth-child(2) > span'); if (scrollLabel) scrollLabel.textContent = t('autoScroll');
  const scanOptions = t('imageOptions'); [...(els.scanLimit?.options || [])].forEach((option, index) => { if (scanOptions[index]) option.textContent = scanOptions[index]; });
  const libraryFormatOptions = state.language === 'en' ? ['All formats', 'JPEG', 'PNG', 'WEBP', 'AVIF', 'Other'] : ['全部格式', 'JPEG', 'PNG', 'WEBP', 'AVIF', '其它']; [...(els.libraryFormat?.options || [])].forEach((option, index) => { if (libraryFormatOptions[index]) option.textContent = libraryFormatOptions[index]; });
  const librarySortOptions = state.language === 'en' ? ['Recently updated', 'Width', 'Height', 'File size'] : ['最近更新', '宽度', '高度', '文件大小']; [...(els.librarySort?.options || [])].forEach((option, index) => { if (librarySortOptions[index]) option.textContent = librarySortOptions[index]; });
  setText(els.selectAllLibrary?.nextElementSibling, t('selectAll')); setText(els.invertLibrarySelection, t('invertLibrarySelection')); setText(els.clearLibrarySelection, t('clearLibrarySelection')); setText(els.bulkFavorite, t('bulkFavorite')); setText(els.bulkTag, t('bulkTag')); setText(els.bulkCollection, t('bulkCollection')); setText(els.bulkDelete, t('bulkDelete')); setText(els.libraryDownloadSelected, t('libraryDownloadSelected')); setText(els.libraryZipSelected, t('libraryZipSelected'));
  const taskEmptyTitle = document.querySelector('#taskEmpty strong'); if (taskEmptyTitle) taskEmptyTitle.textContent = t('taskEmpty');
  const taskEmptyHint = document.querySelector('#taskEmpty span'); if (taskEmptyHint) taskEmptyHint.textContent = t('taskEmptyHint');
  setText(els.cancelButton, t('cancel'));
  if (els.retryButton) {
    els.retryButton.innerHTML = `${t('retryFailedItems')} <span id="retryCount">${els.retryCount?.textContent || '0'}</span>`;
    els.retryCount = $('#retryCount');
  }
  const initialProgressDetail = els.progressDetail; if (initialProgressDetail && (!initialProgressDetail.textContent || initialProgressDetail.textContent === '等待任务开始')) initialProgressDetail.textContent = t('waitingTask');
  renderCollectionOptions();
  renderSmartCollectionOptions();
  renderSiteAdapters();
  const settingsCards = [...document.querySelectorAll('#settingsView .settings-card')];
  const cardHeadings = settingsCards.map((card) => card.querySelector('h3'));
  const cardHints = settingsCards.map((card) => card.querySelector('.settings-card-hint'));
  if (cardHeadings[0]) cardHeadings[0].textContent = t('customScanRules');
  if (cardHeadings[1]) cardHeadings[1].textContent = t('siteAdapters');
  if (cardHeadings[2]) cardHeadings[2].textContent = t('syncTitle');
  if (cardHints[0]) cardHints[0].textContent = t('appliesToSite');
  if (cardHints[1]) cardHints[1].textContent = t('matchesByHost');
  if (cardHints[2]) cardHints[2].textContent = t('noImageSync');
  if (cardHeadings[3]) cardHeadings[3].textContent = t('configMigration');
  if (cardHints[3]) cardHints[3].textContent = t('json');
  [t('customScanRules'), t('siteAdapters'), t('syncTitle'), t('configMigration')].forEach((label, index) => { if (settingsCards[index]) settingsCards[index].setAttribute('aria-label', label); });
  const migrationNote = document.querySelector('.settings-migration-note'); if (migrationNote) migrationNote.textContent = t('configMigrationNote');
  setText(els.exportScanConfig, t('exportScanConfig')); setText(els.importScanConfig, t('importScanConfig'));
  const fieldLabels = [...document.querySelectorAll('#settingsView .settings-field > span')];
  [t('includeSelectors'), t('excludeSelectors'), t('hostPattern'), t('imageSelector'), t('extraAttributes'), t('archiveCollection')].forEach((label, index) => { if (fieldLabels[index]) fieldLabels[index].textContent = label; });
  const fieldHints = [...document.querySelectorAll('#settingsView .settings-field small')];
  [t('includeSelectorsHint'), t('excludeSelectorsHint')].forEach((hint, index) => { if (fieldHints[index]) fieldHints[index].textContent = hint; });
  const scanToggles = [...document.querySelectorAll('#settingsView .settings-toggle-grid label > span')];
  [t('scanCssBackground'), t('scanVideoPosters'), t('includeIframes')].forEach((label, index) => { if (scanToggles[index]) scanToggles[index].textContent = label; });
  setText(els.saveScanRules, t('saveScanRules')); setText(els.saveSiteAdapter, t('saveSiteAdapter')); setText(els.clearSiteAdapter, t('clearForm')); setText(els.saveSyncSettings, t('saveSyncSettings'));
  const syncLabel = document.querySelector('#syncSettings + span strong'); if (syncLabel) syncLabel.textContent = t('useChromeSync');
  const syncDescription = document.querySelector('#syncSettings + span small'); if (syncDescription) syncDescription.textContent = t('syncDescription');
  if (els.includeSelectors) els.includeSelectors.placeholder = state.language === 'en' ? '.gallery img, picture source' : '例如：.gallery img, picture source';
  if (els.excludeSelectors) els.excludeSelectors.placeholder = state.language === 'en' ? '.avatar, .icon' : '例如：.avatar, .icon';
  if (els.adapterHost) els.adapterHost.placeholder = state.language === 'en' ? '*.example.com or example.com' : '例如：xiaohongshu.com 或 *.example.com';
  if (els.adapterSelector) els.adapterSelector.placeholder = state.language === 'en' ? '.note-container img' : '例如：.note-container img';
  if (els.adapterAttributes) els.adapterAttributes.placeholder = state.language === 'en' ? 'data-original,data-full' : '例如：data-original,data-full';
  updateSliderUI('width'); updateSliderUI('height');
  els.widthValue?.setAttribute('title', `${t('widthMin')} / ${t('widthMax')}`);
  els.heightValue?.setAttribute('title', `${t('heightMin')} / ${t('heightMax')}`);
}

function setScanPhase(phase) {
  state.scanPhase = phase;
  const text = t(phase);
  if (text) {
    setText(els.scanStatus, text);
    setText(els.loadingLabel, text);
  }
}

function setLoading(loading, phase = 'scanning') {
  els.loading.hidden = !loading;
  if (loading) {
    els.grid.replaceChildren();
    els.empty.hidden = true;
    setScanPhase(phase);
  } else if (!['failed', 'cancelled'].includes(state.scanPhase)) {
    state.scanPhase = 'complete';
  }
}
function updateScanStats() {
  if (!els.scanStats) return;
  const stats = state.scanStats || {};
  const values = {
    discovered: Number(stats.discovered) || state.images.length,
    skipped: Number(stats.skipped) || 0,
    dimensions: Number(stats.dimensionsChecked) || 0,
    failed: Number(stats.dimensionsFailed) || 0,
    partial: stats.partial ? ' · ' + t('scanPartial') : ''
  };
  els.scanStats.textContent = t('scanStats', values);
}

function updateScanStatus() {
  els.scanStatus.textContent = `${t('imageCount', { count: state.images.length })}${state.duplicateCount ? ` · ${t('duplicates', { count: state.duplicateCount })}` : ''}`;
}
function fileName(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image'); } catch { return 'image'; } }
function getDomainLetter(url) { try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 1).toUpperCase() || '◎'; } catch { return '◎'; } }
function showToast(message) { clearTimeout(state.toastTimer); els.toast.textContent = message; els.toast.classList.add('show'); state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200); }

// Keep the size slider label in KB while preserving the existing px labels.
function displayLimit(axis, value, side) {
  const maxInput = axis === 'size' ? els.maxSize : els['max' + capitalize(axis)];
  const max = Number(maxInput?.max) || 5000;
  const unit = axis === 'size' ? 'KB' : 'px';
  return value === 0 && side === 'min' ? t('unlimited') : value === max && side === 'max' ? t('unlimited') : String(value) + unit;
}
