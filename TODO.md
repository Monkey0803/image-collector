# Image Collector TODO

本文档记录当前 `3.4.0` 及后续版本的功能计划。已完成的任务使用 `[x]` 标记；未勾选项表示待开发或待验证内容。

最后更新：2026-09-11

## 当前状态

- [x] `2.7.0` 稳定性与任务可靠性已完成并发布。
- [x] `2.8.0` 智能集合与可视化筛选增强已完成并发布。
- [x] `2.9.0` 主视图聚焦与操作界面优化已完成并发布。
- [x] `3.0.0` 多页面采集工作流实现并发布；真实 Chrome 交互回归仍作为持续验收项。
- [x] `3.2.0` 发布质量与真机验收已完成；验收发现的两处缺陷在 `3.2.1` 修复。
- [x] `3.2.1` 元数据覆盖与索引清理已发布。
- [x] `3.2.2` 侧边栏快捷键可靠性修复已发布。
- [x] `3.3.0` 静默截断清理、CI 与 README 中英同步已完成。
- [x] `3.3.1` 界面语言完整性已完成。
- [x] `3.4.0` 首屏布局重构已完成。

## 已知缺陷（2026-09-11 真机验收发现）

- [x] `library.js` 的 `listImages({ favoriteOnly: true })` 曾使用 `IDBKeyRange.only(true)`，但 `favorite` 以布尔值存储，而布尔值不是合法的 IndexedDB 键，因此调用会抛 `DataError`，导出的 `countFavorites()` 完全不可用。已改为使用既有的内存过滤，不再查询 `byFavorite` 索引，并补充回归断言；界面原本未调用该 API，故无用户可见影响。
- [x] `service-worker.js` 的 `handleContextSaveCollection` 曾在读取本地集合失败时静默返回。已在 `3.3.0` 修复：读取与写入失败都会写入 `contextMenuDiagnostic`，并通知已打开的侧边栏提示用户。

## Known defects (found by the 2026-09-11 real-browser acceptance)

- [x] `listImages({ favoriteOnly: true })` in `library.js` used to call `IDBKeyRange.only(true)`, but `favorite` is stored as a boolean and booleans are not valid IndexedDB keys, so the call threw `DataError` and the exported `countFavorites()` was unusable. It now uses the existing in-memory filter and no longer queries the `byFavorite` index, with a regression assertion added. The UI never called this API, so there was no user-visible impact.
- [x] `handleContextSaveCollection` in `service-worker.js` used to return silently when reading local collections failed. Fixed in `3.3.0`: both read and write failures are recorded to `contextMenuDiagnostic` and reported to an open side panel.

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

## 1.5.0

### 素材库工作流增强

- [x] 支持在素材库当前筛选结果中批量下载图片或生成 ZIP。
- [x] 支持按最小/最大宽高和文件大小范围筛选素材库。
- [x] 支持将当前素材库筛选结果导出为 JSON 或 CSV。

## 1.6.0

### 国际化与性能优化

- [x] 完善弹窗、卡片、历史、任务中心、错误提示和右键菜单的中英文翻译。
- [x] 根据浏览器语言自动选择初始界面语言，并保留手动切换和本地偏好。
- [x] 优化页面图片扫描：限制 CSS 候选和像素指纹计算数量，并分批探测原图尺寸。
- [x] 优化素材库筛选和渲染：合并高频筛选刷新并使用 `DocumentFragment` 批量渲染。
- [x] 优化 IndexedDB 批量读写和图片元数据探测，减少重复事务和 HEAD 请求。
- [x] 增加必要的性能回归检查，确保扫描、筛选和下载行为保持可用。

## 1.7.0

### 智能筛选与下载可靠性

- [x] 增加横向、纵向和正方形宽高比筛选，并支持保存到筛选预设。
- [x] 普通下载和 ZIP 下载支持备用图片地址，网络失败时自动重试一次。
- [x] 侧边栏动态扫描发现新图片时给出提示，方便处理懒加载页面。
- [x] 更新扩展版本号和中英文使用文档。

### 后续版本候选

- [x] 图片永久缓存，原地址失效后仍可在素材库预览。
- [x] 预览失败时提供手动重试、缓存回退和网页地址打开操作。
- [x] 扫描过程区分页面读取、图片发现和尺寸探测状态，并为尺寸探测设置超时保护。
- [x] 智能集合，根据尺寸、格式、域名和日期自动归档（已在 1.9.0 完成）。
- [x] 增加文件大小和宽高比的可视化范围筛选（已在 1.9.0 完成）。

