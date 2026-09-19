# Project Memory

## 1. Project Overview
- LobeHub 自部署 AI 工作区，仓库根为 `D:\Cursor\lobehub`；电脑与手机 SPA、Electron、服务端和共享包构成单仓库。

## 2. Goals and Requirements
- 中文回复，句尾“喵~”；禁止 WSL；保留用户无关文件与现有服务。
- 每次有意义变更同步本文件及 `YHYQ.md`，显式暂存并提交本轮文件。
- 推送后由 GitHub Actions 构建并发布 GitHub Releases；部署前备份，仅更新 LobeHub 服务。
- 2026-09-19：修复复制对话/子话题图片丢失、子话题关闭/调整大小、Shift+Enter 等误跳转、手机搜索完整列表和所有输入框非主动唤起键盘；完成后自行部署。

## 3. Current Status
- 任务开始时跟踪文件干净，分支 `codex/deploy-server-image-20260720`，HEAD `8ba37c3a64`，比远端多 4 个仅记录提交。
- 上次发布 `v2.2.8-codex.20260906.1`，功能提交 `652341201828548f3347e1ca92c79cfcf874f768`；本轮尚未修改功能或线上服务。
- 本文件此前不存在，2026-09-19 根据仓库日志初始化；旧记录仍完整保留于 `YHYQ.md`。

## 4. Repository Structure
- `src/features` 业务 UI，`src/routes` 薄路由，`src/spa` SPA 入口/路由。
- `src/store` Zustand，`src/services` 客户端服务，`apps/server/src` 后端。
- `packages/database/src` 数据模型/schema；`packages/locales/src/default` 英文源，`locales/en-US` / `locales/zh-CN` 手工维护。
- `tests/mobile-studio` 轻量测试与生产 bundle 浏览器验证。

## 5. Architecture
- Next.js 提供后端/认证/SPA 模板，Vite 编译 SPA，React Router 管理业务页面。
- React → Zustand/SWR → client services → tRPC → services/models → PostgreSQL。
- 上传附件存储于对象存储，消息文件关联和展示投影需同步维护。

## 6. Technologies and Dependencies
- Next.js 16、React 19、TypeScript、pnpm、Bun scripts、Vitest、Playwright。
- `@lobehub/ui` 固定 5.40.0，优先 base-ui，静态样式 `createStaticStyles`。
- 本机旧依赖曾与 CI 不同，修改后需检查实际版本，不盲目全量重装。

## 7. Configuration and Environment
- Windows PowerShell；可用 SSH 密钥连接 `root@192.168.100.1`，使用前只读核验。
- 线上 Compose `/mnt/sda1/lobehub`，LobeHub 宿主 `127.0.0.1:13210` → 容器 `3210`。
- 相关变量：`DATABASE_URL`、`APP_URL`、`AUTH_SECRET`、`HOST_EXECUTOR_BASE_URL`、`HOST_EXECUTOR_TOKEN`；只记录名称，不保存值。
- Git remote `fork` 为 Alunixa/lobehub；`origin` 上游不推送。

## 8. Development Commands
- `bun run check [explicit files]`；禁止 `bun run test` 全套。
- 目标 Vitest：`node node_modules/vitest/vitest.mjs run --silent=passed-only <paths>`。
- 轻量测试：`node node_modules/vitest/vitest.mjs run --config tests/mobile-studio/vitest.logic.config.mts`。
- Git 提交使用 `git -c core.hooksPath=NUL commit` 避免旧 hook；显式 `git add -- <paths>`。
- 生产构建工作流 `.github/workflows/codex-build-server-image.yml`；输出镜像和静态 SPA preview。

## 9. Testing and Verification
- 上次专项 173 tests、最终生产 bundle 47 场景通过，不能替代本轮验证。
- 上次全仓 CI 有既有 App fixtures/assertions、Database lint、自动滚动 E2E 失败；不得称全仓全绿。
- 上次本机完整类型检查受依赖导出问题影响，目标文件检查与 CI 需分开报告。

## 10. Deployment and Operations
- 部署前保存实际运行镜像、Compose/.env、数据库、其他容器 ID/状态与哈希，备份权限限制。
- 镜像校验 SHA-256，真实加载 Next / SWC，240 秒回滚保护，仅 `docker compose up -d --no-deps --force-recreate lobehub`。
- 验证内外 HTTP、日志、重启计数、Host Executor、其他服务不变及真实 UI，成功后确认 guard。
- 上次运行镜像 `sha256:a9fbc27eed8b54083db86df46d69ee059c4af35f5383e40c4ae918e1e79685e9`，仅为历史，部署前重新核验。

## 11. Important Files
- `YHYQ.md`：用户要求与操作历史。
- `src/features/MobileApp`：移动壳/导航/设置。
- `src/features/ImageStudio`：独立图片工作台。
- `tests/mobile-studio/verify-preview.mjs`：真实生产 bundle + 本地 API fixture。
- `tests/mobile-studio/verify-live.mjs`：只读线上检查，凭据从 stdin 输入，禁止生产写。

## 12. APIs, Interfaces, and Data Formats
- `/trpc/lambda/*` 客户端接口，SuperJSON 传输。
- `/api/version` 健康检查；Better Auth 签名会话 Cookie 只在内存中处理。
- 消息复制及 thread 图片关系本轮待追踪，不能将纯文本复制当完整对话克隆。

## 13. Completed Work
- 2026-09-06 手机全面改版与独立生图已发布并部署，详见历史日志。
- 2026-09-19 已检查 Git、读取历史和相关规范，初始化本项目记忆。

## 14. Pending Work
- 定位五类本轮问题并实现窄修复；专项单元/集成/生产浏览器验证。
- 新备份、Actions 构建、Release、单服务部署、真实 UI 验证与清理。

## 15. Known Bugs and Limitations
- 用户报告复制/子话题缺图片、窗口失去关闭/缩放、快捷键误跳转、移动搜索列表不能展开和自动弹键盘，尚未逐项复现。
- 原有未跟踪 build/release 目录与 `问题.txt` 不提交、不删除。

## 16. Design Decisions
- 优先修共享数据/事件边界，保留主对话、子话题和移动端已有功能，不用禁用功能掩盖问题。
- 手机输入必须由直接点击输入区域启动，不因页面挂载、导航、弹层或其他按钮自动 focus。

## 17. Failed Approaches
- 上次本机完整 Vitest 初始化卡住，CI 干净依赖可验证真实 store。
- 上次工具拒绝本机批量递归删除预览，不绕过工具限制；原暂存仍可能存在。

## 18. Rollback and Recovery
- 本轮源码起点 `8ba37c3a64`，编辑前建立检查点。
- 旧备份 `D:\Cursor\lobehub-backups\20260906-mobile-redesign`，线上对应 `/mnt/sda1/lobehub-backups/20260906-mobile-redesign`；本轮建立独立新备份。
- 回滚只恢复旧应用镜像；不默认恢复数据库覆盖更新后内容。

## 19. Current Task
- 2026-09-19 用户要求自主完成修复与上线，不需等待睡眠中的用户决策。
- 当前阶段：源码与运行环境诊断，尚未改变线上状态。

## 20. Next Steps
1. 建立本轮 Git 检查点，分开检查消息克隆关系、Thread 面板与快捷键/焦点/搜索。
2. 实现与回归，记录证据；只读核验线上并创建新备份。
3. Actions 构建并发布，通过后窄部署与最终验证。

## 21. Change Log
- 2026-09-19：创建项目记忆；记录新请求、历史部署约束、验证和回滚规则。
