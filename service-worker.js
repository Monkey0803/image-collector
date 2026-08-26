importScripts('library.js');

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/bmp': '.bmp', 'image/x-icon': '.ico'
};
const FORMAT_EXTENSIONS = {
  jpeg: '.jpg', png: '.png', gif: '.gif', webp: '.webp', avif: '.avif', svg: '.svg'
};
const activeJobs = new Map();
const downloadQueue = [];
let queueRunning = false;
const metadataCache = new Map();
const METADATA_CACHE_TTL = 5 * 60 * 1000;

const WORKER_TRANSLATIONS = {
  zh: {
    scan: '扫描当前页面', downloadImage: '下载当前图片', favoriteImage: '收藏当前图片',
    queued: '等待下载队列', queueAhead: '已加入下载队列，前方 {count} 个任务', queueStarting: '正在启动下载任务',
    prepareDownload: '准备提交下载任务', cancelTask: '下载任务已取消', submitting: '正在提交 {current}/{total}：{name}', processed: '已处理 {count}/{total} 张图片', submitted: '下载任务已提交，成功 {count} 张', noStart: '没有图片能够开始下载',
    prepareRead: '准备读取图片', reading: '正在读取 {current}/{total}：{name}', readCount: '已读取 {count}/{total} 张图片', noZipImages: '没有可加入 ZIP 的图片', cannotRead: '图片无法读取，可能受跨域或防盗链限制', compressing: '正在压缩 {count} 张图片', zipSubmitted: 'ZIP 已提交下载，共 {count} 张图片', zipFailed: 'ZIP 下载失败',
    taskComplete: '任务完成', taskFailed: '下载任务失败', paused: '任务已暂停，当前项目完成后等待继续', resumed: '任务继续执行',
    downloadFailed: '下载失败', readFailed: '读取失败', queueFailed: '下载任务失败',
    loginRequired: '需要登录后才能访问', forbidden: '服务器拒绝访问，可能存在防盗链', notFound: '图片不存在或链接已失效', tooMany: '请求过于频繁，请稍后重试', serverError: '图片服务器暂时不可用', networkError: '网络请求失败或被跨域策略阻止'
  },
  en: {
    scan: 'Scan current page', downloadImage: 'Download this image', favoriteImage: 'Favorite this image',
    queued: 'Download queue', queueAhead: 'Added to queue; {count} task(s) ahead', queueStarting: 'Starting download task',
    prepareDownload: 'Preparing download tasks', cancelTask: 'Download task cancelled', submitting: 'Submitting {current}/{total}: {name}', processed: 'Processed {count}/{total} image(s)', submitted: 'Download tasks submitted; {count} succeeded', noStart: 'No image could be started',
    prepareRead: 'Preparing to read images', reading: 'Reading {current}/{total}: {name}', readCount: 'Read {count}/{total} image(s)', noZipImages: 'No images could be added to the ZIP', cannotRead: 'Images could not be read; cross-origin or hotlink protection may be blocking access', compressing: 'Compressing {count} image(s)', zipSubmitted: 'ZIP download submitted with {count} image(s)', zipFailed: 'ZIP download failed',
    taskComplete: 'Task complete', taskFailed: 'Download task failed', paused: 'Task paused; it will continue after the current item', resumed: 'Task resumed',
    downloadFailed: 'Download failed', readFailed: 'Read failed', queueFailed: 'Download task failed',
    loginRequired: 'Sign-in is required to access this image', forbidden: 'The server rejected the request; hotlink protection may be enabled', notFound: 'The image does not exist or the link has expired', tooMany: 'Too many requests; try again later', serverError: 'The image server is temporarily unavailable', networkError: 'The network request failed or was blocked by cross-origin policy'
  }
};

