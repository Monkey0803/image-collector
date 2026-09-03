# Image Collector

> A lightweight Chrome extension for collecting images from the current webpage, filtering them by dimensions and format, and downloading selected images individually or as a ZIP archive.

[中文](#中文) · [English](#english)

---

## 中文

Image Collector 是一个基于 Chrome Manifest V3 的开源浏览器扩展。它可以扫描当前网页中的图片，显示图片尺寸和格式，并通过滑块、格式分类和选择操作快速找到需要的图片。

### 功能

- 扫描当前网页中的 `<img>` 图片和 CSS `background-image` 图片
- 显示图片预览、宽度、高度和文件格式
- 使用宽度和高度双滑块进行范围筛选
- 按 JPEG、PNG、WEBP、AVIF 和其它格式分类查看
- 单选、全选当前筛选结果或多选图片
- 单独下载某一张图片
- 将选中的图片合并下载为 ZIP
- 默认 ZIP 文件名为 `image_YYYY.MM.DD.zip`
- 下载时可选择保存位置，也可以使用 Chrome 默认下载目录
- 使用浏览器本地能力处理数据，不需要账号或服务器
- 原图优先识别 `srcset`、`picture`、懒加载属性和图片外链
- 按文件名、域名或 URL 搜索，并按尺寸、面积或文件名排序
- 使用像素指纹或规范化 URL 过滤重复图片
- 显示普通下载和 ZIP 任务进度，失败图片可以单独重试
- 扫描同页面的 iframe，并识别动态加载和懒加载图片
- 识别 `video poster`、`object` 嵌入图片和更多懒加载属性
- 支持“仅显示原图候选”筛选
- 异步显示图片文件大小和 MIME 类型
- ZIP 可按网站、格式或网站/格式建立子目录
- 可取消图片读取、ZIP 压缩和下载任务
- 可将当前筛选结果导出为 JSON 或 CSV 清单
- 支持自定义文件名模板，并可使用日期、域名、格式和尺寸变量
- 支持按 `YYYY.MM.DD` 自动创建日期目录
- 多个下载请求会进入后台队列，按顺序执行，避免任务互相干扰
- 对登录限制、防盗链、网络错误和服务器错误显示更具体的失败原因
- 使用 IndexedDB 保存本地图片素材、收藏、标签和历史记录
- 支持素材库搜索、收藏筛选和标签添加/移除
- 记录最近扫描页面以及图片/ZIP 下载活动
- 提供右键扫描页面、下载图片和收藏图片操作
- 点击缩略图打开大图预览，支持缩放、复制原图地址和新标签页打开
- 支持保存筛选预设、选择预设和反选当前结果
- 提供下载任务中心，可暂停、继续、取消和重试失败任务
- 支持创建自定义素材集合，并按集合浏览本地图片
- 支持中文/英文界面切换
- 支持收藏、标签和素材集合数据的 JSON 导入/导出
- 素材库支持多选、批量收藏、批量标签、批量归档和删除
- 素材库支持按格式、最小宽高筛选，并按文件大小、尺寸和更新时间排序
- 支持设置扫描上限，以及自动滚动加载懒加载图片
- 提供本地存储统计、清空素材库和重置扩展设置
- 支持快捷键：`⌘/Ctrl+A` 全选、`I` 反选、`/` 聚焦搜索、`R` 重新扫描
- 支持在素材库当前筛选结果中批量下载图片或生成 ZIP
- 素材库支持最小/最大宽高和文件大小范围筛选
- 支持将当前素材库筛选结果导出为 JSON 或 CSV
- 支持 Chrome 侧边栏模式，点击工具栏图标即可在当前网页旁打开
- 支持横向、纵向和正方形宽高比筛选
- 下载失败时自动尝试备用图片地址并重试一次
- 预览成功或 ZIP 读取成功后自动缓存图片，网页地址失效时仍可从素材库预览
- 预览失败时支持重新加载，或使用网页地址在新标签页打开
- 设置页显示本地缓存数量和占用空间，缓存会按最近使用时间自动清理
- 素材库提供智能集合，可按尺寸、格式、网站和日期自动归档筛选
- 当前页面和素材库支持文件大小、宽高比的可视化范围滑块
- 支持创建自定义智能集合，可组合尺寸、格式、网站、来源、文件大小、宽高比和日期条件
- 支持智能集合的 AND / OR 逻辑、命中预览、启用/禁用、编辑、删除和手动重新应用
- 范围筛选显示图片数量分布，并提供文件大小和宽高比快捷预设
- 大页面采用分批卡片渲染，点击“加载更多”后继续显示，减少打开扩展时的卡顿
- 支持自定义包含/排除选择器，以及 CSS 背景图、视频封面和 iframe 开关
- 支持按域名保存站点适配规则、自定义图片属性，并自动归档到素材集合
- 支持可选的 Chrome 设置同步，不同步图片、缓存和历史记录

### 安装方式

当前项目未发布到 Chrome Web Store，需要通过 Chrome 的“加载已解压的扩展程序”安装。

1. 下载或克隆本项目：

   ```bash
   git clone <your-repository-url>
   cd download_image
   ```

2. 打开 Chrome，访问 `chrome://extensions`。
3. 开启右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本项目根目录，也就是包含 `manifest.json` 的目录。
6. 安装完成后，建议点击扩展详情中的“固定”按钮，方便从工具栏打开侧边栏。

### 使用方法

#### 扫描网页图片

1. 在 Chrome 中打开需要处理的普通网页。
2. 等待网页内容加载完成。
3. 点击工具栏中的 Image Collector 图标，扩展会在浏览器右侧打开侧边栏。
4. 侧边栏会自动扫描当前页面并展示图片列表；你可以保持侧边栏打开，同时浏览和切换网页内容。
5. 如果页面图片是在扩展打开后才加载的，可以点击右上角的刷新按钮重新扫描。

#### 按尺寸筛选

在“按尺寸筛选”区域中，可以分别调整宽度和高度的最小值、最大值：

- 左侧滑块控制最小尺寸
- 右侧滑块控制最大尺寸
- 两个滑块重合或范围过窄时，列表可能为空
- 点击“清除”可以恢复为不限尺寸

尺寸通常使用图片的原始像素尺寸。CSS 背景图片无法获取原始尺寸时，会使用元素的渲染尺寸，或者显示为尺寸未知。

在“宽高比”筛选中可以选择全部比例、横向图片、纵向图片或正方形。宽高比接近 1:1 的图片会归入正方形；无法获取尺寸的图片不会匹配具体比例。

#### 按格式分类

点击格式分类按钮可以查看对应类型的图片：

- 全部
- JPEG
- PNG
- WEBP
- AVIF
- 其它（例如 GIF、SVG 或无法从地址判断的格式）

分类按钮上的数字表示该格式在当前尺寸筛选条件下的图片数量。

#### 图片缓存与预览失败处理

打开大图预览并成功加载后，扩展会在本地保存一份图片副本；读取图片生成 ZIP 时也会保存副本。缓存只保存在当前浏览器中，不会上传到服务器。单张图片超过 20 MB 时不会缓存，缓存总容量上限为 120 MB，空间不足时会优先清理最久未使用的缓存。

如果网页图片因为登录状态、防盗链或临时地址失效而无法再次加载，预览会自动尝试本地缓存。仍无法显示时，可以点击“重新加载”再次尝试所有地址，或点击“使用网页地址”直接在新标签页打开网页提供的图片地址。设置页会显示缓存数量和占用空间；清空素材库时会同时清除缓存。

#### 搜索和排序

图片列表上方提供搜索框和排序菜单：

- 搜索文件名、域名、URL、格式或图片来源。
- 按页面顺序查看，或按宽度、高度、面积从大到小查看。
- 也可以按文件名的字母顺序查看。

扫描时会优先尝试 `data-original`、`data-full`、`srcset`、`picture` 和图片外链中的原图地址。卡片中的“原图”标识表示该地址不是页面当前显示的缩略图地址。

扫描结果会自动过滤重复图片。同源图片优先使用缩小后的像素指纹判断重复内容；浏览器无法读取跨域图片像素时，会使用规范化后的图片 URL。

#### 选择和下载

- 点击图片卡片可以选择或取消选择图片。
- 点击“全选当前结果”可以选择当前筛选结果中的全部图片。
- 点击图片卡片右下角的下载按钮，可以只下载这一张图片。
- 点击“下载选中”，会分别下载选中的图片。
- 点击“下载 ZIP”，会将选中的图片合并为一个 ZIP 文件。
- 下载面板会显示当前任务进度；部分图片失败时，可以点击“重试失败项”。
- ZIP 分组可以选择不分组、按网站、按格式或按网站/格式。
- 下载任务进行中可以取消排队、图片读取、ZIP 压缩或下载任务。

文件名模板默认是 `{name}`，支持以下变量：

| 变量 | 含义 |
| --- | --- |
| `{name}` | 原始文件名，不含扩展名 |
| `{filename}` | 原始文件名，包含扩展名 |
| `{domain}` | 图片域名 |
| `{format}` | 图片格式 |
| `{width}` / `{height}` | 图片尺寸 |
| `{date}` | 当前日期，格式为 `YYYY.MM.DD` |

例如填写 `{domain}_{date}_{name}`，会生成类似 `example.com_2026.08.24_photo.jpg` 的文件名。开启“按日期建目录”后，普通下载会保存为 `2026.08.24/example.com_2026.08.24_photo.jpg`；ZIP 压缩包会保存为 `image_2026.08.24/image_2026.08.24.zip`，ZIP 内的图片也会放入对应日期目录。未知变量会被忽略，文件名中的非法字符会自动替换为下划线。

多个下载请求会由后台按提交顺序排队。当前任务完成或取消后，队列中的下一个任务会自动开始；排队中的任务也可以取消。

当部分图片失败时，失败列表会保留图片地址、失败阶段和可读原因，例如“需要登录后才能访问”“服务器拒绝访问，可能存在防盗链”或“图片服务器暂时不可用”。

#### 素材库和历史记录

点击顶部的“素材库”可以查看保存在本机的图片：

- 在图片卡片上点击星标即可收藏或取消收藏。
- 素材库默认显示收藏图片，也可以切换为全部图片。
- 可以搜索文件名、域名、格式、描述和标签。
- 在素材卡片下方输入标签，点击 `+` 添加；点击已有标签可以移除。
- “历史”视图会显示最近扫描页面、下载类型、数量、时间和结果状态。
- 清空历史只会删除扫描/下载记录，不会删除收藏图片和标签。

在网页上右键点击后，可以从 Image Collector 菜单中选择“扫描当前页面”“下载当前图片”或“收藏当前图片”。“扫描当前页面”会打开侧边栏并扫描当前页面；右键下载和收藏不需要先打开侧边栏。

#### 预览、预设和任务中心

- 点击任意图片缩略图可打开大图预览；预览窗口支持 `25%` 到 `400%` 缩放、复制原图地址和新标签页打开。
- 在筛选区域点击“保存筛选”可以保存当前尺寸、格式、搜索和排序条件；在选择区域可以保存当前图片选择结果。
- “任务”视图会列出排队中、进行中、暂停、完成和失败的下载。进行中的任务支持暂停、继续和取消，失败或部分失败任务可以重新提交。
- 任务列表和收藏数据均保存在浏览器本地，不会上传到服务器。

#### 素材集合与数据迁移

- 在“素材库”中点击“新建集合”创建本地图片集合，再通过每张卡片的集合下拉框归档图片。
- “全部集合”和“未分类”可以快速切换本地文件夹视图。
- “导出收藏数据”会生成包含收藏、标签和集合关系的 JSON；在另一台浏览器中使用“导入数据”可以合并恢复这些内容。
- 顶部 `EN` / `中` 按钮可切换界面语言，语言偏好会保存在本机。

#### 1.4.0 批量工作流

- 在“素材库”卡片左上角勾选图片后，可以批量收藏、添加标签、归档到集合或删除。
- 素材库支持按格式、最小宽度、最小高度和更新时间/尺寸/文件大小排序。
- 在筛选面板的“扫描上限”中限制本次采集数量；打开自动滚动后，扩展会滚动页面以触发懒加载内容，再恢复原滚动位置。
- “设置”视图显示本地素材统计，可清空素材库或重置扩展偏好。
- 常用键盘操作可以减少鼠标往返：`⌘/Ctrl+A` 全选当前页面结果，`I` 反选，`/` 聚焦搜索，`R` 重新扫描。

#### 1.5.0 素材库工作流增强

- 在素材库当前筛选结果中勾选图片后，可以直接批量下载图片或生成 ZIP；下载设置沿用当前页面的保存位置、文件名和 ZIP 分组配置。
- 素材库筛选面板支持最小/最大宽度、最小/最大高度，以及最小/最大文件大小（KB）。未知文件大小的图片不会匹配最小文件大小条件，但会保留在最大文件大小条件中。
- “导出筛选 JSON”和“导出筛选 CSV”只导出当前素材库筛选结果，不会修改素材库；“导出收藏数据”仍用于完整备份收藏、标签和集合关系。

#### 1.6.0 国际化与性能优化

- 弹窗、图片卡片、历史记录、任务中心、错误提示和右键菜单现在完整支持中文与英文。
- 未设置语言偏好时，扩展会根据浏览器语言自动选择初始语言；用户仍可通过右上角按钮手动切换，选择会保存在本机。
- 页面扫描会限制 CSS 背景图候选和像素指纹计算，并分批探测原图尺寸，减少大型页面打开扩展时的卡顿。
- 素材库筛选输入会合并短时间内的连续刷新，图片卡片使用批量 DOM 渲染；IndexedDB 和文件元数据探测也会复用批量操作与缓存。

ZIP 文件默认命名为：

```text
image_2026.08.20.zip
```

实际日期会根据下载当天自动生成。

#### 选择保存位置

打开“下载时选择保存位置”后，Chrome 会在下载时弹出保存对话框。关闭后，文件会保存到 Chrome 设置的默认下载目录。

这个设置会自动保存，下次打开扩展时继续使用上一次的选择。

#### 2.0.0 自定义规则与站点适配

2.0.0 增加了可配置扫描层，用于处理图片结构特殊的网站：

- 打开“设置”→“自定义扫描规则”，可以填写包含和排除 CSS 选择器，每行一个，例如 `.gallery img` 或 `.avatar`。
- 可以单独关闭“扫描 CSS 背景图”“扫描视频封面”或“扫描 iframe”，减少装饰性或嵌入内容带来的干扰。
- 在“站点适配与自动归档”中填写域名匹配，例如 `xiaohongshu.com` 或 `*.example.com`，再填写该网站的图片选择器，例如 `.note-container img`。
- “额外图片属性”支持逗号分隔的属性名，例如 `data-original,data-full`，适合原图地址不在 `src` 中的网站。
- 选择一个已有的本地集合后，匹配该网站的扫描结果会在扫描完成后自动归档到这个集合。
- 可以保存多个站点规则；相同域名和选择器再次保存时会更新原规则。
- 开启“使用 Chrome 同步”后，只同步扫描规则、站点适配器、扫描上限、自动滚动、ZIP 布局、文件名模板和日期目录设置；图片、缓存、集合和历史记录仍只保存在本机。

扫描流程为：读取配置 → 匹配当前域名的站点规则 → 采集默认和自定义图片地址 → 应用排除规则 → 探测元数据 → 自动归档。格式错误的选择器会被忽略，不会阻塞默认扫描。

#### 2.1.0 来源筛选与配置迁移

- 在当前页面筛选面板中，可以按图片来源筛选：`IMG`（页面图片元素）、`CSS`（CSS 背景图）、`VIDEO`（视频封面）、`规则`（自定义扫描规则）或“其它”。每个来源标签会显示当前尺寸筛选后的数量。
- 来源筛选会与宽度、高度、文件大小、宽高比、格式、原图候选和搜索条件叠加使用；清除筛选或重新扫描时会恢复为“全部来源”。
- 在“设置”→“扫描配置迁移”中点击“导出扫描配置”，可以备份扫描规则、站点适配器、扫描上限、自动滚动、ZIP 分组、文件名模板和日期目录设置。
- 在另一台设备或重新安装扩展后，点击“导入扫描配置”选择 JSON 文件即可恢复这些设置。导入成功后会自动重新扫描当前页面。
- 配置迁移文件不包含图片、图片缓存、素材集合或历史记录；配置文件只保存在用户选择的本地位置。

#### 2.1.0 source filters and configuration portability

- The current-page filter panel can filter images by discovery source: `IMG` (page image elements), `CSS` (CSS backgrounds), `VIDEO` (video posters), `Rule` (custom scan rules), or `Other`. Each source tab shows the count after the active dimension filters.
- Source filtering can be combined with width, height, file-size, aspect-ratio, format, original-candidate, and search filters. Clearing filters or rescanning returns to all sources.
- Open **Settings** → **Scan configuration portability** and choose **Export scan config** to back up scan rules, site adapters, scan limits, auto-scroll, ZIP layout, filename templates, and date-folder preferences.
- After reinstalling the extension or moving to another device, choose **Import scan config** and select the JSON file. The current page is rescanned after a successful import.
- Configuration files do not include images, image cache, collections, or history; they are downloaded to the local location selected by the user.

#### 2.2.0 preview navigation and batch URL copying

- When an image preview is open, use the previous/next buttons or the left/right arrow keys to browse the current filtered results. The position indicator shows the current image and total count.
- Preview navigation follows the active view: current-page previews browse current filtered results, while library previews browse the current library results.
- Use **Copy result URLs** below the download actions to copy the best available URL for each current result. If any images are selected, only the selected images are copied; otherwise all current filtered results are copied, one URL per line.

#### 2.2.0 预览导航与批量复制地址

- 打开图片大图预览后，可以使用上一张/下一张按钮或键盘左右方向键浏览当前筛选结果，位置指示器会显示当前图片序号和总数。
- 预览导航会跟随当前视图：当前页面预览浏览页面筛选结果，素材库预览浏览当前素材库结果。
- 点击下载操作下方的“复制当前结果 URL”可以复制当前结果中每张图片的最佳可用地址；如果已经勾选图片，则只复制已选图片，否则复制当前全部筛选结果，每行一个地址。

#### 2.3.0 current-page batch management

- Select images in the current-page result grid, then use **Favorite selected**, **Tag selected**, or **Archive selected** below the download actions.
- The favorite action writes selected images to the local library in one operation. The tag action adds one tag to all selected images without removing existing tags.
- The archive action lets you choose a local collection by number and adds the selected images to that collection without removing their existing collection memberships.
- These actions reuse the same local IndexedDB library as the Library view, so the updated favorites, tags, and collections are immediately available there.

#### 2.3.0 当前页面批量管理

- 在当前页面结果中勾选图片后，可以使用下载操作下方的“收藏选中”“给选中加标签”和“归档选中”。
- 批量收藏会一次性将选中图片写入本地素材库；批量加标签会为所有选中图片添加一个标签，不会删除已有标签。
- 批量归档会让用户按序号选择本地集合，并将选中图片加入该集合，不会删除图片已有的其它集合关系。
- 这些操作和素材库使用同一个本地 IndexedDB，完成后可以立即在“素材库”视图中查看结果。

#### 2.4.0 current-page batch action dialog

- Current-page tag and collection actions use an in-extension dialog instead of the browser's native prompt.
- The dialog shows the selected image count, validates empty input, and supports Escape, backdrop click, Cancel, and Confirm actions.
- Collection archiving reloads the latest local collections before opening the chooser, so newly created collections are available immediately.

#### 2.4.0 当前页面批量操作体验

- 当前页面的批量加标签和批量归档改用扩展内对话框，不再依赖浏览器原生输入框。
- 对话框显示已选图片数量，校验空标签，并支持按 Esc、点击遮罩、取消和确认操作。
- 打开集合选择器前会读取最新的本地集合，新建集合后可以立即用于归档。

#### 2.5.0 library selection and batch safety

- In the Library view, use **Invert current results** to invert selection for the current filtered result set, or **Clear selection** to remove all library selections.
- Library batch tags are trimmed, limited, and deduplicated; batch collection archiving adds a collection without removing existing memberships.
- Library batch controls are locked while an operation is running and recover after success, cancellation, or failure.

#### 2.5.0 素材库选择与批量安全

- 在“素材库”中可以使用“反选当前结果”反转当前筛选结果的选择状态，或使用“清除选择”取消全部素材选择。
- 素材库批量标签会自动去除首尾空格、限制长度并去重；批量归档会追加集合，不会删除已有集合关系。
- 批量操作执行期间控件会暂时锁定，成功、取消或失败后都会恢复。

#### 2.6.0 download diagnostics and recovery

- Choose how Chrome handles filename conflicts: **Rename automatically**, **Overwrite existing**, or **Ask every time**. The preference is saved and included in configuration migration and optional sync.
- The Download task center keeps per-image failure details and classifies common errors such as HTTP status failures, network failures, and missing URLs.
- Retrying a failed task retries only the failed images, so successful downloads are not duplicated.
- Use **Copy failed URLs** on a task or **Export error report** in the task center to continue troubleshooting outside the extension.
- Preview failures now explain how many image addresses were attempted and point to common causes such as hotlink protection, sign-in requirements, expired links, and cross-origin policy.

#### 2.6.0 下载诊断与恢复

- 支持选择文件冲突处理方式：自动重命名、覆盖已有文件或每次询问；设置会保存，并包含在配置迁移和可选同步中。
- 下载任务中心会保存每张失败图片的详细信息，并对 HTTP 状态错误、网络错误和缺少图片地址等常见问题进行分类。
- 重试失败任务时只重试失败图片，不会重复下载已经成功的图片。
- 可以在任务卡片中使用“复制失败 URL”，或在任务中心使用“导出错误报告”，方便在扩展外继续排查。
- 预览失败时会显示已尝试的图片地址数量，并提示防盗链、登录限制、链接失效和跨域策略等常见原因。

#### 2.7.0 稳定性与任务可靠性

- 扫描状态会明确区分读取页面、发现图片、探测尺寸、完成、取消和失败，不会因为单个阶段异常而永久显示 loading。
- 页面扫描和图片请求带有超时、取消及最终状态保护；即使尺寸探测失败，已经发现的图片仍然可以继续使用。
- 侧边栏重新打开或 Service Worker 重启后，任务中心会恢复本地任务记录；中断任务会被标记为失败，并可以只重试未完成项目。
- 预览失败时会显示尝试地址数量和可读的失败原因，并提供重新加载及打开网页地址操作。
- 下载任务保持队列化处理，避免同时读取过多图片；下载前会显示图片数量、已知大小和未知大小数量，大任务会给出提示。
- 下载进度会显示已处理数量、处理速度和预计剩余时间。
- 大页面会分批渲染，并显示发现、跳过、去重、尺寸探测和失败数量，降低界面卡顿。

#### 2.8.0 智能集合与可视化筛选

- 素材库支持创建自定义智能集合，可按尺寸、格式、网站域名、图片来源、文件大小、宽高比和添加日期建立规则。
- 支持使用 AND / OR 组合多个条件，并可预览命中数量、启用/禁用、编辑、删除或手动重新应用规则。
- 智能集合规则会随扫描配置导出和导入，并校验规则版本，避免不兼容配置静默生效。
- 文件大小和宽高比范围控件提供图片数量分布，以及小于 100 KB、100 KB～1 MB、横图、竖图和正方形快捷预设。
- 当前页面与素材库共用尺寸、文件大小和宽高比匹配逻辑，并可以将当前页面筛选同步到素材库。

### 权限说明

扩展在 `manifest.json` 中声明了以下权限：

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 访问用户当前主动打开的标签页 |
| `scripting` | 在当前页面执行图片扫描逻辑 |
| `downloads` | 下载图片和 ZIP 文件 |
| `storage` | 保存筛选条件和保存位置设置 |
| `contextMenus` | 提供网页和图片右键菜单操作 |
| `sidePanel` | 在 Chrome 右侧打开扩展侧边栏 |
| `<all_urls>` | 支持扫描不同网站中的网页图片及图片地址 |

所有图片筛选和列表处理都在浏览器本地完成。项目没有内置服务器，也不会主动上传网页内容或图片；只有在用户主动开启 Chrome 同步时，扫描规则和相关偏好才会交给 Chrome 的同步存储。

### 已知限制

- `chrome://`、Chrome Web Store、Chrome 设置页等受保护页面不允许扩展注入脚本，因此无法扫描。
- 侧边栏功能需要支持 Side Panel API 的较新版本 Chrome；如果浏览器版本过旧，扩展可能无法加载。
- 某些网页需要先允许扩展访问网站内容，或者需要在扩展详情中开启“允许访问文件网址”。
- 图片服务器的防盗链、登录限制、跨域策略或临时 URL 可能导致 ZIP 无法读取某些图片。
- 普通 URL 下载由 Chrome 直接处理，通常比 ZIP 下载兼容性更好。
- CSS `background-image` 可能只能显示元素渲染尺寸，无法确定图片的原始尺寸。
- 文件大小和 MIME 类型依赖图片服务器提供 `HEAD` 响应及相关响应头，未提供时不会显示。
- 页面中的懒加载图片只有在实际加载或出现在 DOM 中后，才可能被扫描到。
- iframe 扫描依赖当前扩展对对应 frame 来源拥有访问权限；受保护或沙盒 frame 可能无法注入。

### 从 GitHub 获取和更新

如果项目发布到 GitHub，用户可以选择以下方式：

- 在 GitHub 页面点击“Code” → “Download ZIP”，解压后加载解压目录。
- 使用 `git clone` 克隆仓库，更新时执行 `git pull`，然后在 `chrome://extensions` 中点击扩展的刷新按钮。

Chrome 不会像 Chrome Web Store 那样自动更新通过“加载已解压的扩展程序”安装的版本。

### 项目结构

```text
download_image/
├── manifest.json       # Chrome Manifest V3 配置、权限和扩展入口
├── popup.html          # 侧边栏页面结构（兼容 popup 命名）
├── popup.css           # 侧边栏 UI 样式、布局和交互状态
├── popup.js            # 图片扫描、筛选、分类、选择和下载请求
├── library.js          # IndexedDB 素材库、收藏、标签和历史记录数据层
├── service-worker.js   # 后台下载任务和 ZIP 文件生成
├── icons/
│   ├── icon.svg        # UI 使用的矢量图标
│   ├── icon-16.png     # 工具栏小图标
│   ├── icon-32.png     # 工具栏图标
│   ├── icon-48.png     # 扩展管理页图标
│   └── icon-128.png    # 扩展详情和安装页图标
├── LICENSE             # MIT 开源许可证
├── TODO.md             # 2.8.0 已完成任务和后续路线图
└── README.md           # 中文和英文项目文档
```

### 开发和调试

本项目不依赖构建工具或第三方 npm 包，修改文件后可以直接在 Chrome 扩展管理页重新加载。

提交代码前可以运行：

```bash
node --check popup.js
node --check service-worker.js
```

### 在 GitHub 上发布

1. 在 GitHub 创建一个新的空仓库，例如 `image-collector`。
2. 在当前项目目录初始化 Git 并提交代码：

   ```bash
   git init
   git add .
   git commit -m "chore: initial open source release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repository>.git
   git push -u origin main
   ```

3. 在 GitHub 仓库的“About”中补充项目简介和主题标签。
4. 建议创建一个 GitHub Release，并上传一个扩展 ZIP 包，方便用户直接下载。

打包时需要保证 ZIP 根目录直接包含 `manifest.json`，例如：

```bash
zip -r image-collector-1.0.0.zip \
  manifest.json popup.html popup.css popup.js service-worker.js icons
```

不要把整个项目目录再套一层，也不要把 `.git`、临时文件或编辑器配置文件打进扩展 ZIP。

### 许可证

本项目使用 MIT License，详见 [LICENSE](LICENSE)。

---

## English

Image Collector is an open-source Chrome extension built with Chrome Manifest V3. It scans images on the current webpage, displays their dimensions and formats, and helps you find and download selected images quickly.

### Features

- Scan `<img>` elements and CSS `background-image` images on the current webpage
- Display image previews, width, height, and file format
- Filter images with minimum and maximum width/height sliders
- Browse images by JPEG, PNG, WEBP, AVIF, or other formats
- Select individual images, select all current results, or select multiple images
- Download a single image
- Download selected images as one ZIP archive
- Use the default ZIP filename format `image_YYYY.MM.DD.zip`
- Choose a save location or use Chrome's default download directory
- Process image lists and filters locally in the browser without an account or server
- Prefer original sources from `srcset`, `picture`, lazy-loading attributes, and image links
- Search by filename, hostname, or URL and sort by dimensions, area, or filename
- Filter duplicates with pixel fingerprints or normalized URLs
- Show download progress and retry failed images
- Scan same-page iframes and discover dynamically loaded or lazy-loaded images
- Detect `video poster`, `object` embeds, and more lazy-loading attributes
- Filter to original-image candidates
- Display image file size and MIME type asynchronously
- Organize ZIP entries by hostname, format, or hostname and format
- Cancel image reading, ZIP compression, and download tasks
- Export current filtered results as JSON or CSV
- Store local image metadata, favorites, tags, scan history, and download history in IndexedDB
- Browse a local library with favorite filtering, search, and tag editing
- Provide context-menu actions for scanning pages, downloading images, and favoriting images
- Open a large-image preview with zoom, original-URL copying, and new-tab opening
- Save reusable filter presets and selection presets, and invert the current selection
- Use a download task center to pause, resume, cancel, and retry tasks
- Create custom local collections and browse images by collection
- Switch the interface between Chinese and English
- Import or export favorites, tags, and collection relationships as JSON
- Select library images in bulk to favorite, tag, archive, or delete them
- Filter the library by format and minimum dimensions, and sort it by file size, dimensions, or update time
- Set a scan limit and automatically scroll pages to trigger lazy-loaded images
- View local storage statistics, clear the library, or reset extension settings
- Use keyboard shortcuts: `Cmd/Ctrl+A` select all, `I` invert, `/` focus search, `R` rescan
- Download selected images or create a ZIP from the current library results
- Filter library images by minimum/maximum dimensions and file-size range
- Create custom smart collections with dimension, format, hostname, source, file-size, aspect-ratio, and date conditions
- Combine smart-collection conditions with AND / OR logic, preview matches, enable/disable, edit, delete, and reapply rules
- View image-count distributions for library ranges and use file-size or aspect-ratio presets
- Export the current library results as JSON or CSV
- Open the collector in Chrome's right side panel and keep it visible while browsing
- Filter images by landscape, portrait, or square aspect ratio
- Retry failed downloads once and try alternate image URLs when available
- Customize filenames with template variables for names, domains, formats, dimensions, and dates
- Create `YYYY.MM.DD` date folders for regular downloads and ZIP entries, and place ZIP archives under `image_YYYY.MM.DD/`
- Queue multiple download requests and run them in submission order
- Report clearer causes for authentication, anti-hotlinking, network, and server failures

### Installation

This project is distributed as an unpacked Chrome extension rather than through the Chrome Web Store.

1. Clone or download the project:

   ```bash
   git clone <your-repository-url>
   cd download_image
   ```

2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project root directory containing `manifest.json`.
6. Optionally pin Image Collector to the Chrome toolbar so it is easy to open the side panel.

### How to use it

#### Scan webpage images

1. Open a regular webpage in Chrome.
2. Wait for the page content to load.
3. Click the Image Collector icon in the toolbar; the extension opens in Chrome's right side panel.
4. The side panel scans the current page and displays the image grid while you continue browsing.
5. If images are loaded after the side panel opens, click the refresh button to scan again.

#### Filter by dimensions

Use the width and height range sliders in the filter panel:

- The left slider controls the minimum value.
- The right slider controls the maximum value.
- A very narrow or overlapping range may produce no results.
- Click **Clear** to remove all dimension limits.

The dimensions usually represent the image's intrinsic pixel size. When the original size of a CSS background image cannot be detected, the extension may use the element's rendered size or mark the dimensions as unknown.

Use the **Aspect ratio** filter to show all ratios, landscape images, portrait images, or square images. Images without known dimensions do not match a specific ratio.

#### Filter by format

Use the format tabs to show:

- All
- JPEG
- PNG
- WEBP
- AVIF
- Other, including GIF, SVG, and formats that cannot be identified from the URL

The number on each tab reflects the images matching the current dimension filters.

#### Search and sort

The controls above the image grid let you search filenames, hostnames, URLs, formats, and image sources. Results can be sorted by page order, width, height, area, or filename.

During scanning, the extension prefers original candidates from `data-original`, `data-full`, `srcset`, `picture`, and linked image URLs. An `Original` marker means that the selected URL differs from the thumbnail currently displayed by the page.

Duplicate results are filtered automatically. Same-origin images use a small pixel fingerprint when available; cross-origin images fall back to a normalized URL because browser security rules may prevent pixel access.

#### Select and download images

- Click an image card to select or deselect it.
- Click **Select all current results** to select every visible result.
- Click the download button on an image card to download only that image.
- Click **Download selected** to download selected images individually.
- Click **Download ZIP** to combine selected images into one ZIP archive.
- The download panel shows task progress. If some images fail, click **Retry failed items** to retry them with the same download mode.
- ZIP grouping can be flat, by hostname, by format, or by hostname and format.
- Queued, active image reading, ZIP compression, and download tasks can be cancelled.

The default filename template is `{name}`. Supported variables are:

| Variable | Meaning |
| --- | --- |
| `{name}` | Original filename without its extension |
| `{filename}` | Original filename including its extension |
| `{domain}` | Image hostname |
| `{format}` | Image format |
| `{width}` / `{height}` | Image dimensions |
| `{date}` | Current date in `YYYY.MM.DD` format |

For example, `{domain}_{date}_{name}` can produce `example.com_2026.08.24_photo.jpg`. When **Create date folder** is enabled, regular downloads use a path such as `2026.08.24/example.com_2026.08.24_photo.jpg`; ZIP archives use `image_2026.08.24/image_2026.08.24.zip`, and ZIP entries use the same date folder. Unknown variables are omitted and illegal filename characters are replaced with underscores.

Multiple download requests are processed by a background queue in submission order. The next task starts automatically when the current task completes or is cancelled, and queued tasks can also be cancelled.

When some images fail, the failure list keeps the URL, failure stage, and a readable reason such as “login required”, “access denied or anti-hotlink protection”, or “image server temporarily unavailable”.

#### Local library and history

Click **Library** at the top to browse images saved locally:

- Click the star on an image card to favorite or unfavorite it.
- The library defaults to favorites and can be switched to all saved images.
- Search filenames, hostnames, formats, descriptions, and tags.
- Type a tag below a library card and click `+` to add it; click an existing tag to remove it.
- The **History** view shows recent scans and image/ZIP downloads with counts, times, and statuses.
- Clearing history removes scan/download activity only; favorites and tags are preserved.

On a webpage, right-click to open the Image Collector menu. It provides **Scan current page**, **Download current image**, and **Favorite current image**. The scan action opens the side panel and scans the current page; context downloads and favorites work without opening the side panel first.

#### Preview, presets, and task center

- Click any thumbnail to open a large preview. The preview supports zoom from `25%` to `400%`, copying the original URL, and opening it in a new tab.
- Click **Save filter** to store the current dimension, format, search, and sort settings. The selection toolbar can store the current image selection as a reusable preset.
- The **Tasks** view lists queued, running, paused, completed, and failed downloads. Active tasks can be paused, resumed, or cancelled; failed and partial tasks can be submitted again.
- Task records and library data stay in the browser and are not uploaded to a server.

#### Collections and data migration

- Click **New collection** in the library to create a local image collection, then assign images with the collection selector on each card.
- Use **All collections** or **Uncategorized** to browse the local folder-style view.
- **Export library** creates a JSON file containing favorites, tags, and collection relationships. **Import data** merges the file into another browser profile.
- Use the `EN` / `中` button in the header to switch languages. The preference is stored locally.

#### 1.4.0 batch workflows

- Select library cards using the checkbox in the upper-left corner, then favorite, tag, archive, or delete them in bulk.
- Filter the library by format and minimum width/height, and sort it by update time, dimensions, or file size.
- Set a scan limit in the filter panel. Enable auto-scroll to trigger lazy-loaded content before restoring the original scroll position.
- The **Settings** view shows local storage statistics and provides actions to clear the library or reset extension preferences.
- Keyboard shortcuts reduce mouse travel: `Cmd/Ctrl+A` selects current results, `I` inverts, `/` focuses search, and `R` rescans.

#### 1.5.0 library workflow improvements

- Select images in the current library results to download them individually or create a ZIP. The current page download settings are reused for save location, filename template, and ZIP grouping.
- The library filter panel supports minimum/maximum width, minimum/maximum height, and minimum/maximum file size in KB. Images without a known size do not match a minimum-size filter, but remain eligible for a maximum-size filter.
- **Export filtered JSON** and **Export filtered CSV** export only the current library results without changing the library. **Export library** remains the full backup for favorites, tags, and collection relationships.

#### 1.6.0 internationalization and performance

- The popup, image cards, history, task center, errors, and context menus now have complete Chinese and English translations.
- When no language preference is stored, the extension chooses an initial language from the browser locale. Users can still switch manually from the header, and the preference is stored locally.
- Page scanning limits CSS background candidates and pixel fingerprint work and probes original dimensions in batches, reducing stalls on large pages.
- Library filter input coalesces rapid refreshes, image cards render in batches, and IndexedDB plus file metadata inspection reuse bulk operations and cache entries.

#### 1.8.0 local cache and preview reliability

- Successfully previewed images and images read for ZIP creation are stored in the browser's local IndexedDB cache. A single item is limited to 20 MB and the total cache is limited to 120 MB.
- If a page URL expires or hotlink protection blocks it, the preview automatically falls back to the cached copy when one is available.
- The Settings view shows cached image count and cache usage. Cached entries are evicted by least-recently-used order when the limit is reached, and clearing the library also clears cached files.
- When preview loading fails, use **Reload** to retry all candidates or **Use page URL** to open the page-provided image URL in a new tab.
- Scanning now reports separate page-reading, image-discovery, and dimension-checking stages. A dimension-check timeout no longer leaves the loading indicator active forever.

#### 1.9.0 smart collections and large-page performance

- The Library view includes Smart collections. These are generated from the current local metadata and group images by dimensions, format, hostname, or update date; they do not create duplicate files or require manual tagging.
- The current-page filter panel includes visual range controls for file size and aspect ratio. The Library view exposes the same controls and keeps the numeric KB inputs for precise adjustment.
- Image grids render an initial batch and reveal more cards only when requested. This keeps filtering and selection responsive when a page or library contains hundreds of images.
- Add custom include/exclude selectors and independent switches for CSS backgrounds, video posters, and iframes.
- Save host-based site adapters with custom image attributes and automatically archive matching results into local collections.
- Optionally sync scan rules and preferences with Chrome without syncing images, cache, or history.

The default ZIP filename is generated in this format:

```text
image_2026.08.20.zip
```

The date is generated automatically from the download date.

#### Choose a save location

When **Choose save location when downloading** is enabled, Chrome opens a save dialog for the download. When it is disabled, files are saved to Chrome's default download directory.

The setting is stored locally and reused the next time the extension is opened.

#### 2.0.0 custom rules and site adapters

Version 2.0.0 adds a configurable scanning layer for websites whose image structure differs from a standard `<img>` page:

- Open **Settings** → **Custom scan rules** to add include and exclude CSS selectors. Use one selector per line, for example `.gallery img` or `.avatar`.
- Turn off **Scan CSS backgrounds**, **Scan video posters**, or **Scan iframes** when decorative or embedded content should not be collected.
- Under **Site adapters & auto archive**, enter a host pattern such as `xiaohongshu.com` or `*.example.com`, then the site's image selector, such as `.note-container img`.
- The optional attribute field accepts comma-separated attributes such as `data-original,data-full`, which is useful when a site stores the full-size URL outside `src`.
- Select an existing local collection to automatically archive images from matching websites into that collection after scanning.
- You can save multiple site adapters. Saving the same host and selector updates the existing rule.
- **Use Chrome sync** synchronizes only scan rules, site adapters, scan limits, auto-scroll, ZIP layout, filename templates, and date-folder preference. Images, IndexedDB cache, collections, and history remain local to each browser profile.

The scan flow is: load saved configuration → match adapters for the current host → collect default and custom sources → apply exclusions → inspect metadata → archive matching results. Invalid selectors are ignored so the normal page scan can continue.

#### 2.7.0 stability and task reliability

- Scanning clearly distinguishes page reading, image discovery, dimension probing, completed, cancelled, and failed states, so one failed stage cannot leave loading active forever.
- Page scans and image requests have timeout, cancellation, and terminal-state guards; discovered images remain usable even when metadata probing fails.
- Reopening the side panel or restarting the Service Worker preserves local task records. Interrupted tasks are marked as failed and can retry only unfinished items.
- Preview failures show the number of attempted addresses and readable causes, with actions to reload or open the page-provided URL.
- Downloads remain queue-controlled to avoid reading too many images at once. Before downloading, the UI shows image count, known size, and unknown-size count, with a warning for large tasks.
- Download progress shows processed count, processing speed, and estimated time remaining.
- Large pages render in batches and report discovered, skipped, deduplicated, dimension-checked, and failed counts to reduce UI stalls.

#### 2.8.0 smart collections and visual filters

- The Library supports custom smart collections based on dimensions, format, hostname, discovery source, file size, aspect ratio, and added date.
- Combine multiple conditions with AND / OR logic, preview the match count, enable or disable rules, edit or delete them, and reapply them manually.
- Smart-collection rules are included in scan-configuration export/import and carry a validated rule version to prevent incompatible data from being silently applied.
- File-size and aspect-ratio range controls show image-count distributions and provide presets for under 100 KB, 100 KB–1 MB, landscape, portrait, and square images.
- The current-page and Library views share dimension, file-size, and aspect-ratio matching logic, with an action to apply current-page filters to the Library.

### Permissions

| Permission | Purpose |
| --- | --- |
| `activeTab` | Access the tab that the user is actively using |
| `scripting` | Run the image scanning logic in the current page |
| `downloads` | Download image files and ZIP archives |
| `storage` | Store filter and save-location preferences |
| `contextMenus` | Provide page and image context-menu actions |
| `sidePanel` | Open the extension in Chrome's right side panel |
| `<all_urls>` | Support image scanning across different websites and image hosts |

Image filtering and list processing happen locally in the browser. The project has no backend server and does not upload webpage content or images; only when the user explicitly enables Chrome Sync are scan rules and related preferences stored in Chrome's sync storage.

### Known limitations

- Protected pages such as `chrome://`, the Chrome Web Store, and Chrome settings pages do not allow script injection.
- The side-panel experience requires a recent Chrome version with the Side Panel API; older versions may reject the extension manifest.
- Some pages require access to be granted in the extension details page; local files may also require enabling access to file URLs.
- Anti-hotlinking, authentication requirements, cross-origin policies, or expiring URLs may prevent some images from being read into a ZIP archive.
- Regular URL downloads are handled directly by Chrome and are generally more compatible than ZIP downloads.
- CSS `background-image` entries may expose only the rendered element size rather than the original image size.
- File size and MIME type depend on the image server exposing `HEAD` metadata and may remain unavailable.
- Lazy-loaded images may not be detected until they have been inserted into the DOM or loaded by the page.
- Iframe scanning depends on access to the frame's origin; protected or sandboxed frames may reject injection.

### Getting and updating from GitHub

After the project is published on GitHub, users can either:

- Click **Code** → **Download ZIP** on GitHub, extract it, and load the extracted directory.
- Clone the repository with `git clone`, run `git pull` to update it, and click the extension's reload button in `chrome://extensions`.

Chrome does not automatically update extensions installed through **Load unpacked**.

### Project structure

```text
download_image/
├── manifest.json       # Manifest V3 configuration, permissions, and entry points
├── popup.html          # Side panel page structure (kept with the popup filename)
├── popup.css           # Side panel layout, styling, and interaction states
├── popup.js            # Scanning, filtering, categorization, selection, and messages
├── library.js          # IndexedDB data layer for metadata, favorites, tags, and history
├── service-worker.js   # Background downloads and ZIP generation
├── icons/
│   ├── icon.svg        # Vector icon used by the UI
│   ├── icon-16.png     # Small toolbar icon
│   ├── icon-32.png     # Toolbar icon
│   ├── icon-48.png     # Extensions management icon
│   └── icon-128.png    # Extension detail and installation icon
├── LICENSE             # MIT open-source license
├── TODO.md             # 2.8.0 checklist and future roadmap
└── README.md           # Chinese and English documentation
```

### Development and debugging

The project has no build step and no third-party npm dependencies. After editing a file, reload the extension from the Chrome extensions page.

Before committing changes, run:

```bash
node --check popup.js
node --check service-worker.js
```

### Publish on GitHub

1. Create a new empty GitHub repository, for example `image-collector`.
2. Initialize Git and push the project:

   ```bash
   git init
   git add .
   git commit -m "chore: initial open source release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repository>.git
   git push -u origin main
   ```

3. Add a short description and topics in the repository's **About** section.
4. Consider creating a GitHub Release and uploading an extension ZIP so users can download a ready-to-install package.

The ZIP must contain `manifest.json` at its root:

```bash
zip -r image-collector-1.0.0.zip \
  manifest.json popup.html popup.css popup.js service-worker.js icons
```

Do not wrap the extension files in an extra top-level project directory, and do not include `.git`, temporary files, or editor settings in the extension ZIP.

### License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