## 1.8.0

### 本地缓存与预览可靠性

- [x] 使用 IndexedDB 保存成功预览或 ZIP 读取的图片数据，单张最多 20 MB，总缓存最多 120 MB。
- [x] 网页图片地址失效时，预览自动回退到本地缓存，并在设置页显示缓存数量和占用空间。
- [x] 缓存按最近使用时间自动清理，清空素材库时同步清除缓存。
- [x] 预览失败时支持重新加载和使用网页地址打开，并修复错误状态下的多语言文案覆盖问题。
- [x] 将扫描阶段明确显示为读取页面、发现图片和探测尺寸，尺寸探测超时不会让界面永久 loading。

## English

This document tracks the current `3.4.0` release and future versions. Completed items use `[x]`; unchecked items are planned or still need verification.

Last updated: 2026-09-11

## Current status

- [x] `2.7.0` stability and task-reliability work is complete and released.
- [x] `2.8.0` smart-collection and visual-filter enhancements are complete and released.
- [x] `2.9.0` primary-workspace focus and UI refinement are complete and released.
- [x] `3.0.0` multi-page collection workflows are implemented and released; real Chrome interaction regression remains a continuous validation item.
- [x] `3.2.0` release quality and real-browser acceptance are complete; the two defects it found are fixed in `3.2.1`.
- [x] `3.2.1` metadata coverage and index cleanup are released.
- [x] `3.2.2` side panel shortcut reliability is released.
- [x] `3.3.0` silent truncation cleanup, CI, and README Chinese/English sync are complete.
- [x] `3.3.1` interface language completeness is complete.
- [x] `3.4.0` primary view layout restructure is complete.

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

### 1.5.0 library workflow improvements

- [x] Download selected images or create a ZIP from the current library results.
- [x] Filter library images by minimum/maximum dimensions and file-size range.
- [x] Export the current library results as JSON or CSV.

### 1.6.0 internationalization and performance

- [x] Complete Chinese and English translations for the popup, cards, history, task center, errors, and context menus.
- [x] Select the initial language from the browser locale while preserving manual switching and the local preference.
- [x] Optimize page scanning by limiting CSS candidates and pixel fingerprints and probing original dimensions in batches.
- [x] Optimize library filtering and rendering with coalesced refreshes and batched `DocumentFragment` rendering.
- [x] Optimize IndexedDB bulk reads/writes and image metadata inspection to reduce transactions and duplicate HEAD requests.
- [x] Add the necessary performance regression checks while preserving scan, filter, and download behavior.

## 1.7.0

### Smart filtering and reliable downloads

- [x] Add landscape, portrait, and square aspect-ratio filters and save them in filter presets.
- [x] Try fallback image URLs and retry once automatically for regular and ZIP downloads.
- [x] Notify users when dynamic side-panel scans discover new images on lazy-loaded pages.
- [x] Update the extension version and Chinese/English usage documentation.

### Future candidates

- [x] Permanently cache image data so library previews survive expired source URLs.
- [x] Add manual preview retry, cached fallback, and page-URL opening actions.
- [x] Expose page-reading, image-discovery, and dimension-checking scan states with a timeout guard.
- [x] Add smart collections that automatically group images by dimensions, format, hostname, or date.
- [x] Add visual range controls for file size and aspect ratio.

## 1.9.0

### 智能集合、可视化筛选与大页面性能

- [x] 素材库根据尺寸、格式、网站和更新时间动态生成智能集合。
- [x] 当前页面和素材库支持文件大小、宽高比范围滑块，并保留精确数值输入。
- [x] 图片网格采用分批渲染和“加载更多”，降低大页面的首次渲染压力。

## 1.9.0 smart collections, visual filters, and large-page performance

- [x] Generate smart collections from dimensions, formats, hostnames, and update dates.
- [x] Add visual file-size and aspect-ratio range sliders while keeping precise numeric inputs.
- [x] Render image grids in batches with a Load more action to keep large pages responsive.

## 2.0.0 configurable scanning and site adapters

### 中文

