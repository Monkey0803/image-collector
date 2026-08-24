const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/bmp': '.bmp', 'image/x-icon': '.ico'
};
const FORMAT_EXTENSIONS = {
  jpeg: '.jpg', png: '.png', gif: '.gif', webp: '.webp', avif: '.avif', svg: '.svg'
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'downloadImages') {
    downloadImages(message.images || [], Boolean(message.saveAs), message.jobId).then((result) => sendResponse(result));
    return true;
  }
  if (message.type === 'downloadZip') {
    downloadZip(message.images || [], Boolean(message.saveAs), message.jobId).then((result) => sendResponse(result));
    return true;
  }
  return false;
});

async function downloadImages(images, saveAs, jobId) {
  const failed = [];
  let started = 0;
  const total = images.length;
  sendProgress(jobId, { phase: 'starting', completed: 0, total, failed: 0, percent: 0, detail: '准备提交下载任务' });
  for (const image of images) {
    const index = started + failed.length;
    sendProgress(jobId, {
      phase: 'downloading', completed: index, total, failed: failed.length, percent: progressPercent(index, total),
      detail: `正在提交 ${index + 1}/${total}：${normalizeName(image)}`
    });
    try {
      await chrome.downloads.download({ url: image.url, filename: normalizeName(image), saveAs, conflictAction: 'uniquify' });
      started += 1;
    } catch (error) {
      failed.push({ url: image.url, error: error.message || '下载失败' });
    }
    const completed = started + failed.length;
    sendProgress(jobId, {
      phase: 'downloading', completed, total, failed: failed.length, percent: progressPercent(completed, total),
      detail: `已处理 ${completed}/${total} 张图片`
    });
  }
  sendProgress(jobId, { phase: 'complete', completed: total, total, failed: failed.length, percent: 100, detail: `下载任务已提交，成功 ${started} 张` });
  return { ok: started > 0, started, failed, error: started ? '' : '没有图片能够开始下载' };
}

async function downloadZip(images, saveAs, jobId) {
  const entries = [];
  const failed = [];
  const usedNames = new Set();
  const total = images.length;
  sendProgress(jobId, { phase: 'starting', completed: 0, total, failed: 0, percent: 0, detail: '准备读取图片' });
  for (const [index, image] of images.entries()) {
    sendProgress(jobId, {
      phase: 'reading', completed: index, total, failed: failed.length, percent: progressPercent(index, total),
      detail: `正在读取 ${index + 1}/${total}：${normalizeName(image)}`
    });
    try {
      const response = await fetch(image.url, { credentials: 'omit', redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const name = uniqueName(normalizeName(image, response.headers.get('content-type')), usedNames);
      entries.push({ name, data: new Uint8Array(await response.arrayBuffer()) });
    } catch (error) {
      failed.push({ url: image.url, error: error.message || '读取失败' });
    }
    const completed = index + 1;
    sendProgress(jobId, {
      phase: 'reading', completed, total, failed: failed.length, percent: progressPercent(completed, total),
      detail: `已读取 ${completed}/${total} 张图片`
    });
  }
  if (!entries.length) {
    sendProgress(jobId, { phase: 'failed', completed: total, total, failed: failed.length, percent: 100, detail: '没有可加入 ZIP 的图片' });
    return { ok: false, failed, error: '图片无法读取，可能受跨域或防盗链限制' };
  }
  try {
    sendProgress(jobId, { phase: 'compressing', completed: total, total, failed: failed.length, percent: 100, detail: `正在压缩 ${entries.length} 张图片` });
    const zip = makeZip(entries);
    const dataUrl = `data:application/zip;base64,${toBase64(zip)}`;
    await chrome.downloads.download({ url: dataUrl, filename: `image_${dateStamp()}.zip`, saveAs, conflictAction: 'uniquify' });
    sendProgress(jobId, { phase: 'complete', completed: total, total, failed: failed.length, percent: 100, detail: `ZIP 已提交下载，共 ${entries.length} 张图片` });
    return { ok: true, started: 1, failed };
  } catch (error) {
    sendProgress(jobId, { phase: 'failed', completed: total, total, failed: failed.length, percent: 100, detail: error.message || 'ZIP 下载失败' });
    return { ok: false, failed, error: error.message || 'ZIP 下载失败' };
  }
}

function progressPercent(completed, total) { return total ? Math.round((completed / total) * 100) : 0; }

function sendProgress(jobId, progress) {
  if (!jobId) return;
  chrome.runtime.sendMessage({ type: 'downloadProgress', jobId, ...progress }).catch(() => {});
}

function normalizeName(image, contentType = '') {
  let name = image.name || fileName(image.url) || 'image';
  name = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'image';
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    name += MIME_EXTENSIONS[(contentType || '').split(';')[0].trim()] || FORMAT_EXTENSIONS[image.format] || '.jpg';
  }
  return name;
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
