# Image Collector TODO

本文档记录 `1.0.1` 及后续版本的功能计划。已完成的任务使用 `[x]` 标记。

## 1.0.1

### 第一优先级：核心体验

- [x] 原图优先识别：解析 `data-original`、`srcset`、`picture` 和图片外链，优先使用更高质量的图片地址。
- [x] 搜索和排序：支持按文件名、域名和 URL 搜索，并按页面顺序、宽度、高度、面积和文件名排序。
- [x] 重复图片过滤：优先使用图片像素指纹识别重复内容，跨域无法读取像素时回退到规范化 URL。
- [x] 下载进度：显示普通下载和 ZIP 读取、压缩任务的处理进度。
- [x] 失败重试：保留失败图片，可以直接重试失败项，并继续使用原来的下载模式。

## 1.1.0

### 图片发现能力

- [ ] 扫描 `iframe` 中的图片。
- [ ] 监听页面 DOM 变化，自动发现滚动和懒加载产生的新图片。
- [ ] 支持 `video poster`、`object` 和更多图片懒加载属性。
- [ ] 提供“仅显示原图候选”筛选开关。

### 下载能力

- [ ] 支持文件名模板和按域名、日期、格式创建 ZIP 子目录。
- [ ] 显示文件大小和 MIME 类型。
- [ ] 增加下载任务队列、取消任务和更详细的错误原因。
- [ ] 支持导出图片 URL、JSON 和 CSV 清单。

## 1.2.0

### 管理能力

- [ ] 收藏图片和添加本地标签。
- [ ] 保存最近扫描记录和下载记录。
- [ ] 使用 IndexedDB 管理大量图片元数据。
- [ ] 增加右键菜单：扫描当前页面、下载当前图片。

## English

Completed items use `[x]`. The remaining items are planned for future releases.

### 1.0.1 core experience

- [x] Prefer original image sources from `data-original`, `srcset`, `picture`, and linked image URLs.
- [x] Search by filename, hostname, or URL and sort by page order, width, height, area, or filename.
- [x] Filter duplicate images using pixel fingerprints when possible and normalized URLs as a fallback.
- [x] Show progress for regular downloads and ZIP reading/compression tasks.
- [x] Keep failed images available for retry with the original download mode.

### 1.1.0 image discovery and downloads

- [ ] Scan images inside `iframe` elements.
- [ ] Observe DOM changes and discover lazy-loaded images after scrolling.
- [ ] Support `video poster`, `object`, and more lazy-loading attributes.
- [ ] Add filename templates and ZIP subfolders by hostname, date, or format.
- [ ] Display file size and MIME type.
- [ ] Add a cancellable download queue and JSON/CSV URL export.

### 1.2.0 local library

- [ ] Add local favorites and tags.
- [ ] Store recent scans and download history.
- [ ] Use IndexedDB for larger metadata collections.
- [ ] Add context-menu actions for scanning pages and downloading images.