- [x] 支持包含/排除 CSS 选择器，允许用户按页面结构定制扫描范围。
- [x] 支持单独开关 CSS 背景图、视频封面和 iframe 扫描。
- [x] 支持按域名保存站点适配规则、自定义图片选择器和额外图片属性。
- [x] 支持站点规则匹配后自动归档到素材集合。
- [x] 支持可选的 Chrome 设置同步，明确不上传图片、缓存和历史记录。
- [x] 保留默认扫描器并兼容格式错误的选择器，避免自定义规则阻塞正常扫描。

### English

- [x] Add include/exclude CSS selectors for site-specific scan scopes.
- [x] Add independent switches for CSS backgrounds, video posters, and iframe scanning.
- [x] Save host-based site adapters with custom image selectors and extra image attributes.
- [x] Automatically archive matching scan results into a local collection.
- [x] Add optional Chrome settings sync without syncing images, cache, or history.
- [x] Preserve the default scanner and ignore malformed selectors without blocking a scan.

## 1.8.0 local cache and preview reliability

- [x] Store successfully previewed or ZIP-read image data in IndexedDB, with 20 MB per item and 120 MB total limits.
- [x] Fall back to local cached data when a page image URL expires, and show cache count and usage in Settings.
- [x] Evict the least recently used cached entries automatically and clear cached data with the library.
- [x] Add reload and page-URL actions to the preview failure state, including localized labels.
- [x] Show explicit page-reading, image-discovery, and dimension-checking states; dimension timeouts no longer leave the UI loading forever.

## 2.1.0 source filters and configuration portability

### 中文

- [x] 按 `IMG`、`CSS`、`VIDEO`、自定义规则和其它来源筛选当前页面图片，并显示来源数量。
- [x] 来源筛选与尺寸、格式、宽高比、原图候选和搜索条件组合使用，清除筛选和重新扫描时恢复默认状态。
- [x] 导出扫描规则、站点适配器和下载偏好为 JSON 配置文件。
- [x] 从 JSON 配置文件导入扫描规则、站点适配器和下载偏好，导入后自动重新扫描当前页面。
- [x] 配置迁移不包含图片、缓存、素材集合和历史记录。

### English

- [x] Filter current-page images by `IMG`, `CSS`, `VIDEO`, custom rules, and other discovery sources with per-source counts.
- [x] Combine source filters with dimensions, format, aspect ratio, original candidates, and search; reset source selection when filters are cleared or a scan restarts.
- [x] Export scan rules, site adapters, and download preferences as a JSON configuration file.
- [x] Import scan rules, site adapters, and download preferences from JSON and rescan the current page after import.
- [x] Keep images, cache, collections, and history out of configuration migration files.

## 2.2.0 preview navigation and batch URL copying

### 中文

- [x] 支持在大图预览中浏览当前筛选结果的上一张和下一张图片。
- [x] 支持使用键盘左右方向键切换预览图片，并显示当前位置和总数量。
- [x] 支持复制当前筛选结果或已选图片的图片 URL，每行一个地址。
- [x] 素材库预览使用当前素材库结果作为导航范围，避免与当前页面结果混用。

### English

- [x] Browse previous and next images from the current filtered results in the large preview.
- [x] Navigate previews with the left and right arrow keys and show the current position and total count.
- [x] Copy image URLs for the current filtered results or selected images, one URL per line.
- [x] Use the current library results as the navigation scope for library previews instead of mixing them with page results.

## 2.3.0 current-page batch management

### 中文

- [x] 支持在当前页面批量收藏已选图片。
- [x] 支持为当前页面已选图片批量添加标签，并保留原有标签。
- [x] 支持将当前页面已选图片批量归档到本地集合，并保留原有集合关系。
- [x] 当前页面批量操作与素材库共享 IndexedDB 数据，操作后立即同步到素材库视图。

### English

- [x] Favorite selected images from the current-page result grid in one operation.
- [x] Add a tag to selected current-page images without removing existing tags.
- [x] Archive selected current-page images into a local collection without removing existing memberships.
- [x] Share the same IndexedDB records with the Library view so batch changes appear immediately.

## 2.4.0 current-page batch action dialog

### 中文

- [x] 使用扩展内对话框替代当前页面批量标签和集合归档的原生 prompt。
- [x] 显示已选图片数量，校验空输入，并支持确认、取消、遮罩点击和 Esc 关闭。
- [x] 批量归档前重新读取本地集合，避免集合加载时序导致选择列表过期。

### English

