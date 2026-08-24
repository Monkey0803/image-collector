(function createImageCollectorDatabase(global) {
  'use strict';

  const DB_NAME = 'image-collector-library';
  const DB_VERSION = 1;
  const IMAGE_STORE = 'images';
  const SCAN_STORE = 'scans';
  const DOWNLOAD_STORE = 'downloads';
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
        if (!db.objectStoreNames.contains(SCAN_STORE)) {
          const store = db.createObjectStore(SCAN_STORE, { keyPath: 'id' });
          store.createIndex('byCreatedAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(DOWNLOAD_STORE)) {
          const store = db.createObjectStore(DOWNLOAD_STORE, { keyPath: 'id' });
          store.createIndex('byCreatedAt', 'createdAt');
          store.createIndex('byStatus', 'status');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error('无法打开本地素材库'));
      request.onblocked = () => reject(new Error('本地素材库正在被其他页面占用'));
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
      updatedAt: Date.now()
    };
  }

  async function getImage(url) {
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readonly');
    return requestValue(transaction.objectStore(IMAGE_STORE).get(imageId(url)));
  }

  async function upsertImages(images) {
    const incoming = (Array.isArray(images) ? images : []).map(normalizeImage).filter(Boolean);
    if (!incoming.length) return [];
    const existing = await Promise.all(incoming.map((image) => getImage(image.url)));
    const records = incoming.map((image, index) => {
      const previous = existing[index];
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
        createdAt: previous?.createdAt || Date.now()
      };
    });
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    records.forEach((record) => store.put(record));
    await transactionDone(transaction);
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
    const records = await requestValue(transaction.objectStore(IMAGE_STORE).getAll());
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
    return records.sort((left, right) => right.createdAt - left.createdAt).slice(0, limit);
  }

  async function listDownloads(limit = 30) {
    const db = await openDatabase();
    const transaction = db.transaction(DOWNLOAD_STORE, 'readonly');
    const records = await requestValue(transaction.objectStore(DOWNLOAD_STORE).getAll());
    return records.sort((left, right) => right.createdAt - left.createdAt).slice(0, limit);
  }

  async function getScanImages(scanId) {
    const db = await openDatabase();
    const transaction = db.transaction(SCAN_STORE, 'readonly');
    const scan = await requestValue(transaction.objectStore(SCAN_STORE).get(scanId));
    if (!scan) return [];
    return Promise.all(scan.imageIds.map((id) => getImage(id))).then((records) => records.filter(Boolean));
  }

  async function updateImage(url, updates = {}) {
    const previous = await getImage(url);
    const base = previous || normalizeImage({ url });
    if (!base) return null;
    const record = {
      ...base,
      ...updates,
      id: base.id,
      url: base.url,
      favorite: updates.favorite === undefined ? Boolean(base.favorite) : Boolean(updates.favorite),
      tags: updates.tags === undefined ? cleanTags(base.tags) : cleanTags(updates.tags),
      updatedAt: Date.now()
    };
    const db = await openDatabase();
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    transaction.objectStore(IMAGE_STORE).put(record);
    await transactionDone(transaction);
    return record;
  }

  function setFavorite(url, favorite) { return updateImage(url, { favorite }); }

  async function toggleFavorite(url) {
    const previous = await getImage(url);
    return updateImage(url, { favorite: !previous?.favorite });
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
      createdAt: record.createdAt || Date.now()
    };
    const db = await openDatabase();
    const transaction = db.transaction(DOWNLOAD_STORE, 'readwrite');
    transaction.objectStore(DOWNLOAD_STORE).put(item);
    await transactionDone(transaction);
    return item;
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
    upsertImages,
    saveScan,
    listImages,
    listScans,
    listDownloads,
    getScanImages,
    setFavorite,
    toggleFavorite,
    setTags,
    saveDownload,
    countFavorites,
    clearHistory,
    cleanTags
  };
})(typeof self === 'undefined' ? globalThis : self);