function normalizeLanguage(language) { return language === 'en' ? 'en' : 'zh'; }
function workerText(language, key, values = {}) {
  const text = WORKER_TRANSLATIONS[normalizeLanguage(language)][key] || WORKER_TRANSLATIONS.zh[key] || key;
  return text.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? ''));
}
async function getLanguage() {
  try {
    const saved = await chrome.storage.local.get({ language: null });
    if (saved.language === 'en' || saved.language === 'zh') return saved.language;
    return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch { return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'; }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'downloadImages') {
    const jobId = message.jobId || createJobId();
    const images = Array.isArray(message.images) ? message.images : [];
    enqueueJob(jobId, images, () => runDownloadJob('images', images, Boolean(message.saveAs), jobId, message), 'images', message.language).then((result) => sendResponse(result));
    return true;
  }
  if (message.type === 'downloadZip') {
    const jobId = message.jobId || createJobId();
    const images = Array.isArray(message.images) ? message.images : [];
    enqueueJob(jobId, images, () => runDownloadJob('zip', images, Boolean(message.saveAs), jobId, message), 'zip', message.language).then((result) => sendResponse(result));
    return true;
  }
  if (message.type === 'inspectImages') {
    inspectImages(message.images || []).then((result) => sendResponse(result));
    return true;
  }
  if (message.type === 'cancelDownload') {
    cancelDownload(message.jobId);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'pauseDownload') {
    pauseDownload(message.jobId);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'resumeDownload') {
    resumeDownload(message.jobId);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'languageChanged') {
    createContextMenus();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

const CONTEXT_MENU_IDS = {
  root: 'image-collector-root',
  scan: 'image-collector-scan-page',
  download: 'image-collector-download-image',
  favorite: 'image-collector-favorite-image'
};

async function configureSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // Older Chrome versions may not support the action-to-side-panel behavior.
  }
}

chrome.runtime.onInstalled.addListener(() => { createContextMenus(); configureSidePanel(); });
chrome.runtime.onStartup.addListener(() => { createContextMenus(); configureSidePanel(); });
void configureSidePanel();
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_IDS.scan) {
    openCollectorPanel(tab).catch(() => {});
    return;
  }
  if (info.menuItemId === CONTEXT_MENU_IDS.download) {
    handleContextDownload(info, tab).catch(() => {});
    return;
  }
  if (info.menuItemId === CONTEXT_MENU_IDS.favorite) handleContextFavorite(info, tab).catch(() => {});
});

async function createContextMenus() {
  const language = await getLanguage();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: CONTEXT_MENU_IDS.root, title: 'Image Collector', contexts: ['page', 'image'] });
    chrome.contextMenus.create({ parentId: CONTEXT_MENU_IDS.root, id: CONTEXT_MENU_IDS.scan, title: workerText(language, 'scan'), contexts: ['page'] });
    chrome.contextMenus.create({ parentId: CONTEXT_MENU_IDS.root, id: CONTEXT_MENU_IDS.download, title: workerText(language, 'downloadImage'), contexts: ['image'] });
    chrome.contextMenus.create({ parentId: CONTEXT_MENU_IDS.root, id: CONTEXT_MENU_IDS.favorite, title: workerText(language, 'favoriteImage'), contexts: ['image'] });
  });
}

async function openCollectorPanel(tab) {
  if (chrome.sidePanel?.open && tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
    return;
  }
  if (chrome.action?.openPopup) await chrome.action.openPopup();
}

function contextImage(info, tab) {
  const url = info.srcUrl || info.linkUrl || '';
  if (!url) return null;
  return {
    url,
    displayUrl: url,
    source: 'CONTEXT',
    frameUrl: tab?.url || '',
    format: formatFromUrl(url)
  };
}

async function handleContextDownload(info, tab) {
  const image = contextImage(info, tab);
  if (!image) return;
  const settings = await chrome.storage.local.get({ saveAs: true, zipLayout: 'flat', filenameTemplate: '{name}', dateFolder: false, language: null });
  settings.language = settings.language || await getLanguage();
  const jobId = createJobId();
  enqueueJob(jobId, [image], () => runDownloadJob('images', [image], Boolean(settings.saveAs), jobId, settings), 'images', settings.language);
}

async function handleContextFavorite(info, tab) {
  const image = contextImage(info, tab);
  if (!image) return;
  try {
    await ImageCollectorDB.upsertImages([image]);
    await ImageCollectorDB.setFavorite(image.url, true);
  } catch {
    // The context action should not interrupt the page when local storage is unavailable.
  }
}