- [x] Replace native prompts with an in-extension dialog for current-page bulk tagging and collection archiving.
- [x] Show the selected image count, validate empty input, and support confirm, cancel, backdrop click, and Escape dismissal.
- [x] Reload local collections before bulk archiving so the chooser does not use stale initialization data.

## 2.5.0 library selection and batch safety

### 中文

- [x] 增加素材库当前筛选结果反选和清除全部选择操作。
- [x] 批量标签自动清理空白、限制长度并去重。
- [x] 批量归档追加集合关系，不删除图片已有集合；批量操作期间锁定控件并在结束后恢复。

### English

- [x] Add invert-selection and clear-selection actions for the current filtered library results.
- [x] Normalize, limit, and deduplicate tags during library bulk tagging.
- [x] Add collection memberships without removing existing ones, and lock library batch controls until the operation finishes.

## 2.6.0 download diagnostics and recovery

### 中文

- [x] 增加文件冲突处理策略：自动重命名、覆盖已有文件或每次询问，并保存到配置迁移和同步设置。
- [x] 下载任务保存逐项失败信息和错误分类，任务中心展示失败详情。
- [x] 失败任务只重试失败项，不再重复下载已经成功的图片。
- [x] 支持复制失败图片 URL，并导出 JSON 错误报告。
- [x] 预览失败时显示尝试地址数量和常见失败原因提示。

### English

- [x] Add file-conflict strategies: automatic rename, overwrite, or ask every time; include the setting in configuration migration and sync.
- [x] Store per-item failure details and error categories, then show them in the task center.
- [x] Retry only failed items instead of downloading already successful images again.
- [x] Copy failed image URLs and export a JSON error report.
- [x] Show the number of attempted preview URLs and common failure causes when a preview fails.

## 2.7.0 stability and task reliability

### 中文

- [x] 统一扫描状态机，明确区分读取页面、发现图片、探测尺寸、完成、取消和失败状态。
- [x] 为页面读取、图片发现、尺寸探测和预览请求增加超时、取消和最终状态保护，避免界面永久显示 loading。
- [x] 在侧边栏或 Service Worker 重启后恢复任务状态，并保留已完成、失败和取消的任务记录。
- [x] 优化预览失败状态：显示尝试过的地址、可读失败原因、HTTP 状态（如果可获得），并提供重试和打开原网页操作。
- [x] 限制普通下载和 ZIP 读取的并发数量，避免大批量下载时占用过多内存或触发网站限制。
- [x] 下载前显示图片数量、可估算的总大小和 ZIP 风险提示；下载过程中显示速度和预计剩余时间。
- [x] 大页面使用虚拟列表或更细粒度的分批渲染，并显示发现、去重、跳过和失败数量统计。
- [x] 增加刷新、语言切换、空结果、预览失败、下载失败和 Service Worker 重启场景的回归检查。

### English

- [x] Unify the scan state machine and distinguish page reading, image discovery, dimension probing, completed, cancelled, and failed states.
- [x] Add timeout, cancellation, and terminal-state guards for page reading, image discovery, dimension probing, and preview requests so the UI cannot remain in loading forever.
- [x] Restore task state after the side panel or Service Worker restarts, while keeping completed, failed, and cancelled task records.
- [x] Improve preview failure states with attempted URLs, readable failure reasons, HTTP status when available, retry, and open-source-page actions.
- [x] Limit concurrency for regular downloads and ZIP reads to reduce memory pressure and avoid triggering site limits.
- [x] Show the image count, estimated total size, and ZIP risk warnings before downloading; show speed and estimated time remaining during downloads.
- [x] Use virtualized or finer-grained batched rendering for large pages and show discovered, deduplicated, skipped, and failed counts.
- [x] Add regression checks for refresh, language switching, empty results, preview failures, download failures, and Service Worker restarts.

## 2.8.0 smart collections and visual filters

### 中文

- [x] 已具备按尺寸、格式、域名和更新时间生成基础智能集合的能力（`1.9.0` 完成）。
- [x] 当前页面和素材库已具备文件大小、宽高比范围滑块，并保留精确数值输入（`1.9.0` 完成）。
- [x] 将来源、文件大小和宽高比条件纳入智能集合规则，并支持与现有尺寸、格式、域名和日期条件组合。
- [x] 支持智能集合的 AND / OR 条件组合、启用/禁用、规则编辑和删除。
- [x] 提供智能集合命中预览，并支持手动重新应用规则。
- [x] 支持将智能集合规则保存到配置迁移文件，并在导入后校验规则版本。
- [x] 在范围滑块上显示图片数量分布，并提供小于 100 KB、100 KB～1 MB、横图、竖图和正方形等快捷预设。
- [x] 页面、素材库和智能集合共用尺寸、文件大小和宽高比匹配逻辑，并提供将当前页面筛选同步到素材库的入口。

