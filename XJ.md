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
- 上次发布 `v2.2.8-codex.20260906.1`，功能提交 `652341201828548f3347e1ca92c79cfcf874f768`；本轮功能首提交 `6bcd6fc02b` 已推送，线上未改变。
- 首轮及 `56ff56bf7b` 候选 Actions 镜像/专项均成功；56ff 在全页面矩阵发现任务页抢焦点，未发布部署。
- 最终功能提交 `c0523ea95239057eb0913207f74f56b99f955143`；Actions 镜像 `35452632395`、专项 `35452632378` 全部成功。
- 候选专项 46 + 184 + 38 次测试执行通过，同源生产 SPA 47 页面/尺寸 + 普通/分组各 7 子话题场景通过，runtime errors=0。
- `.20260919.1` 已发布但未部署；总 CI 最后发现任务编辑器两个测试缺 MotionProvider（实际页面 61 场景通过），补齐测试 wrapper 并纳入专项，功能源码保持 c052 不变，需再构建发布 `.20260919.2`。
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
- 复制话题必须复制 `messages_files`、threads/message_groups 独立图与父链；文件对象复用，不重复上传。
- 新 thread 的 `replaceMessages` 必须写原始 `dbMessagesMap` 数据；assistantGroup 的来源规范化为末尾真实子消息。

## 13. Completed Work
- 2026-09-06 手机全面改版与独立生图已发布并部署，详见历史日志。
- 2026-09-19 已检查 Git、读取历史和相关规范，初始化本项目记忆。

## 14. Pending Work
- Release、单服务部署、只读线上 UI 验证与暂存清理；代码、最终 Actions 与生产浏览器矩阵均已验证。

## 15. Known Bugs and Limitations
- 旧生产 bundle 已复现自动 focus 与子话题内外宽度不一致；最终 bundle 已验证修复，等待上线。
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
- 当前阶段：只补任务编辑器测试 Provider 与移动/桌面自动焦点回归；线上未变，旧 `.1` 不部署，最终 `.2` 构建后部署。

## 20. Next Steps
1. 验证任务编辑器四项测试，推送后专项应为 46 + 188 + 38；重新构建，发布 `.20260919.2`（不可复用旧 SHA）。
2. 更新 deploy.sh、manifest、Release Notes 到最终 SHA；最终镜像/SPA 通过后单服务部署。
3. 运行 production-backup/verify-production.py 只读验证，检查其他服务与配置不变，确认回滚 guard；更新发布说明、清理暂存。

## 21. Change Log
- 2026-09-19：创建项目记忆；记录新请求、历史部署约束、验证和回滚规则。
### 2026-09-19 继续执行
- 编辑前检查点：`4b9ff2426b`；已实现但尚未验证：话题复制附件/线程/消息组独立关联，thread 原始数据初始化，手机完整分页搜索与全入口直接输入焦点保护，面板尺寸/标题关闭区，快捷键输入边界。
- 新文件：`src/features/MobileApp/TopicList.tsx`、`inputFocusGuard.ts`。
- 下一步：新增/调整专项回归，生产 bundle 浏览器验证，Actions / Release / 窄部署；线上未改变。
- 已验证：PGlite 38 tests 通过；轻量逻辑 34 tests + 快捷键 8 tests 通过；目标 lint 0 errors / 3 既有 warnings。
- 首次 Actions 推送内容为本轮修复与测试；最终部署与 Release 尚未开始。线上 22:47 只读核验镜像与历史相同、running、restart=8。
- 首轮镜像与专项 CI 均成功；真实生产 UI `ui-scroll-corrected/report.json` 验证全65条、搜索、焦点、子话题图片/上下文/拖拽/关闭/Shift+Enter，通过且无运行时异常。
- 新备份远端 `/mnt/sda1/lobehub-backups/20260919-conversation-repair`、本机同名 `production-backup`，4个资产哈希一致；线上未部署。
- 当前补充 assistantGroup 来源为末尾真实消息和对应浏览器场景；最终提交将再构建。
- 全仓类型检查已结束：213 条诊断（主要旧 UI/双 React 类型）；本轮 `this` 注解已修复，不声称全仓 typecheck 通过。
- 最后补充：分组助手右键入口一致性、手机点击输入区外 blur 且禁止工具栏恢复；重新构建最终产物前验证。
- 最新本机验证：ChatStore 32 tests、轻量逻辑 43 tests，全部通过；定向 lint 无错误。准备最终 Actions 构建并验证分组工具图片场景。
- 候选 `56ff56bf7b` 未发布/部署：完整矩阵发现 `/tasks` Lexical 原生 Selection 会绕过 focus 包装，已修原生 focusin 边界并逐个关闭任务/附件相关主动焦点。
- 本机和远端暂存的 56ff 镜像是未发布中间包，不可部署；需更新 manifest/脚本到下一次最终 SHA，重跑全页面矩阵后再发布。
- 继续请求：保存 `85eafa9aa9` 检查点，45 tests 通过；修复附件菜单 mobile 闭包依赖，扩展专项 CI lint 和真实 UI 任务草稿回归，输入测试改为先直接触摸再输入。
- 最小真实 Chromium 手势验证发现关联 label 的默认聚焦发生在 click 微任务之后；仅为直接点击 label 延长到默认动作结束，普通按钮及异步恢复仍禁止，增加对应回归；尚未部署。
- `dec9f81542` 专项 CI 扩大 lint 后发现任务编辑器三项旧导入不符合固定 UI 5.40.0，迁移 ActionIcon/Button/Text 到 base-ui；本机实际依赖仍为 5.19.0，不能以本机 lint 代替 CI。
- 部署前第二份数据库归档本机/远端 SHA-256 一致：`28555455fe5be3655721192a988fe24ed8582aadf887eac0eb64dfbb808343f6`；Compose/.env 未变；部署脚本已语法校验，后续需更新最终 SHA。
- 最终镜像 `297839104` 字节、SHA-256 `bf91e4cefb019c512301770a7491a48e7bd74afac3fad939183d806c21bfcdfa`；位于 `D:\Cursor\lobehub-backups\20260919-conversation-repair\release-validated`，不是 release-final 里的旧候选。
- 同源真实生产 UI 验证报告在 `ui-matrix-validated` / `ui-conversation-validated` / `ui-grouped-validated`；所有 61 页面/场景通过，任务草稿重载、手动输入与子话题图片/拖拽/关闭/换行均通过。
- 全仓最终审计发现新增任务编辑器测试缺 MotionProvider，并非页面异常；补齐真实 Provider、增加手机禁自动 focus 和桌面保留 focus 回归，纳入专项 CI 后再发布 `.2`；不得将这两项误称为历史失败。
