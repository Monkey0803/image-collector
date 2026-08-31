(function createImageCollectorDatabase(global) {
  'use strict';

  const DB_NAME = 'image-collector-library';
  const DB_VERSION = 3;
  const IMAGE_STORE = 'images';
  const CACHE_STORE = 'imageCache';
  const SCAN_STORE = 'scans';
  const DOWNLOAD_STORE = 'downloads';
  const COLLECTION_STORE = 'collections';
  let databasePromise;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          const store = db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
          store.createIndex('byFavorite', 'favorite');
          store.createIndex('byUpdatedAt', 'updatedAt');
          store.createIndex('byDomain', 'domain');
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
        reject(request.error || new Error('无法打开本地素材库'));
      };
      request.onblocked = () => {
        databasePromise = null;
        reject(new Error('本地素材库正在被其他页面占用'));
      };
    });
    return databasePromise;
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('本地数据读取失败'));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('本地数据写入失败'));
      transaction.onabort = () => reject(transaction.error || new Error('本地数据事务已中止'));
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
      original: Boolean(image.original),
      domain: hostnameFor(url),
      favorite: Boolean(image.favorite),
      tags: cleanTags(image.tags),
      collectionIds: cleanCollectionIds(image.collectionIds),
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
      original: image.original || Boolean(previous?.original),
      favorite: previous ? Boolean(previous.favorite) : image.favorite,
      tags: previous ? cleanTags(previous.tags) : image.tags,
      collectionIds: previous ? cleanCollectionIds(previous.collectionIds) : image.collectionIds,
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
    if (!id || !blob || typeof blob.size !== 'number' || blob.size <= 0 || blob.size > MAX_CACHE_ENTRY_BYTES) return false;
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
    await transactionDone(transaction);
    await pruneCache(id);
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
      request.onerror = () => reject(request.error || new Error('本地图片读取失败'));
    }));
    await Promise.all([Promise.all(requests), transactionDone(transaction)]);
    return records;
  }

  async function saveScan(images, metadata = {}) {
    const records = await upsertImages(images);
    const scan = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      pageUrl: metadata.pageUrl || '',
      pageTitle: metadata.pageTitle || '当前页面',
      imageIds: records.map((record) => record.id),
      count: records.length,
      duplicateCount: Number(metadata.duplicateCount) || 0,
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
    const source = options.favoriteOnly && global.IDBKeyRange
      ? store.index('byFavorite').getAll(global.IDBKeyRange.only(true))
      : store.getAll();
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

  async function listDownloads(limit = 30) {
    const db = await openDatabase();
    const transaction = db.transaction(DOWNLOAD_STORE, 'readonly');
    const records = await requestValue(transaction.objectStore(DOWNLOAD_STORE).getAll());
    return records.sort((left, right) => right.createdAt - left.createdAt).slice(0, limit);
  }

  async function getScanImages(scanId) {
    const db = await openDatabase();
    const scanTransaction = db.transaction(SCAN_STORE, 'readonly');
    const scan = await requestValue(scanTransaction.objectStore(SCAN_STORE).get(scanId));
    if (!scan) return [];
    const transaction = db.transaction(IMAGE_STORE, 'readonly');
    const done = transactionDone(transaction);
    const records = await Promise.all(scan.imageIds.map((id) => requestValue(transaction.objectStore(IMAGE_STORE).get(id))));
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
      failed: Number(record.failed) || 0,
      error: record.error || '',
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
      request.onerror = () => reject(request.error || new Error('本地图片读取失败'));
    }));
    await Promise.all([Promise.all(requests), transactionDone(transaction)]);
    return updated;
  }

  async function deleteImages(urls) {
    const ids = [...new Set((Array.isArray(urls) ? urls : []).map(imageId).filter(Boolean))];
    if (!ids.length) return 0;
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    ids.forEach((id) => store.delete(id));
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
      request.onerror = () => reject(request.error || new Error('本地缓存读取失败'));
      transaction.onerror = () => reject(transaction.error || new Error('本地缓存读取失败'));
      transaction.onabort = () => reject(transaction.error || new Error('本地缓存事务已中止'));
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
        request.onerror = () => reject(request.error || new Error('本地数据读取失败'));
        transaction.onerror = () => reject(transaction.error || new Error('本地数据读取失败'));
        transaction.onabort = () => reject(transaction.error || new Error('本地数据事务已中止'));
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
    deleteCachedImage,
    upsertImages,
    bulkUpsertAndUpdateImages,
    saveScan,
    listImages,
    listScans,
    listDownloads,
    getScanImages,
    setFavorite,
    toggleFavorite,
    setTags,
    saveDownload,
    updateDownload,
    createCollection,
    listCollections,
    setImageCollections,
    bulkUpdateImages,
    deleteImages,
    getStorageStats,
    clearLibrary,
    exportLibrary,
    importLibrary,
    countFavorites,
    clearHistory,
    cleanTags
  };
})(typeof self === 'undefined' ? globalThis : self);