### English

- [x] Provide baseline smart collections by dimensions, formats, hostnames, and update dates (`1.9.0`).
- [x] Provide file-size and aspect-ratio range sliders in the current-page and Library views while keeping precise numeric inputs (`1.9.0`).
- [x] Extend smart-collection rules with discovery sources, file sizes, and aspect ratios, and combine them with the existing dimension, format, hostname, and date conditions.
- [x] Support AND / OR condition groups, enabling, disabling, editing, and deleting smart-collection rules.
- [x] Provide a rule-match preview and allow users to reapply smart-collection rules manually.
- [x] Include smart-collection rules in configuration migration and validate their rule version after import.
- [x] Show image-count distribution on range controls and provide presets such as under 100 KB, 100 KB–1 MB, landscape, portrait, and square.
- [x] Share dimension, file-size, and aspect-ratio matching logic between the current page, Library, and smart collections, and provide an action to apply current-page filters to the Library.

## 2.9.0 focused primary workspace

### 中文

- [x] 重构侧边栏首屏层级：优先展示当前页面、扫描状态、图片结果和下载操作。
- [x] 将尺寸、格式、来源等精细筛选收纳为可展开面板，并在收起时显示当前筛选状态。
- [x] 将选择预设、ZIP 分组、文件命名、批量归档和导出等次级操作收纳到渐进式展开区域。
- [x] 强化图片网格、卡片选中状态、结果统计和下载按钮的对比度与可点击性。
- [x] 建立原始值、语义值和组件值三级 CSS 令牌，统一颜色、间距、圆角、阴影和焦点颜色。
- [x] 补齐中英文文案并检查 480 px 与窄侧栏的布局，保留键盘与无障碍语义。
- [x] 侧边栏文字跟随当前标签页的浏览器缩放比例和浏览器默认字号，不缩放整个侧边栏布局。

### English

- [x] Rework the side-panel hierarchy to prioritize the current page, scan state, image results, and download actions.
- [x] Place detailed size, format, and source filtering inside an expandable panel that preserves visible filter status when collapsed.
- [x] Place selection presets, ZIP layout, filename settings, batch actions, and export under progressive disclosure.
- [x] Improve contrast and hit areas for the image grid, selected cards, result statistics, and download actions.
- [x] Establish primitive, semantic, and component CSS tokens for color, spacing, radius, shadows, and focus treatment.
- [x] Complete Chinese and English labels, check 480 px and narrow side-panel layouts, and retain keyboard and accessible semantics.
- [x] Make side-panel text follow the active tab's browser zoom and default font size without scaling the whole panel layout.

## 3.0.0 multi-page collection workflows

### 中文

- [x] 支持采集当前标签页、选中的多个标签页或整个窗口中的图片。
- [x] 支持将多个页面的结果合并到同一下载任务，并按域名、页面或日期创建 ZIP 子目录。
- [x] 增加站点级采集历史和增量扫描，只处理上次扫描后新增或变化的图片。
- [x] 支持从扫描历史恢复筛选条件、重新打开来源页面和重新执行下载任务。
- [x] 支持导出为 Markdown 图库、HTML 图库和图片联系表。
- [x] 增加可配置快捷键和右键菜单中的“保存到指定集合”操作。
- [x] 完善深色模式、紧凑模式、焦点状态和键盘操作，提升无障碍体验。

### English

- [x] Collect images from the current tab, selected tabs, or the entire window.
- [x] Merge results from multiple pages into one download task and create ZIP subfolders by hostname, page, or date.
- [x] Add site-level scan history and incremental scanning that processes only new or changed images.
- [x] Restore filters from scan history, reopen source pages, and rerun download tasks.
- [x] Export image galleries as Markdown, HTML, or contact sheets.
- [x] Add configurable keyboard shortcuts and a context-menu action to save an image to a selected collection.
- [x] Improve dark mode, compact mode, focus states, and keyboard interaction for accessibility.

## 3.1.0 asset management and deduplication

### 中文

