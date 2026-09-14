(function createImageCollectorDatabase(global) {
  'use strict';

  const DB_NAME = 'image-collector-library';
  const DB_VERSION = 5;
  const IMAGE_STORE = 'images';
  const CACHE_STORE = 'imageCache';
  const SCAN_STORE = 'scans';
  const DOWNLOAD_STORE = 'downloads';
  const COLLECTION_STORE = 'collections';
  // Failures from the data layer carry a code and are tagged so the UI can show a
  // localised message instead of these Chinese developer diagnostics.
  function dataError(code, message, cause) {
    const error = new Error(message);
    error.isDataError = true;
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  const cacheWriteState = { failures: 0, lastReason: '', lastAt: 0 };

  function noteCacheWriteFailure(reason) {
    cacheWriteState.failures += 1;
    cacheWriteState.lastReason = reason;
    cacheWriteState.lastAt = Date.now();
  }

  function cacheFailureReason(error) {
    const text = String(error?.name || '') + ' ' + String(error?.message || '');
    return /quota/i.test(text) ? 'quota' : 'write-failed';
  }

  function getCacheWriteState() {
    return { ...cacheWriteState };
  }
  let databasePromise;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          const store = db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
          store.createIndex('byUpdatedAt', 'updatedAt');
          store.createIndex('byDomain', 'domain');
          store.createIndex('byContentHash', 'contentHash');
          store.createIndex('byPerceptualHash', 'perceptualHash');
        } else {
          const store = request.transaction.objectStore(IMAGE_STORE);
          if (!store.indexNames.contains('byContentHash')) store.createIndex('byContentHash', 'contentHash');
          if (!store.indexNames.contains('byPerceptualHash')) store.createIndex('byPerceptualHash', 'perceptualHash');
          // `favorite` is a boolean and booleans are not valid IndexedDB keys,
          // so this index could never be queried. Drop it from existing databases.
          if (store.indexNames.contains('byFavorite')) store.deleteIndex('byFavorite');
        }
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          const store = db.createObjectStore(CACHE_STORE, { keyPath: 'id' });
          store.createIndex('byUpdatedAt', 'updatedAt');
          store.createIndex('bySize', 'size');
        }
        if (!db.objectStoreNames.contains(SCAN_STORE)) {
          const store = db.createObjectStore(SCAN_STORE, { keyPath: 'id' });
          store.createIndex('byCreatedAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(DOWNLOAD_STORE)) {
          const store = db.createObjectStore(DOWNLOAD_STORE, { keyPath: 'id' });
          store.createIndex('byCreatedAt', 'createdAt');
          store.createIndex('byStatus', 'status');
        }
        if (!db.objectStoreNames.contains(COLLECTION_STORE)) {
          const store = db.createObjectStore(COLLECTION_STORE, { keyPath: 'id' });
          store.createIndex('byUpdatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => {
        databasePromise = null;
        reject(dataError('open', '无法打开本地素材库', request.error));
      };
      request.onblocked = () => {
        databasePromise = null;
        reject(dataError('blocked', '本地素材库正在被其他页面占用'));
      };
    });
    return databasePromise;
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(dataError('read', '本地数据读取失败', request.error));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(dataError('write', '本地数据写入失败', transaction.error));
      transaction.onabort = () => reject(dataError('abort', '本地数据事务已中止', transaction.error));
    });
  }

  function imageId(url) { return String(url || '').trim(); }

  function hostnameFor(url) {
    try { return new URL(url).hostname.replace(/^www\./, '') || 'site'; } catch { return 'site'; }
  }

  function cleanTags(tags) {
    return [...new Set((Array.isArray(tags) ? tags : [])
      .map((tag) => String(tag || '').trim().replace(/\s+/g, ' '))
      .filter(Boolean))].slice(0, 30);
  }

  function normalizeImage(image) {
    const url = imageId(image?.url);
    if (!url) return null;
    const pageUrls = [...new Set((Array.isArray(image.pageUrls) ? image.pageUrls : [image.pageUrl || image.frameUrl]).map((value) => String(value || '').trim()).filter(Boolean))];
    const pageTitles = [...new Set((Array.isArray(image.pageTitles) ? image.pageTitles : [image.pageTitle]).map((value) => String(value || '').trim()).filter(Boolean))];
    const tabIds = [...new Set((Array.isArray(image.tabIds) ? image.tabIds : [image.tabId]).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
    return {
      id: url,
      url,
      displayUrl: image.displayUrl || url,
      width: Number(image.width) || 0,
      height: Number(image.height) || 0,
      format: image.format || 'other',
      mime: image.mime || '',
      size: Number(image.size) || 0,
      source: image.source || '',
      frameUrl: image.frameUrl || '',
      alt: image.alt || '',
      pageUrl: pageUrls[0] || '',
      pageTitle: pageTitles[0] || '',
      tabId: tabIds[0] || 0,
      pageIndex: Number.isInteger(Number(image.pageIndex)) ? Number(image.pageIndex) : 0,
      pageUrls,
      pageTitles,
      tabIds,
      original: Boolean(image.original),
      domain: hostnameFor(url),
      favorite: Boolean(image.favorite),
      tags: cleanTags(image.tags),
      collectionIds: cleanCollectionIds(image.collectionIds),
      candidateUrls: [...new Set((Array.isArray(image.candidateUrls) ? image.candidateUrls : [image.originalUrl, image.displayUrl, image.url]).map(imageId).filter(Boolean))].slice(0, 12),
      sourceElement: String(image.sourceElement || '').slice(0, 500),
      iframe: Boolean(image.iframe),
      cacheState: ['cached', 'uncached', 'unknown'].includes(image.cacheState) ? image.cacheState : 'unknown',
      contentHash: String(image.contentHash || '').trim().slice(0, 128),
      perceptualHash: String(image.perceptualHash || '').trim().slice(0, 64),
      valid: image.valid !== false,
      invalidReason: String(image.invalidReason || '').slice(0, 240),
      updatedAt: Date.now()
    };
  }

  function mergeImageRecord(image, previous) {
    return {
      ...image,
      width: image.width || previous?.width || 0,
      height: image.height || previous?.height || 0,
      mime: image.mime || previous?.mime || '',
      size: image.size || previous?.size || 0,
      displayUrl: image.displayUrl || previous?.displayUrl || image.url,
      source: image.source || previous?.source || '',
      frameUrl: image.frameUrl || previous?.frameUrl || '',
      alt: image.alt || previous?.alt || '',
      pageUrl: image.pageUrl || previous?.pageUrl || '',
      pageTitle: image.pageTitle || previous?.pageTitle || '',
      tabId: image.tabId || previous?.tabId || 0,
      pageIndex: Number.isInteger(Number(image.pageIndex)) ? Number(image.pageIndex) : (previous?.pageIndex || 0),
      pageUrls: [...new Set([...(image.pageUrls || []), ...(previous?.pageUrls || []), image.pageUrl || '', previous?.pageUrl || ''].filter(Boolean))],
      pageTitles: [...new Set([...(image.pageTitles || []), ...(previous?.pageTitles || []), image.pageTitle || '', previous?.pageTitle || ''].filter(Boolean))],
      tabIds: [...new Set([...(image.tabIds || []), ...(previous?.tabIds || []), image.tabId || 0, previous?.tabId || 0].filter((value) => Number.isInteger(Number(value)) && Number(value) > 0).map(Number))],
      original: image.original || Boolean(previous?.original),
      favorite: previous ? Boolean(previous.favorite) : image.favorite,
      tags: previous ? cleanTags(previous.tags) : image.tags,
      collectionIds: previous ? cleanCollectionIds(previous.collectionIds) : image.collectionIds,
      candidateUrls: [...new Set([...(image.candidateUrls || []), ...(previous?.candidateUrls || []), image.url].filter(Boolean))].slice(0, 12),
      sourceElement: image.sourceElement || previous?.sourceElement || '',
      iframe: image.iframe || Boolean(previous?.iframe),
      cacheState: image.cacheState !== 'unknown' ? image.cacheState : (previous?.cacheState || 'unknown'),
      contentHash: image.contentHash || previous?.contentHash || '',
      perceptualHash: image.perceptualHash || previous?.perceptualHash || '',
      valid: image.valid === false ? false : previous?.valid !== false,
      invalidReason: image.invalidReason || previous?.invalidReason || '',
      createdAt: previous?.createdAt || Date.now()
    };
  }

  function applyImageUpdates(previous, updates) {
    const changes = updates || {};
    const record = { ...previous, ...changes, id: previous.id, url: previous.url, updatedAt: Date.now() };
    record.favorite = changes.favorite === undefined ? Boolean(previous.favorite) : Boolean(changes.favorite);
    record.tags = changes.tags === undefined ? cleanTags(previous.tags) : cleanTags(changes.tags);
    record.collectionIds = changes.collectionIds === undefined ? cleanCollectionIds(previous.collectionIds) : cleanCollectionIds(changes.collectionIds);
    return record;
  }

  async function getImage(url) {
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readonly');
    return requestValue(transaction.objectStore(IMAGE_STORE).get(imageId(url)));
  }

  async function getCachedImage(url) {
    const db = await openDatabase();
    const transaction = db.transaction(CACHE_STORE, 'readonly');
    const record = await requestValue(transaction.objectStore(CACHE_STORE).get(imageId(url)));
    if (!record?.blob) return null;
    // Refreshing recency is best-effort; a stale cache must never block preview.
    touchCachedImage(record.id).catch(() => {});
    return record;
  }

  async function touchCachedImage(url) {
    const db = await openDatabase();
    const readTransaction = db.transaction(CACHE_STORE, 'readonly');
    const record = await requestValue(readTransaction.objectStore(CACHE_STORE).get(imageId(url)));
    await transactionDone(readTransaction);
    if (!record) return null;
    record.updatedAt = Date.now();
    const transaction = db.transaction(CACHE_STORE, 'readwrite');
    transaction.objectStore(CACHE_STORE).put(record);
    await transactionDone(transaction);
    return record;
  }

  const MAX_CACHE_ENTRY_BYTES = 20 * 1024 * 1024;
  const MAX_CACHE_BYTES = 120 * 1024 * 1024;

  async function putCachedImage(url, blob, metadata = {}) {
    const id = imageId(url);
    if (!id || !blob || typeof blob.size !== 'number' || blob.size <= 0) {
      noteCacheWriteFailure('invalid');
      return false;
    }
    if (blob.size > MAX_CACHE_ENTRY_BYTES) {
      noteCacheWriteFailure('too-large');
      return false;
    }
    const db = await openDatabase();
    const now = Date.now();
    const transaction = db.transaction(CACHE_STORE, 'readwrite');
    transaction.objectStore(CACHE_STORE).put({
      id,
      url: id,
      sourceUrl: metadata.sourceUrl || id,
      blob,
      mime: metadata.mime || blob.type || 'application/octet-stream',
      size: blob.size,
      createdAt: Number(metadata.createdAt) || now,
      updatedAt: now
    });
    try {
      await transactionDone(transaction);
    } catch (error) {
      // Quota exhaustion used to be indistinguishable from a plain cache miss.
      noteCacheWriteFailure(cacheFailureReason(error));
      return false;
    }
    await pruneCache(id).catch(() => {});
    return true;
  }

  async function pruneCache(keepId = '') {
    const db = await openDatabase();
    const readTransaction = db.transaction(CACHE_STORE, 'readonly');
    const records = await requestValue(readTransaction.objectStore(CACHE_STORE).getAll());
    await transactionDone(readTransaction);
    let total = records.reduce((sum, record) => sum + (Number(record.size) || record.blob?.size || 0), 0);
    if (total <= MAX_CACHE_BYTES) return;
    const candidates = records
      .filter((record) => record.id !== keepId)
      .sort((left, right) => (left.updatedAt || 0) - (right.updatedAt || 0));
    const removeIds = [];
    for (const record of candidates) {
      if (total <= MAX_CACHE_BYTES) break;
      removeIds.push(record.id);
      total -= Number(record.size) || record.blob?.size || 0;
    }
    if (!removeIds.length) return;
    const transaction = db.transaction(CACHE_STORE, 'readwrite');
    const store = transaction.objectStore(CACHE_STORE);
    removeIds.forEach((id) => store.delete(id));
    await transactionDone(transaction);
  }

  async function deleteCachedImage(url) {
    const db = await openDatabase();
    const transaction = db.transaction(CACHE_STORE, 'readwrite');
    transaction.objectStore(CACHE_STORE).delete(imageId(url));
    await transactionDone(transaction);
  }

  async function upsertImages(images) {
    return bulkUpsertAndUpdateImages(images);
  }

  async function bulkUpsertAndUpdateImages(images, updates = {}) {
    const incoming = [...new Map((Array.isArray(images) ? images : [])
      .map(normalizeImage)
      .filter(Boolean)
      .map((image) => [image.id, image])).values()];
    if (!incoming.length) return [];
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    const records = new Array(incoming.length);
    const requests = incoming.map((image, index) => new Promise((resolve, reject) => {
      const request = store.get(image.id);
      request.onsuccess = () => {
        try {
          const base = mergeImageRecord(image, request.result);
          const changes = typeof updates === 'function' ? updates(base) : updates;
          const record = applyImageUpdates(base, changes);
          records[index] = record;
          store.put(record);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => reject(dataError('read', '本地图片读取失败', request.error));
    }));
    await Promise.all([Promise.all(requests), transactionDone(transaction)]);
    return records;
  }

  async function saveScan(images, metadata = {}) {
    const incomingImages = Array.isArray(images) ? images : [];
    const reuseUrls = new Set((Array.isArray(metadata.reuseUrls) ? metadata.reuseUrls : []).map(imageId).filter(Boolean));
    // Existing, unchanged images already have a durable record. Avoid
    // rewriting them on every scan so incremental scans remain incremental.
    await upsertImages(incomingImages.filter((image) => !reuseUrls.has(imageId(image?.url))));
    const imageIds = [...new Set(incomingImages.map((image) => imageId(image?.url)).filter(Boolean))];
    const pages = (Array.isArray(metadata.pages) ? metadata.pages : []).map((page) => ({
      tabId: Number(page?.tabId) || 0,
      pageUrl: String(page?.pageUrl || '').trim(),
      pageTitle: String(page?.pageTitle || '').trim(),
      imageIds: Array.isArray(page?.imageIds) ? [...new Set(page.imageIds.map(imageId).filter(Boolean))] : [],
      signatures: page?.signatures && typeof page.signatures === 'object' ? page.signatures : {},
      count: Number(page?.count) || 0,
      createdAt: Number(page?.createdAt) || Date.now()
    })).filter((page) => page.pageUrl || page.imageIds.length);
    const imageSnapshots = incomingImages.map((image) => normalizeImage(image)).filter(Boolean).map((image) => {
      const { favorite: _favorite, tags: _tags, collectionIds: _collectionIds, updatedAt: _updatedAt, ...snapshot } = image;
      // User-editable library fields are merged from the current record when
      // a history item is restored; page/source metadata stays immutable.
      return snapshot;
    });
    const scan = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      pageUrl: metadata.pageUrl || '',
      pageTitle: metadata.pageTitle || '当前页面',
      imageIds,
      count: imageIds.length,
      duplicateCount: Number(metadata.duplicateCount) || 0,
      scope: ['current', 'selected', 'window'].includes(metadata.scope) ? metadata.scope : 'current',
      siteHost: String(metadata.siteHost || '').trim(),
      pages,
      imageSnapshots,
      filters: metadata.filters && typeof metadata.filters === 'object' ? metadata.filters : {},
      newCount: Number(metadata.newCount) || 0,
      changedCount: Number(metadata.changedCount) || 0,
      removedCount: Number(metadata.removedCount) || 0,
      incremental: metadata.incremental !== false,
      reuseCount: reuseUrls.size,
      createdAt: Date.now()
    };
    const db = await openDatabase();
    const transaction = db.transaction(SCAN_STORE, 'readwrite');
    transaction.objectStore(SCAN_STORE).put(scan);
    await transactionDone(transaction);
    return scan;
  }

  async function listImages(options = {}) {
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readonly');
    const store = transaction.objectStore(IMAGE_STORE);
    // `favorite` is a boolean, which IndexedDB cannot index, so favorites are
    // filtered in memory below instead of through an index.
    const source = store.getAll();
    const records = await requestValue(source);
    const query = String(options.query || '').trim().toLowerCase();
    const tag = String(options.tag || '').trim().toLowerCase();
    const filtered = records.filter((record) => {
      if (options.favoriteOnly && !record.favorite) return false;
      if (tag && !record.tags.some((item) => item.toLowerCase() === tag)) return false;
      if (!query) return true;
      return [record.url, record.domain, record.format, record.alt, ...record.tags]
        .join(' ').toLowerCase().includes(query);
    }).sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
    return options.limit ? filtered.slice(0, options.limit) : filtered;
  }

  async function listScans(limit = 30) {
    const db = await openDatabase();
    const transaction = db.transaction(SCAN_STORE, 'readonly');
    const records = await requestValue(transaction.objectStore(SCAN_STORE).getAll());
    return records.sort((left, right) => (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt)).slice(0, limit);
  }

  async function findLatestScanForPages(pageUrls = []) {
    const targets = new Set((Array.isArray(pageUrls) ? pageUrls : [pageUrls]).map((url) => String(url || '').trim()).filter(Boolean));
    if (!targets.size) return null;
    const scans = await listScans(200);
    return scans.find((scan) => {
      const pages = Array.isArray(scan.pages) && scan.pages.length ? scan.pages : [{ pageUrl: scan.pageUrl }];
      const urls = new Set(pages.map((page) => String(page?.pageUrl || '').trim()).filter(Boolean));
      return urls.size === targets.size && [...targets].every((url) => urls.has(url));
    }) || null;
  }

  async function listDownloads(limit = 30) {
    const db = await openDatabase();
    const transaction = db.transaction(DOWNLOAD_STORE, 'readonly');
    const records = await requestValue(transaction.objectStore(DOWNLOAD_STORE).getAll());
    return records.sort((left, right) => right.createdAt - left.createdAt).slice(0, limit);
  }

  async function recoverInterruptedDownloads(activeJobIds = []) {
    const active = new Set((Array.isArray(activeJobIds) ? activeJobIds : []).filter(Boolean).map(String));
    const db = await openDatabase();
    const transaction = db.transaction(DOWNLOAD_STORE, 'readwrite');
    const store = transaction.objectStore(DOWNLOAD_STORE);
    const request = store.openCursor();
    let recovered = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value;
      const jobId = String(record.jobId || record.id || '');
      if (['queued', 'running', 'paused'].includes(record.status) && (!jobId || !active.has(jobId))) {
        const urls = Array.isArray(record.urls) ? record.urls.filter(Boolean) : [];
        const existingFailures = Array.isArray(record.failedItems) ? record.failedItems : [];
        const knownFailureUrls = new Set(existingFailures.map((item) => item?.url).filter(Boolean));
        const completedUrls = new Set((Array.isArray(record.completedUrls) ? record.completedUrls : []).filter(Boolean));
        const retryUrls = record.kind === 'images' ? urls.filter((url) => !completedUrls.has(url) && !knownFailureUrls.has(url)) : urls.filter((url) => !knownFailureUrls.has(url));
        const failedItems = [
          ...existingFailures,
          ...retryUrls.map((url) => ({
            url,
            candidateUrls: [url],
            code: 'service-worker-restarted',
            stage: 'download',
            error: 'Download task was interrupted because the background worker restarted.'
          }))
        ].slice(0, 1000);
        const allItemsRecovered = record.kind === 'images' && failedItems.length === 0 && urls.length > 0;
        cursor.update({
          ...record,
          status: allItemsRecovered ? 'started' : 'failed',
          phase: allItemsRecovered ? 'complete' : 'failed',
          paused: false,
          failed: failedItems.length,
          failedItems,
          completed: allItemsRecovered ? urls.length : (Number(record.completed) || completedUrls.size),
          completedUrls: [...completedUrls],
          error: allItemsRecovered ? '' : 'Download task was interrupted because the background worker restarted.',
          errorCode: allItemsRecovered ? '' : 'service-worker-restarted',
          detail: allItemsRecovered ? 'Download task recovered from persisted progress.' : 'Download task interrupted; retry the failed items.',
          completedAt: Date.now(),
          updatedAt: Date.now()
        });
        recovered += 1;
      }
      cursor.continue();
    };
    await transactionDone(transaction);
    return recovered;
  }

  async function getScanImages(scanId) {
    const db = await openDatabase();
    const scanTransaction = db.transaction(SCAN_STORE, 'readonly');
    const scan = await requestValue(scanTransaction.objectStore(SCAN_STORE).get(scanId));
    if (!scan) return [];
    const transaction = db.transaction(IMAGE_STORE, 'readonly');
    const done = transactionDone(transaction);
    const imageIds = Array.isArray(scan.imageIds) ? scan.imageIds : [];
    const snapshots = new Map((Array.isArray(scan.imageSnapshots) ? scan.imageSnapshots : []).map((image) => [imageId(image?.url), image]).filter(([id]) => id));
    const records = await Promise.all(imageIds.map(async (id) => {
      const current = await requestValue(transaction.objectStore(IMAGE_STORE).get(id));
      const snapshot = snapshots.get(imageId(id));
      if (!snapshot) return current;
      return {
        ...snapshot,
        favorite: Boolean(current?.favorite),
        tags: cleanTags(current?.tags),
        collectionIds: cleanCollectionIds(current?.collectionIds),
        updatedAt: current?.updatedAt || scan.createdAt || Date.now()
      };
    }));
    await done;
    return records.filter(Boolean);
  }

  async function updateImage(url, updates = {}) {
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    const previous = await requestValue(store.get(imageId(url)));
    const base = previous || normalizeImage({ url });
    if (!base) return null;
    const changes = typeof updates === 'function' ? updates(base) : updates;
    const record = applyImageUpdates(base, changes);
    store.put(record);
    await transactionDone(transaction);
    return record;
  }

  async function hashBlob(blob) {
    if (!blob || typeof blob.arrayBuffer !== 'function' || !global.crypto?.subtle) return '';
    const digest = await global.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function perceptualHash(blob) {
    if (!blob || typeof global.createImageBitmap !== 'function') return '';
    let bitmap;
    try {
      bitmap = await global.createImageBitmap(blob);
      const canvas = global.OffscreenCanvas ? new global.OffscreenCanvas(8, 8) : null;
      if (!canvas) return '';
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return '';
      context.drawImage(bitmap, 0, 0, 8, 8);
      const pixels = context.getImageData(0, 0, 8, 8).data;
      const values = [];
      for (let index = 0; index < pixels.length; index += 4) values.push((pixels[index] * 299 + pixels[index + 1] * 587 + pixels[index + 2] * 114) / 1000);
      const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
      return values.map((value) => value >= average ? '1' : '0').join('');
    } catch { return ''; }
    finally { bitmap?.close?.(); }
  }

  async function analyzeImageBlob(url, blob, metadata = {}) {
    const id = imageId(url);
    if (!id || !blob) return null;
    const [contentHash, perceptual] = await Promise.all([hashBlob(blob).catch(() => ''), perceptualHash(blob).catch(() => '')]);
    return updateImage(id, {
      contentHash,
      perceptualHash: perceptual,
      size: Number(blob.size) || 0,
      mime: metadata.mime || blob.type || '',
      cacheState: metadata.cacheState || 'cached',
      valid: true,
      invalidReason: ''
    });
  }

  async function backfillHashes(limit = 20) {
    const records = (await listImages()).filter((record) => !record.contentHash);
    let processed = 0;
    for (const record of records.slice(0, Math.max(0, Number(limit) || 20))) {
      const cached = await getCachedImage(record.url);
      if (!cached?.blob) continue;
      await analyzeImageBlob(record.url, cached.blob, { mime: cached.mime, cacheState: 'cached' }).catch(() => {});
      processed += 1;
    }
    return processed;
  }

  function duplicateKey(record) {
    return record?.contentHash ? `content:${record.contentHash}` : `url:${String(record?.url || '').split('#')[0]}`;
  }

  async function listDuplicateGroups(strategy = 'largest-dimension') {
    const records = await listImages();
    const groups = new Map();
    records.forEach((record) => {
      const key = duplicateKey(record);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    return [...groups.entries()].filter(([, items]) => items.length > 1).map(([key, items]) => {
      const sorted = [...items].sort((left, right) => {
        if (strategy === 'largest-file') return (right.size || 0) - (left.size || 0);
        if (strategy === 'original') return Number(right.original) - Number(left.original) || (right.size || 0) - (left.size || 0);
        return ((right.width || 0) * (right.height || 0)) - ((left.width || 0) * (left.height || 0)) || (right.size || 0) - (left.size || 0);
      });
      return { key, exact: key.startsWith('content:'), items: sorted, keeper: sorted[0]?.url || '' };
    });
  }

  function hammingDistance(left, right) {
    if (!left || !right || left.length !== right.length) return Number.MAX_SAFE_INTEGER;
    let distance = 0;
    for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) distance += 1;
    return distance;
  }

  async function listSimilarGroups(threshold = 8) {
    const records = (await listImages()).filter((record) => record.perceptualHash);
    const maxDistance = Math.max(0, Math.min(64, Number(threshold) || 8));
    const groups = [];
    const visited = new Set();
    records.forEach((record) => {
      if (visited.has(record.url)) return;
      const items = records.filter((candidate) => hammingDistance(record.perceptualHash, candidate.perceptualHash) <= maxDistance);
      if (items.length > 1) { items.forEach((item) => visited.add(item.url)); groups.push({ key: `similar:${record.perceptualHash}`, distance: maxDistance, items }); }
    });
    return groups;
  }

  async function cleanupImages(mode, strategy = 'largest-dimension') {
    const records = await listImages();
    let targets = [];
    if (mode === 'invalid') targets = records.filter((record) => record.valid === false || !record.url);
    else if (mode === 'unfavorited') targets = records.filter((record) => !record.favorite);
    else if (mode === 'duplicates') {
      const groups = await listDuplicateGroups(strategy);
      const keepers = new Set(groups.map((group) => group.keeper));
      targets = groups.flatMap((group) => group.items.filter((item) => !keepers.has(item.url)));
    }
    const count = await deleteImages(targets.map((record) => record.url));
    return { count, urls: targets.map((record) => record.url) };
  }

  function setFavorite(url, favorite) { return updateImage(url, { favorite }); }

  async function toggleFavorite(url) {
    return updateImage(url, (record) => ({ favorite: !record.favorite }));
  }

  function setTags(url, tags) { return updateImage(url, { tags }); }

  async function saveDownload(record) {
    const item = {
      id: record.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: record.kind || 'images',
      status: record.status || 'started',
      urls: Array.isArray(record.urls) ? record.urls.slice(0, 1000) : [],
      count: Number(record.count) || 0,
      started: Number(record.started) || 0,
      completed: Number(record.completed) || 0,
      completedUrls: Array.isArray(record.completedUrls) ? record.completedUrls.slice(0, 1000) : [],
      failed: Number(record.failed) || 0,
      failedItems: Array.isArray(record.failedItems) ? record.failedItems.slice(0, 1000) : [],
      error: record.error || '',
      errorCode: record.errorCode || '',
      filename: record.filename || '',
      jobId: record.jobId || '',
      phase: record.phase || '',
      percent: Number(record.percent) || 0,
      detail: record.detail || '',
      paused: Boolean(record.paused),
      completedAt: Number(record.completedAt) || 0,
      createdAt: record.createdAt || Date.now()
    };
    item.updatedAt = record.updatedAt || Date.now();
    const db = await openDatabase();
    const transaction = db.transaction(DOWNLOAD_STORE, 'readwrite');
    transaction.objectStore(DOWNLOAD_STORE).put(item);
    await transactionDone(transaction);
    return item;
  }

  async function updateDownload(id, updates = {}) {
    const db = await openDatabase();
    const transaction = db.transaction(DOWNLOAD_STORE, 'readwrite');
    const store = transaction.objectStore(DOWNLOAD_STORE);
    const previous = await requestValue(store.get(id));
    if (!previous) return null;
    const item = {
      ...previous,
      ...updates,
      id: previous.id,
      urls: Array.isArray(updates.urls) ? updates.urls.slice(0, 1000) : previous.urls,
      percent: updates.percent === undefined ? previous.percent || 0 : Number(updates.percent) || 0,
      paused: updates.paused === undefined ? (updates.status === 'paused' ? true : Boolean(previous.paused)) : Boolean(updates.paused),
      updatedAt: Date.now()
    };
    store.put(item);
    await transactionDone(transaction);
    return item;
  }

  function cleanCollectionIds(ids) {
    return [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 50);
  }

  function cleanCollectionName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  }

  async function createCollection(name) {
    const cleanName = cleanCollectionName(name);
    if (!cleanName) return null;
    const existing = await listCollections();
    const duplicate = existing.find((item) => item.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) return duplicate;
    const db = await openDatabase();
    const transaction = db.transaction(COLLECTION_STORE, 'readwrite');
    const store = transaction.objectStore(COLLECTION_STORE);
    const collection = { id: `collection-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: cleanName, createdAt: Date.now(), updatedAt: Date.now() };
    store.put(collection);
    await transactionDone(transaction);
    return collection;
  }

  async function listCollections() {
    const db = await openDatabase();
    const transaction = db.transaction(COLLECTION_STORE, 'readonly');
    const records = await requestValue(transaction.objectStore(COLLECTION_STORE).getAll());
    return records.sort((left, right) => (left.name || '').localeCompare(right.name || '', undefined, { sensitivity: 'base' }));
  }

  function setImageCollections(url, collectionIds) { return updateImage(url, { collectionIds: cleanCollectionIds(collectionIds) }); }

  async function bulkUpdateImages(urls, updates = {}) {
    const ids = [...new Set((Array.isArray(urls) ? urls : []).map(imageId).filter(Boolean))];
    if (!ids.length) return [];
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    const updated = [];
    const requests = ids.map((id) => new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        try {
          const previous = request.result;
          if (!previous) { resolve(); return; }
          const changes = typeof updates === 'function' ? updates(previous) : updates;
          const record = applyImageUpdates(previous, changes);
          updated.push(record);
          store.put(record);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => reject(dataError('read', '本地图片读取失败', request.error));
    }));
    await Promise.all([Promise.all(requests), transactionDone(transaction)]);
    return updated;
  }

  async function deleteImages(urls) {
    const ids = [...new Set((Array.isArray(urls) ? urls : []).map(imageId).filter(Boolean))];
    if (!ids.length) return 0;
    const db = await openDatabase();
    const transaction = db.transaction([IMAGE_STORE, CACHE_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    const cacheStore = transaction.objectStore(CACHE_STORE);
    ids.forEach((id) => { store.delete(id); cacheStore.delete(id); });
    await transactionDone(transaction);
    return ids.length;
  }

  async function getStorageStats() {
    const [images, cache, collections, scans, downloads] = await Promise.all([
      measureStore(IMAGE_STORE, (stats, record) => { if (record.favorite) stats.favorites += 1; }),
      measureCacheStore(),
      measureStore(COLLECTION_STORE),
      measureStore(SCAN_STORE),
      measureStore(DOWNLOAD_STORE)
    ]);
    return {
      images: images.count,
      cachedImages: cache.count,
      favorites: images.favorites,
      collections: collections.count,
      scans: scans.count,
      downloads: downloads.count,
      cacheBytes: cache.bytes,
      bytes: images.bytes + cache.bytes + collections.bytes + scans.bytes + downloads.bytes
    };
  }

  function measureCacheStore() {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE, 'readonly');
      const stats = { count: 0, bytes: 0 };
      const request = transaction.objectStore(CACHE_STORE).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        stats.count += 1;
        stats.bytes += Number(cursor.value.size) || cursor.value.blob?.size || 0;
        cursor.continue();
      };
      request.onerror = () => reject(dataError('read', '本地缓存读取失败', request.error));
      transaction.onerror = () => reject(dataError('read', '本地缓存读取失败', transaction.error));
      transaction.onabort = () => reject(dataError('abort', '本地缓存事务已中止', transaction.error));
      transaction.oncomplete = () => resolve(stats);
    }));
  }

  function measureStore(storeName, onRecord = () => {}) {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const stats = { count: 0, favorites: 0, bytes: 0 };
        const encoder = new TextEncoder();
        const request = transaction.objectStore(storeName).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          stats.count += 1;
          onRecord(stats, cursor.value);
          stats.bytes += encoder.encode(JSON.stringify(cursor.value)).byteLength;
          cursor.continue();
        };
        request.onerror = () => reject(dataError('read', '本地数据读取失败', request.error));
        transaction.onerror = () => reject(dataError('read', '本地数据读取失败', transaction.error));
        transaction.onabort = () => reject(dataError('abort', '本地数据事务已中止', transaction.error));
        transaction.oncomplete = () => resolve(stats);
      }));
  }

  async function clearLibrary() {
    const db = await openDatabase();
    const transaction = db.transaction([IMAGE_STORE, CACHE_STORE, COLLECTION_STORE], 'readwrite');
    transaction.objectStore(IMAGE_STORE).clear();
    transaction.objectStore(CACHE_STORE).clear();
    transaction.objectStore(COLLECTION_STORE).clear();
    await transactionDone(transaction);
  }

  async function exportLibrary() {
    const [images, collections] = await Promise.all([listImages(), listCollections()]);
    return { version: 1, exportedAt: new Date().toISOString(), collections, images };
  }

  async function importLibrary(data) {
    const payload = data && typeof data === 'object' ? data : {};
    const collections = Array.isArray(payload.collections) ? payload.collections : [];
    const images = Array.isArray(payload.images) ? payload.images : [];
    const collectionMap = new Map();
    for (const collection of collections) {
      const created = await createCollection(collection.name);
      if (created && collection.id) collectionMap.set(collection.id, created.id);
    }
    for (const image of images) {
      if (!image?.url) continue;
      await bulkUpsertAndUpdateImages([image], (record) => ({
        favorite: Boolean(image.favorite || record.favorite),
        tags: cleanTags([...(record.tags || []), ...(image.tags || [])]),
        collectionIds: cleanCollectionIds((image.collectionIds || [])
          .map((id) => collectionMap.get(id) || id)
          .concat(record.collectionIds || []))
      }));
    }
    return { collections: collectionMap.size, images: images.length };
  }

  async function countFavorites() {
    const records = await listImages({ favoriteOnly: true });
    return records.length;
  }

  async function clearHistory() {
    const db = await openDatabase();
    const transaction = db.transaction([SCAN_STORE, DOWNLOAD_STORE], 'readwrite');
    transaction.objectStore(SCAN_STORE).clear();
    transaction.objectStore(DOWNLOAD_STORE).clear();
    await transactionDone(transaction);
  }

  global.ImageCollectorDB = {
    getImage,
    getCachedImage,
    putCachedImage,
    getCacheWriteState,
    deleteCachedImage,
    upsertImages,
    bulkUpsertAndUpdateImages,
    saveScan,
    listImages,
    listScans,
    findLatestScanForPages,
    listDownloads,
    getScanImages,
    setFavorite,
    toggleFavorite,
    setTags,
    saveDownload,
    updateDownload,
    recoverInterruptedDownloads,
    createCollection,
    listCollections,
    setImageCollections,
    updateImage,
    bulkUpdateImages,
    deleteImages,
    getStorageStats,
    clearLibrary,
    exportLibrary,
    importLibrary,
    countFavorites,
    clearHistory,
    cleanTags,
    hashBlob,
    perceptualHash,
    analyzeImageBlob,
    backfillHashes,
    listDuplicateGroups,
    listSimilarGroups,
    cleanupImages
  };
})(typeof self === 'undefined' ? globalThis : self);
