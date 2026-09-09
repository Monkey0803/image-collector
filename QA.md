# Image Collector 3.2.0 验收清单

## 已验证

- [x] Chrome 加载扩展并打开 Image Collector 侧边栏。
- [x] 扫描当前页面并显示图片数量、尺寸、格式和文件大小。
- [x] 打开第二个标签页，选择两个标签页并合并采集。
- [x] 多页面结果显示页面数量和来源页面信息。
- [x] 多页面采集写入历史记录。
- [x] 从历史记录恢复筛选，恢复后保留多页面图片结果。
- [x] 扩展打包脚本校验 manifest、入口文件、图标和 JavaScript 语法。
- [x] 打包文件可以通过 ZIP 完整性检查。
- [x] 使用本地 1000 张图片压力页完成真实 Chrome 扫描；默认上限为 500，结果显示 500 张、已探测 300 张，并提供“加载更多（120）”，侧边栏保持响应。
- [ ] 将扫描上限调至 1000 后再次完成本地压力页全量扫描，确认全量结果与内存占用。

## 待验证

- [ ] 在含有跨域、防盗链、登录限制和过期图片地址的页面上验证普通下载、ZIP 和重试。
- [ ] 使用真实远程 500～1000 张图片页面验证网络加载、分批渲染、素材库筛选和内存占用。
- [ ] 使用接近 256 MB 的 ZIP 任务验证数量、大小和超时限制及失败项恢复。
- [ ] 验证三个 Chrome 快捷键在侧边栏尚未完成初始化时仍能执行。
- [ ] 验证 iframe、沙盒 frame、Chrome 保护页面和文件 URL 的权限提示。

## 执行命令

```bash
scripts/package-extension.sh
node tests/extension-regression.test.js
node --test tests/smart-collections.test.js
git diff --check
```