- [x] 增加基于文件内容哈希的精确去重，并在无法读取文件内容时回退到 URL 去重。
- [x] 增加基于感知哈希的相似图片分组，支持调整相似度阈值。
- [x] 显示重复图片组，并支持自动保留尺寸最大、文件最大或原图候选优先的版本。
- [x] 增加图片详情面板，展示完整 URL、候选地址、来源元素、iframe、MIME、文件大小、缓存状态和所属集合。
- [x] 支持从详情面板复制地址、打开来源页面、下载图片、编辑标签和调整集合关系。
- [x] 增加“仅清理失效图片”“仅清理未收藏图片”和“仅清理重复图片”等安全清理策略。
- [x] 明确区分“全选当前筛选结果”和“仅选择当前已加载结果”，并支持批量移动、移除标签和导出。

### English

- [x] Add exact deduplication based on file-content hashes, falling back to URL deduplication when file content cannot be read.
- [x] Group visually similar images with perceptual hashes and allow users to adjust the similarity threshold.
- [x] Show duplicate groups and allow automatic retention of the largest-dimension, largest-file, or original-candidate version.
- [x] Add an image details panel with full URLs, candidate URLs, source element, iframe, MIME type, file size, cache state, and collections.
- [x] Allow copying addresses, opening the source page, downloading, editing tags, and changing collection memberships from the details panel.
- [x] Add safe cleanup modes for invalid images, non-favorited images, and duplicate images.
- [x] Clearly distinguish “select all filtered results” from “select currently loaded results” and support bulk moving, tag removal, and export.

## 3.2.0 release quality and validation

### 中文

- [x] 增加可重复的扩展打包脚本，并在打包前校验 manifest、入口文件、图标和 JavaScript 语法。
- [x] 在开发文档中说明本地打包和发布前检查方式。
- [x] 建立真实 Chrome 核心流程回归清单，并记录当前页、多页面、历史和打包流程的实测结果。
- [x] 补齐 ZIP 和素材库流程的真机回归记录。
- [x] 在真实 Chrome 中手动验证三个快捷键的物理按键触发。
- [x] 评估扩展网站访问权限，补充跨域、防盗链、失效图片和异常响应的验收用例；结论为保留 `<all_urls>`。
- [x] 验证大页面、1000 张图片、缓存上限和大型 ZIP 的性能与稳定性。

### English

- [x] Add a reproducible extension packaging script that validates the manifest, entry points, icons, and JavaScript syntax before packaging.
- [x] Document local packaging and pre-release checks.
- [x] Establish a real Chrome regression checklist and record results for the current-page, multi-page, history, and packaging flows.
- [x] Complete real-device regression records for the ZIP and Library flows.
- [x] Manually verify the three physical keyboard shortcuts in real Chrome.
- [x] Review website access permissions and add acceptance cases for cross-origin, hotlink-protected, expired, and malformed image responses; the conclusion is to keep `<all_urls>`.
- [x] Verify performance and stability with large pages, 1,000 images, cache limits, and large ZIP jobs.

## 3.2.1 metadata coverage and index cleanup

### 中文

- [x] 修复大页面元数据被静默截断的问题：文件大小与 MIME 探测上限由 300 张提升到 1000 张，与扫描上限和 ZIP 上限一致，popup 与 Service Worker 使用同一上限值。
- [x] 探测仍被截断时在扫描统计中显示未探测数量，不再静默丢弃。
- [x] 移除 `byFavorite` 死索引：`favorite` 是布尔值，而布尔值不是合法的 IndexedDB 键，该索引从未可查询；数据库版本升至 5 并在升级时删除既有索引。
- [x] 补充回归断言，锁定探测上限一致性、截断提示与索引移除。

### English

- [x] Fix silent metadata truncation on large pages: raise the file-size and MIME inspection ceiling from 300 to 1,000 images, matching the scan limit and the ZIP limit, with the popup and Service Worker sharing one ceiling value.
- [x] Surface the not-inspected count in the scan statistics instead of dropping it silently.
- [x] Remove the dead `byFavorite` index: `favorite` is a boolean and booleans are not valid IndexedDB keys, so the index was never queryable; bump the database version to 5 and delete the index during upgrade.
- [x] Add regression assertions locking the shared ceiling, the truncation notice, and the index removal.

## 3.2.2 side panel shortcut reliability

### 中文