async function runDownloadJob(kind, images, saveAs, jobId, settings) {
  const language = normalizeLanguage(settings.language || await getLanguage());
  const result = kind === 'zip'
    ? await downloadZip(images, saveAs, jobId, settings)
    : await downloadImages(images, saveAs, jobId, settings);
  await saveDownloadRecord(kind, images, result, jobId, language);
  return result;
}

async function saveDownloadRecord(kind, images, result, jobId = '', language = 'zh') {
  try {
    const record = {
      id: jobId || undefined,
      jobId,
      kind,
      status: result.cancelled ? 'cancelled' : result.ok && result.failed?.length ? 'partial' : result.ok ? 'started' : 'failed',
      urls: images.map((image) => image.url),
      count: images.length,
      started: result.started || 0,
      failed: Array.isArray(result.failed) ? result.failed.length : 0,
      error: result.error || '',
      filename: kind === 'zip' ? (result.filename || 'image_' + dateStamp() + '.zip') : '',
      phase: result.cancelled ? 'cancelled' : result.ok ? 'complete' : 'failed',
      percent: 100,
      detail: result.error || (result.cancelled ? workerText(language, 'cancelTask') : workerText(language, 'taskComplete')),
      paused: false,
      completedAt: Date.now()
    };
    const updated = jobId ? await ImageCollectorDB.updateDownload(jobId, record) : null;
    if (!updated) await ImageCollectorDB.saveDownload(record);
  } catch {
    // Downloading remains usable even if IndexedDB is unavailable or full.
  }
}

function imageCandidates(image) {
  return [...new Set([image?.url, image?.originalUrl, image?.displayUrl, image?.sourceUrl]
    .map((url) => String(url || '').trim())
    .filter(Boolean))];
}

async function downloadFileWithFallback(image, saveAs, settings) {
  let lastError = null;
  for (const url of imageCandidates(image)) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const downloadId = await chrome.downloads.download({
          url,
          filename: normalizeName(image, '', settings),
          saveAs,
          conflictAction: 'uniquify'
        });
        return { downloadId, url };
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
  throw lastError || new Error('No image URL available');
}

