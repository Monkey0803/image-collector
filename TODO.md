# Image Collector TODO

本文档记录 `1.4.0` 及后续版本的功能计划。已完成的任务使用 `[x]` 标记。

## 1.0.1

### 第一优先级：核心体验

- [x] 原图优先识别：解析 `data-original`、`srcset`、`picture` 和图片外链，优先使用更高质量的图片地址。
- [x] 搜索和排序：支持按文件名、域名和 URL 搜索，并按页面顺序、宽度、高度、面积和文件名排序。
- [x] 重复图片过滤：优先使用图片像素指纹识别重复内容，跨域无法读取像素时回退到规范化 URL。
- [x] 下载进度：显示普通下载和 ZIP 读取、压缩任务的处理进度。
- [x] 失败重试：保留失败图片，可以直接重试失败项，并继续使用原来的下载模式。

## 1.0.2

### 图片发现能力

- [x] 扫描 `iframe` 中的图片。
- [x] 在扫描期间监听页面 DOM 变化，并通过短时二次扫描发现懒加载图片。
- [x] 支持 `video poster`、`object` 和更多图片懒加载属性。
- [x] 提供“仅显示原图候选”筛选开关。

### 下载能力

- [x] 支持按域名、格式或域名/格式创建 ZIP 子目录。
- [x] 异步显示文件大小和 MIME 类型。
- [x] 支持取消进行中的图片读取、ZIP 压缩和下载任务。
- [x] 支持导出当前筛选结果为 JSON 或 CSV 清单。

## 1.1.0

### 下载能力

- [x] 支持文件名模板和日期目录。
- [x] 增加真正的下载任务队列和更详细的错误原因。

## 1.2.0

### 管理能力

- [x] 收藏图片和添加本地标签。
- [x] 保存最近扫描记录和下载记录。
- [x] 使用 IndexedDB 管理大量图片元数据。
- [x] 增加右键菜单：扫描当前页面、下载当前图片、收藏当前图片。

## 1.3.0

### 体验和管理能力

- [x] 增加大图预览、缩放和复制原图地址。
- [x] 支持保存常用筛选条件和批量选择预设。
- [x] 增加独立下载任务中心，支持暂停、继续和批量重试。
- [x] 支持自定义图片集合和本地文件夹视图。
- [x] 增加中英文界面切换。
- [x] 支持导入和导出收藏、标签数据。

## 1.4.0

### 批量工作流与可控采集

- [x] 素材库支持多选、批量收藏、批量标签、批量归档和删除。
- [x] 素材库支持按尺寸、文件大小、格式和更新时间筛选排序。
- [x] 扫描支持最大图片数量和自动滚动加载懒加载图片。
- [x] 增加本地存储统计、清理素材和重置设置入口。
- [x] 增加键盘快捷键，支持全选、反选、聚焦搜索和开始扫描。

## English

This document tracks `1.4.0` and future releases. Completed items use `[x]`.

### 1.0.1 core experience

- [x] Prefer original image sources from `data-original`, `srcset`, `picture`, and linked image URLs.
- [x] Search by filename, hostname, or URL and sort by page order, width, height, area, or filename.
- [x] Filter duplicate images using pixel fingerprints when possible and normalized URLs as a fallback.
- [x] Show progress for regular downloads and ZIP reading/compression tasks.
- [x] Keep failed images available for retry with the original download mode.

### 1.0.2 image discovery and downloads

- [x] Scan images inside `iframe` elements.
- [x] Observe mutations during scanning and perform short delayed rescans for lazy-loaded images.
- [x] Support `video poster`, `object`, and more lazy-loading attributes.
- [x] Add an original-image-only filter.
- [x] Add ZIP subfolders by hostname, format, or hostname/format.
- [x] Display file size and MIME type when the server exposes metadata.
- [x] Cancel active image reading, ZIP compression, and download tasks.
- [x] Export the current filtered results as JSON or CSV.

### 1.1.0 download improvements

- [x] Add filename templates and date-based folders.
- [x] Add a full download queue and more detailed error reporting.

### 1.2.0 local library

- [x] Add local favorites and tags.
- [x] Store recent scans and download history.
- [x] Use IndexedDB for larger metadata collections.
- [x] Add context-menu actions for scanning pages, downloading images, and favoriting images.

### 1.3.0 experience and management

- [x] Add large-image preview, zoom, and original-URL copying.
- [x] Save reusable filters and batch-selection presets.
- [x] Add a dedicated download task center with pause, resume, and batch retry.
- [x] Support custom image collections and local folder views.
- [x] Add Chinese/English interface switching.
- [x] Import and export favorites and tag data.

### 1.4.0 batch workflows and controlled scanning

- [x] Add multi-select, bulk favorite, bulk tagging, bulk collection assignment, and deletion in the library.
- [x] Filter and sort the library by dimensions, file size, format, and update time.
- [x] Add a maximum image count and automatic scrolling option for lazy-loaded pages.
- [x] Add local storage statistics, library cleanup, and settings reset controls.
- [x] Add keyboard shortcuts for select all, invert selection, search focus, and rescanning.
