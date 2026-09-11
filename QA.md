# Image Collector 3.2.0 验收清单

## 验收环境

- 浏览器：Google Chrome for Testing 153.0.8010.12（Playwright 1.63 自带构建）。
  品牌版 Chrome 153 已忽略 `--load-extension`，无法加载未打包扩展，故改用 Chrome for Testing；
  它是 Chrome 官方自动化构建，与品牌版同源，仅缺少品牌化和自动更新。
- 扩展：以未打包方式加载本目录，扩展 ID `gpolmchbgfboadmooajollklcblnpkhi`。
- 夹具：本地双源站（A = 图片源站，B = 第三方页面），覆盖跨域无 ACAO、防盗链 403、
  404/410、`text/html` 与 `application/octet-stream` 异常响应、302 重定向、永不响应的超时、
  30 MB 超大响应、1000/500 张压力页与 iframe 嵌套；远程用例使用 `placehold.co`。
- 驱动：Playwright 驱动真实浏览器加载 `popup.html`，通过真实 UI 点击触发扫描、全选、ZIP、
  素材库切换与设置导出；下载经 `chrome.downloads` 落到隔离目录后校验 ZIP 结构与完整性。
- 说明：验收夹具与驱动脚本属于一次性外部工具，未纳入本仓库，因此下面记录的结果无法仅凭
  仓库内容复现；环境、方法和逐项证据已完整记录在本文件，便于日后人工复核或重建夹具。

## 已验证（2026-09-11 真机自动回归，16/16 通过）

### 核心流程

- [x] Chrome 加载扩展并打开侧边栏页面。
- [x] 扫描当前页面并显示图片数量、尺寸、格式（发现 4 张，无错误）。
- [x] 当前页 ZIP 下载：4 个条目，`unzip -t` 完整性通过。
- [x] 素材库流程：批量收藏落库 → 素材库显示 4 条 → 从素材库下载 ZIP 4 个条目。
- [x] 侧边栏尚未初始化时的快捷键恢复：持久化的 `pendingShortcut` 被消费，并扫描当前活动标签页。
- [x] 打包脚本校验 manifest、入口文件、图标和 JavaScript 语法。
- [x] 打包文件可以通过 ZIP 完整性检查。

### 尺寸、压力与上限

- [x] 扫描上限调至 1000 后完成本地 1000 张压力页全量扫描：发现 1000 张，用时 2.9 s，
  分批渲染 120 张，界面响应 0 ms，JS 堆 44.5 MB → 22.7 MB。
- [x] 真实远程 500 张图片页面：发现 500 张，用时 6.4 s，全部取得尺寸；
  素材库持有 1534 条记录且筛选耗时 23 ms，JS 堆 101.9 MB → 38.5 MB。
- [x] 缓存上限：单张 25 MB 被拒绝；写入 7 × 19 MB 后总量被限制在 114 MB，最旧条目被淘汰。
- [x] 大型 ZIP 上限：12 × 30 MB 输入下 ZIP 未压缩总量 240 MB，未突破 256 MB 字节预算，
  超额 4 张归类为 `zip-limit` 失败，用时 16.8 s。

### 异常响应与权限

- [x] 跨域无 ACAO 图片：仍发现 3 张，ZIP 3 个条目且完整性通过（像素指纹回退到 URL 去重）。
- [x] 防盗链 403：2 张失败并归类为 `http-403`，提示“服务器拒绝访问，可能存在防盗链”，其余正常下载。
- [x] 异常 `Content-Type`：`text/html` 与 `application/octet-stream` 均归类为
  `invalid-content-type` 被拒绝；302 重定向正常跟随。
- [x] 失效地址：404 与 410 保留为可重试失败项（`http-404` / `http-410`），正常图片仍下载。
- [x] 请求超时：永不响应的图片在 10.6 s 内结束探测，界面不卡 loading；ZIP 仅含正常图片，
  失败归类为 `timeout`。
- [x] 受保护页面：`chrome://` 页面被标记为 partial 且不阻塞界面；`file://` 页面在本配置下
  可正常扫描（取决于扩展的“允许访问文件网址”权限）。
- [x] iframe 扫描：跨 frame 去重后得到 5 张（1 张顶层 + 2 个 iframe 内的 4 个唯一地址）。
- [x] 导出配置数据边界：导出文件仅含 `version`、`exportedAt`、`settings`，
  不含图片地址、`data:` 内容或缓存数据。
- [x] 清理操作确认门禁：确认框取消后素材数量保持不变。

## 待验证

- [ ] 在真实 Chrome 中手动按下三个快捷键（`Ctrl+Shift+Y` / `Ctrl+Shift+U` / `Ctrl+Shift+J`），
  确认物理按键触发。自动化只能验证 `chrome.commands.onCommand` 之后的恢复分支，
  无法合成浏览器级快捷键。
- [ ] 需要登录态的站点上的限流与防盗链行为（本次夹具未包含登录场景）。

## 本次验收发现的问题

- **`listImages({ favoriteOnly: true })` 与 `countFavorites()` 始终抛错**（原 `library.js:348`）。
  `favorite` 以布尔值存储，而布尔值不是合法的 IndexedDB 键，
  `IDBKeyRange.only(true)` 抛 `DataError: The parameter is not a valid key`。
  - 复现：素材库收藏任意图片后调用 `ImageCollectorDB.countFavorites()`。
  - 影响：仅是导出的数据层 API 缺陷。界面上的收藏数由 `popup.js:1078` 自行过滤计算，
    因此用户看不到异常；但任何调用该导出 API 的代码都会失败。
  - 已修复：改为读取全部记录并使用已有的内存过滤（`listImages` 内原本就有该过滤），
    不再触碰 `byFavorite` 索引；无需数据库版本升级或数据迁移。
    `tests/extension-regression.test.js` 增加了对应断言，禁止再次出现布尔索引查询。

## 执行命令

```bash
scripts/package-extension.sh
node tests/extension-regression.test.js
node --test tests/smart-collections.test.js
git diff --check
```