- [x] 修复快捷键无法打开侧边栏：`sidePanel.open()` 要求用户手势，而命令处理函数在调用前有两次 `await`，手势过期后 `open()` 抛错，又被空 `catch` 静默吞掉。现在在监听器内同步调用 `open()`，让面板抢在手势有效期内打开。
- [x] 同步跟踪当前活动标签页 id（`onActivated` / `onFocusChanged` / `onInstalled` / `onStartup`），Service Worker 冷启动时回退到查询路径。
- [x] 快捷键失败不再静默：记录 `{command, stage, message, at}` 到 `chrome.storage.local.shortcutDiagnostic` 并输出到控制台；`open()` 失败也不再终止后续扫描投递。
- [x] 将 `Ctrl+Shift+J` 改绑到保留命令 `_execute_action`，使侧边栏可以打开也可以关闭：`sidePanel` 没有 `close()` API，自定义命令只能打开，而 Chrome 的图标动作原生支持切换。`open-collector` 保留为默认未绑定命令。
- [x] 在真实 Chrome 中验证三个快捷键（`Ctrl+Shift+J` / `Ctrl+Shift+Y` / `Ctrl+Shift+U`）的物理按键触发。
- [x] 补充回归断言：面板必须在首个 `await` 之前打开、`_execute_action` 携带开关键、静默 `catch` 不得回归。

### English

- [x] Fix shortcuts failing to open the side panel: `sidePanel.open()` requires a user gesture, the command handler awaited twice before calling it, the gesture expired, `open()` rejected, and an empty `catch` swallowed the error. The panel is now opened synchronously inside the listener so it lands inside the gesture.
- [x] Track the active tab id synchronously (`onActivated` / `onFocusChanged` / `onInstalled` / `onStartup`), with a query fallback for a cold service worker.
- [x] Shortcut failures are no longer silent: `{command, stage, message, at}` is recorded to `chrome.storage.local.shortcutDiagnostic` and logged, and a failed `open()` no longer aborts the scan delivery.
- [x] Rebind `Ctrl+Shift+J` to the reserved `_execute_action` command so the side panel can be opened and closed: the side panel API has no `close()`, a custom command can only open, while Chrome's action toggles natively. `open-collector` stays available but unbound by default.
- [x] Verify all three shortcuts (`Ctrl+Shift+J` / `Ctrl+Shift+Y` / `Ctrl+Shift+U`) with physical key presses in real Chrome.
- [x] Add regression assertions: the panel must open before the first `await`, `_execute_action` must carry the toggle key, and the silent `catch` must not return.

## 3.3.0 silent truncation cleanup and CI

### 中文

- [x] 重复图片组列表不再静默截断：默认显示 30 组并提供“加载更多”，被隐藏的组数可见。
- [x] 智能集合在新建与导入时不再静默丢弃第 50 条之后的内容：新增数量守卫，并提示被截断的数量。
- [x] 修复右键“保存到指定集合”在读取本地集合失败时的静默返回：记录诊断，并在侧边栏打开时提示用户。
- [x] 增加回归约束：用户可见的集合上限必须使用具名常量并配有可见提示，杜绝新的静默截断。
- [x] 增加 GitHub Actions 流水线，运行零依赖回归测试、打包校验与 README 中英同步检查。
- [x] 把 README 中英结构同步纳入自动检查（章节数量、编号步骤、代码块一致性），并修复该检查发现的“开发和调试”缺失打包说明。
- [x] 收敛 README 中英文内容差异：删除中文「使用方法」里 31 条错位英文、6 个空英文占位标题和 1 个空重复分组；英文「功能」补齐到 68 条，英文「使用方法」补齐 8 个缺失分组并并入 1.9.0 内容，达到与中文一一对应的 25 个分组。结构奇偶（章节、分组、编号步骤、代码块）与跨语言泄漏已纳入回归断言。

### English