async function readImageWithFallback(image, job) {
  let lastError = null;
  for (const url of imageCandidates(image)) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      job.controllers.add(controller);
      try {
        const response = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return {
          url,
          contentType: response.headers.get('content-type') || '',
          data: new Uint8Array(await response.arrayBuffer())
        };
      } catch (error) {
        lastError = error;
      } finally {
        job.controllers.delete(controller);
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError || new Error('No image URL available');
}

async function downloadImages(images, saveAs, jobId, settings = {}) {
  const language = normalizeLanguage(settings.language || await getLanguage());
  const failed = [];
  let started = 0;
  const total = images.length;
  const job = getJob(jobId);
  await waitForResume(job);
  sendProgress(jobId, { phase: 'starting', completed: 0, total, failed: 0, percent: 0, detail: workerText(language, 'prepareDownload') });
  for (const [index, image] of images.entries()) {
    await waitForResume(job);
    if (job.cancelled) return finishDownloadJob(jobId, { ok: started > 0, started, failed, cancelled: true, error: workerText(language, 'cancelTask') }, total, failed.length, language);
    sendProgress(jobId, {
      phase: 'downloading', completed: index, total, failed: failed.length, percent: progressPercent(index, total),
      detail: workerText(language, 'submitting', { current: index + 1, total, name: normalizeName(image, '', settings) })
    });
    try {
      const { downloadId } = await downloadFileWithFallback(image, saveAs, settings);
      job.downloadIds.add(downloadId);
      if (job.cancelled) {
        await chrome.downloads.cancel(downloadId).catch(() => {});
        return finishDownloadJob(jobId, { ok: started > 0, started, failed, cancelled: true, error: workerText(language, 'cancelTask') }, total, failed.length, language);
      }
      started += 1;
    } catch (error) {
      if (job.cancelled) return finishDownloadJob(jobId, { ok: started > 0, started, failed, cancelled: true, error: workerText(language, 'cancelTask') }, total, failed.length, language);
      failed.push({ url: image.url, error: readableError(error, workerText(language, 'downloadFailed'), language), stage: 'download' });
    }
    const completed = started + failed.length;
    sendProgress(jobId, {
      phase: 'downloading', completed, total, failed: failed.length, percent: progressPercent(completed, total),
      detail: workerText(language, 'processed', { count: completed, total })
    });
  }
  sendProgress(jobId, { phase: 'complete', completed: total, total, failed: failed.length, percent: 100, detail: workerText(language, 'submitted', { count: started }) });
  return finishJob(jobId, { ok: started > 0, started, failed, error: started ? '' : workerText(language, 'noStart') });
}

async function downloadZip(images, saveAs, jobId, settings = {}) {
  const language = normalizeLanguage(settings.language || await getLanguage());
  const entries = [];
  const failed = [];
  const usedNames = new Set();
  const total = images.length;
  const job = getJob(jobId);
  await waitForResume(job);
  sendProgress(jobId, { phase: 'starting', completed: 0, total, failed: 0, percent: 0, detail: workerText(language, 'prepareRead') });
  for (const [index, image] of images.entries()) {
    await waitForResume(job);
    if (job.cancelled) return finishDownloadJob(jobId, { ok: false, failed, cancelled: true, error: workerText(language, 'cancelTask') }, total, failed.length, language);
    sendProgress(jobId, {
      phase: 'reading', completed: index, total, failed: failed.length, percent: progressPercent(index, total),
      detail: workerText(language, 'reading', { current: index + 1, total, name: normalizeName(image, '', settings) })
    });
    try {
      const { contentType, data } = await readImageWithFallback(image, job);
      const filename = normalizeName(image, contentType, { ...settings, dateFolder: false });
      const name = uniqueName(zipPath(image, filename, settings.zipLayout || 'flat', settings, contentType), usedNames);
      entries.push({ name, data });
    } catch (error) {
      if (!job.cancelled) failed.push({ url: image.url, error: readableError(error, workerText(language, 'readFailed'), language), stage: 'read' });
    }
    const completed = index + 1;
    sendProgress(jobId, {
      phase: 'reading', completed, total, failed: failed.length, percent: progressPercent(completed, total),
      detail: workerText(language, 'readCount', { count: completed, total })
    });
  }
  if (job.cancelled) return finishDownloadJob(jobId, { ok: false, failed, cancelled: true, error: workerText(language, 'cancelTask') }, total, failed.length, language);
  if (!entries.length) {
    sendProgress(jobId, { phase: 'failed', completed: total, total, failed: failed.length, percent: 100, detail: workerText(language, 'noZipImages') });
    return finishJob(jobId, { ok: false, failed, error: workerText(language, 'cannotRead') });
  }
  if (job.cancelled) return finishDownloadJob(jobId, { ok: false, failed, cancelled: true, error: workerText(language, 'cancelTask') }, total, failed.length, language);
  try {
    sendProgress(jobId, { phase: 'compressing', completed: total, total, failed: failed.length, percent: 100, detail: workerText(language, 'compressing', { count: entries.length }) });
    const zip = makeZip(entries);
    const dataUrl = `data:application/zip;base64,${toBase64(zip)}`;
    const filename = zipDownloadFilename(settings);
    const downloadId = await chrome.downloads.download({ url: dataUrl, filename, saveAs, conflictAction: 'uniquify' });
    job.downloadIds.add(downloadId);
    sendProgress(jobId, { phase: 'complete', completed: total, total, failed: failed.length, percent: 100, detail: workerText(language, 'zipSubmitted', { count: entries.length }) });
    return finishJob(jobId, { ok: true, started: 1, failed, filename });
  } catch (error) {
    const reason = readableError(error, workerText(language, 'zipFailed'), language);
    sendProgress(jobId, { phase: 'failed', completed: total, total, failed: failed.length, percent: 100, detail: reason });
    return finishJob(jobId, { ok: false, failed, error: reason });
  }
}

async function inspectImages(images) {
  const source = [...new Map(images.slice(0, 300).filter((image) => image?.url).map((image) => [image.url, image])).values()];
  const inspectOne = async (image) => {
    const cached = metadataCache.get(image.url);
    if (cached && Date.now() - cached.timestamp < METADATA_CACHE_TTL) return cached.item;
    try {
      const response = await fetch(image.url, { method: 'HEAD', credentials: 'omit', redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get('content-length')) || 0;
      const item = { url: image.url, size: contentLength, mime: (response.headers.get('content-type') || '').split(';')[0] };
      metadataCache.set(image.url, { item, timestamp: Date.now() });
      return item;
    } catch {
      const item = { url: image.url, size: 0, mime: '' };
      metadataCache.set(image.url, { item, timestamp: Date.now() });
      return item;
    }
  };
  const items = [];
  for (let index = 0; index < source.length; index += 8) items.push(...await Promise.all(source.slice(index, index + 8).map(inspectOne)));
  return { ok: true, items };
}

function beginJob(jobId, language = 'zh') {
  const job = { cancelled: false, paused: false, language: normalizeLanguage(language), resumeResolvers: new Set(), downloadIds: new Set(), controllers: new Set() };
  if (jobId) activeJobs.set(jobId, job);
  return job;
}

function getJob(jobId) {
  return (jobId && activeJobs.get(jobId)) || beginJob(jobId);
}

function createJobId() {
  const suffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${suffix}`;
}

function enqueueJob(jobId, images, task, kind = 'images', language = 'zh') {
  const normalizedLanguage = normalizeLanguage(language);
  const job = beginJob(jobId, normalizedLanguage);
  const item = { jobId, images, task, kind, language: normalizedLanguage, resolve: null };
  const position = downloadQueue.length + (queueRunning ? 1 : 0);
  job.queueItem = item;
  ImageCollectorDB.saveDownload({
    id: jobId, jobId, kind, status: 'queued', urls: images.map((image) => image.url), count: images.length,
    phase: 'queued', percent: 0, detail: workerText(normalizedLanguage, 'queued'), paused: false
  }).catch(() => {}).finally(() => processQueue());
  sendProgress(jobId, {
    phase: 'queued', completed: 0, total: images.length, failed: 0, percent: 0,
    detail: position ? workerText(normalizedLanguage, 'queueAhead', { count: position }) : workerText(normalizedLanguage, 'queueStarting')
  });
  const promise = new Promise((resolve) => { item.resolve = resolve; });
  downloadQueue.push(item);
  return promise;
}

async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (downloadQueue.length) {
      const item = downloadQueue.shift();
      const job = activeJobs.get(item.jobId);
      if (!job || job.cancelled) {
        const result = finishDownloadJob(item.jobId, {
          ok: false, failed: [], cancelled: true, error: workerText(item.language, 'cancelTask')
        }, item.images.length, 0, item.language);
        saveDownloadRecord(item.kind, item.images, result, item.jobId, item.language);
        item.resolve(result);
        continue;
      }
      job.queueItem = null;
      updateQueueProgress();
      try {
        item.resolve(await item.task());
      } catch (error) {
        const result = finishJob(item.jobId, {
          ok: false, failed: [], error: readableError(error, workerText(item.language, 'queueFailed'), item.language)
        });
        await saveDownloadRecord(item.kind, item.images, result, item.jobId, item.language);
        item.resolve(result);
      }
    }
  } finally {
    queueRunning = false;
    updateQueueProgress();
    if (downloadQueue.length) processQueue();
  }
}

function updateQueueProgress() {
  downloadQueue.forEach((item, index) => {
    const job = activeJobs.get(item.jobId);
    if (!job || job.cancelled) return;
    const ahead = index + (queueRunning ? 1 : 0);
    sendProgress(item.jobId, {
      phase: 'queued', completed: 0, total: item.images.length, failed: 0, percent: 0,
      detail: ahead ? workerText(job.language, 'queueAhead', { count: ahead }) : workerText(job.language, 'queueStarting')
    });
  });
}

function cancelDownload(jobId) {
  const job = activeJobs.get(jobId);
  if (!job) return;
  job.cancelled = true;
  if (job.queueItem) {
    const index = downloadQueue.indexOf(job.queueItem);
    if (index >= 0) downloadQueue.splice(index, 1);
    const item = job.queueItem;
    job.queueItem = null;
    const result = finishDownloadJob(jobId, {
      ok: false, failed: [], cancelled: true, error: workerText(job.language, 'cancelTask')
    }, item.images.length, 0, job.language);
    saveDownloadRecord(item.kind, item.images, result, item.jobId, job.language);
    item.resolve(result);
    updateQueueProgress();
    processQueue();
    return;
  }
  job.controllers.forEach((controller) => controller.abort());
  job.downloadIds.forEach((downloadId) => chrome.downloads.cancel(downloadId).catch(() => {}));
  job.resumeResolvers.forEach((resolve) => resolve());
  job.resumeResolvers.clear();
  sendProgress(jobId, { phase: 'cancelled', percent: 100, detail: workerText(job.language, 'cancelTask') });
}

function pauseDownload(jobId) {
  const job = activeJobs.get(jobId);
  if (!job || job.cancelled) return;
  job.paused = true;
  sendProgress(jobId, { phase: 'paused', detail: workerText(job.language, 'paused') });
}

function resumeDownload(jobId) {
  const job = activeJobs.get(jobId);
  if (!job || job.cancelled) return;
  job.paused = false;
  job.resumeResolvers.forEach((resolve) => resolve());
  job.resumeResolvers.clear();
  sendProgress(jobId, { phase: 'resumed', detail: workerText(job.language, 'resumed') });
}

function waitForResume(job) {
  if (!job.paused || job.cancelled) return Promise.resolve();
  return new Promise((resolve) => job.resumeResolvers.add(resolve));
}

function finishJob(jobId, result) {
  if (jobId) activeJobs.delete(jobId);
  return result;
}

function finishDownloadJob(jobId, result, total, failed, language = 'zh') {
  sendProgress(jobId, { phase: 'cancelled', completed: total, total, failed, percent: 100, detail: workerText(language, 'cancelTask') });
  return finishJob(jobId, result);
}

function progressPercent(completed, total) { return total ? Math.round((completed / total) * 100) : 0; }

function sendProgress(jobId, progress) {
  if (!jobId) return;
  chrome.runtime.sendMessage({ type: 'downloadProgress', jobId, ...progress }).catch(() => {});
  const job = activeJobs.get(jobId);
  if (job) {
    const phase = progress.phase || '';
    const status = phase === 'queued' ? 'queued' : phase === 'paused' ? 'paused' : phase === 'complete' ? 'completed' : phase === 'failed' ? 'failed' : phase === 'cancelled' ? 'cancelled' : 'running';
    ImageCollectorDB.updateDownload(jobId, {
      status, phase, percent: Number(progress.percent) || 0, detail: progress.detail || '', paused: status === 'paused',
      completed: Number(progress.completed) || 0, failed: Number(progress.failed) || 0
    }).catch(() => {});
  }
}

function normalizeName(image, contentType = '', settings = {}) {
  const original = safeSegment(image.name || fileName(image.url) || 'image');
  const extensionMatch = original.match(/^(.*?)(\.[a-z0-9]{2,8})$/i);
  const filename = extensionMatch ? original : `${original}${extensionFor(image, contentType)}`;
  const name = extensionMatch ? extensionMatch[1] || 'image' : original;
  const domain = hostnameFor(image.url);
  const format = formatFor(image, contentType);
  const values = { name, filename, domain, format, width: image.width || 0, height: image.height || 0, date: dateStamp() };
  const template = typeof settings.filenameTemplate === 'string' && settings.filenameTemplate.trim()
    ? settings.filenameTemplate.trim()
    : '{name}';
  let output = template.replace(/\{([^{}]+)\}/g, (_match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : ''
  ));
  output = String(output).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  if (!output) output = name;
  if (!/\.[a-z0-9]{2,8}$/i.test(output)) output += extensionFor(image, contentType);
  return settings.dateFolder ? `${dateStamp()}/${output}` : output;
}

function zipPath(image, name, layout, settings = {}, contentType = '') {
  let path = name;
  const hostname = hostnameFor(image.url);
  const format = formatFor(image, contentType);
  if (layout === 'domain') path = `${safeSegment(hostname)}/${name}`;
  if (layout === 'format') path = `${safeSegment(format)}/${name}`;
  if (layout === 'domain-format') path = `${safeSegment(hostname)}/${safeSegment(format)}/${name}`;
  return settings.dateFolder ? `${dateStamp()}/${path}` : path;
}

function safeSegment(value) { return String(value ?? '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'other'; }

function formatFromUrl(url) {
  try {
    const parsed = new URL(url);
    const queryHint = parsed.searchParams.get('format') || parsed.searchParams.get('fm') || '';
    const extension = (queryHint || parsed.pathname.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (extension === 'jpg' || extension === 'jpeg') return 'jpeg';
    if (['png', 'gif', 'webp', 'avif', 'svg'].includes(extension)) return extension;
  } catch { /* Keep the fallback format. */ }
  return 'other';
}

function hostnameFor(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') || 'site'; } catch { return 'site'; }
}

function formatFor(image, contentType = '') {
  const mime = String(contentType || image.mime || '').split(';')[0].trim().toLowerCase();
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/svg+xml') return 'svg';
  if (mime.startsWith('image/')) return mime.slice(6) || 'other';
  return String(image.format || 'other').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'other';
}

function extensionFor(image, contentType = '') {
  const mime = String(contentType || image.mime || '').split(';')[0].trim().toLowerCase();
  return MIME_EXTENSIONS[mime] || FORMAT_EXTENSIONS[formatFor(image, contentType)] || '.jpg';
}

function readableError(error, fallback, language = 'zh') {
  if (error?.name === 'AbortError') return workerText(language, 'cancelTask');
  const message = String(error?.message || error || '').trim();
  if (/HTTP\s+401\b/i.test(message)) return workerText(language, 'loginRequired');
  if (/HTTP\s+403\b/i.test(message)) return workerText(language, 'forbidden');
  if (/HTTP\s+404\b/i.test(message)) return workerText(language, 'notFound');
  if (/HTTP\s+429\b/i.test(message)) return workerText(language, 'tooMany');
  if (/HTTP\s+5\d\d\b/i.test(message)) return workerText(language, 'serverError');
  if (/Failed to fetch|NetworkError|Network request failed|Load failed|跨域/i.test(message)) return workerText(language, 'networkError');
  return message || fallback;
}

function uniqueName(name, usedNames) {
  if (!usedNames.has(name)) { usedNames.add(name); return name; }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';
  let suffix = 2;
  while (usedNames.has(`${stem}-${suffix}${extension}`)) suffix += 1;
  const unique = `${stem}-${suffix}${extension}`;
  usedNames.add(unique);
  return unique;
}

function fileName(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image'); } catch { return 'image'; } }
function zipDownloadFilename(settings = {}) {
  const stamp = dateStamp();
  const filename = 'image_' + stamp + '.zip';
  return settings.dateFolder ? 'image_' + stamp + '/' + filename : filename;
}

function dateStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
}

function makeZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [], centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint16(8, 0, true); view.setUint16(10, 0, true); view.setUint16(12, 0, true);
    view.setUint32(14, crc, true); view.setUint32(18, entry.data.length, true); view.setUint32(22, entry.data.length, true);
    view.setUint16(26, name.length, true); view.setUint16(28, 0, true);
    local.set(name, 30); local.set(entry.data, 30 + name.length);
    localParts.push(local);
    const central = new Uint8Array(46 + name.length); const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x800, true); centralView.setUint16(10, 0, true); centralView.setUint16(12, 0, true); centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true); centralView.setUint32(20, entry.data.length, true); centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true); centralView.setUint16(30, 0, true); centralView.setUint16(32, 0, true); centralView.setUint16(34, 0, true); centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true); centralView.setUint32(42, offset, true); central.set(name, 46); centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, entries.length, true); endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true); endView.setUint16(20, 0, true);
  const output = new Uint8Array(offset + centralSize + end.length); let cursor = 0;
  for (const part of localParts) { output.set(part, cursor); cursor += part.length; }
  for (const part of centralParts) { output.set(part, cursor); cursor += part.length; }
  output.set(end, cursor); return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBase64(bytes) {
  let binary = ''; const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}