- [x] Stop silently truncating the duplicate-group list: show 30 groups by default with a Load more action so the hidden count is visible.
- [x] Stop silently dropping smart collections beyond 50 when creating or importing: add a count guard and report the truncated number.
- [x] Fix the silent return when the context-menu "save to a selected collection" action cannot read local collections: record a diagnostic and surface it while the side panel is open.
- [x] Add a regression constraint: user-visible collection caps must use a named constant and ship a matching notice, so no new silent truncation can slip in.
- [x] Add a GitHub Actions pipeline that runs the dependency-free regression tests, the packaging validation, and the README Chinese/English sync check.
- [x] Bring README Chinese/English structure sync under automated checking (section count, numbered steps, code fences) and fix the missing packaging instructions the check found in "Development and debugging".
- [x] Close the README content gap: removed 31 misplaced English entries, 6 empty English stub headings, and 1 empty duplicate group from the Chinese "How to use it" section; expanded English "Features" to 68 and added the 8 missing English groups (plus the merged 1.9.0 content) so both halves carry the same 25 groups in the same order. Structural parity (sections, groups, numbered steps, code fences) and cross-language leakage are enforced by the regression suite.

## 3.3.1 interface language completeness

### 中文

- [x] 把全部用户可见的硬编码中文移入翻译表：重复组/相似组标题与“保留”标记、清理确认框与提示、移除标签提示、图片详情字段标签、尺寸未知占位等。
- [x] 把超时与失败提示文案（读取字号、缩放比例、标签页列表、扩展设置、同步设置、任务状态恢复）移入翻译表。
- [x] 把 popup 中 `language === 'en' ? ... : ...` 形式的内联三元改为 `t()`，注入到页面执行的收集器除外（该上下文没有 `t()`）。
- [x] 数据层的 IndexedDB 失败文案按语言返回，或在 UI 边界统一包装，确保英文界面不出现中文。
- [x] 缓存写入失败不再静默：配额或写入错误写入诊断并在界面提示。
- [x] 增加门禁断言：`TRANSLATIONS` 与 `WORKER_TRANSLATIONS` 区块之外不得出现中文文案字面量，并保留显式白名单（错误匹配正则、注入脚本）。
- [x] 在真实浏览器中以英文界面遍历主要视图与对话框，确认不出现中文文案。

### English

- [x] Move every user-visible hardcoded Chinese string into the translation table: duplicate/similar group headings and the keep marker, the cleanup confirm dialog and its toast, the tag-removal prompt, details-panel field labels, and the unknown-dimensions placeholder.
- [x] Move the timeout and failure copy (font-size, zoom, tab list, extension settings, sync settings, task-state recovery) into the translation table.
- [x] Replace `language === 'en' ? ... : ...` inline ternaries in the popup with `t()` calls, except inside the injected page collector, where `t()` is unavailable.
- [x] Make the data layer's IndexedDB failure copy language-aware, or wrap it at the UI boundary, so the English interface never shows Chinese.
- [x] Stop swallowing cache write failures: report quota or write errors to the diagnostic channel and surface them in the UI.
- [x] Add a regression assertion: no Chinese copy literals may appear outside the `TRANSLATIONS` and `WORKER_TRANSLATIONS` blocks, with an explicit allowlist for error-matching regexes and the injected script.
- [x] Drive the main views and dialogs in a real browser with the English UI and confirm no Chinese copy appears.

## 3.4.0 primary view layout restructure

### 中文

- [x] 重构首屏层级：顶栏只保留品牌、当前页面、扫描与语言切换，五个视图标签压缩为图标按钮并与其同行。
- [x] 页面摘要并入顶栏：单行显示图标、标题与结果数量，点击可展开完整地址。
- [x] 把多页面采集面板移出首屏主路径，改放到结果区之后。
- [x] 结果标题与搜索排序合并为一行，筛选状态与选择工具收纳为该行的图标入口。
- [x] 让图片网格占据固定壳体内的剩余高度并自行滚动，消除整页滚动；实测 420 px 视口下结果区起点由 530 px 上移到 287 px，网格高度保持约 371 px。
- [x] 保持全部既有控件 id、键盘可达性与中英文案不变，全部回归断言通过。

### English

- [x] Rework the first screen: the top bar keeps only the brand, current page, scan action, and language switch, with the five view tabs as icon buttons on the same row.
- [x] Fold the page summary into the top bar: one line with the icon, title, and result count, expandable to reveal the full URL.
- [x] Move the multi-page collection panel out of the primary path, below the results area.
- [x] Merge the results heading with search and sort into one row, collapsing filter status and selection tools into icon entries on that row.
- [x] Let the grid take the remaining height inside a fixed shell and scroll internally, removing page scrolling; measured at 420 px the results now start at 287 px instead of 530 px while the grid height stays about 371 px.
- [x] Keep every existing control id, keyboard reachability, and bilingual copy unchanged, with all regression assertions passing.
