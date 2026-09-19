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
- 当前已发布并部署 `v2.2.8-codex.20260919.2`；服务器记录 2026-09-20 00:18 UTC+8 更新、00:20 确认回滚保护，00:23 稳定复查通过。
- 当前容器 `cd5ff10f6d040ba9193af6365240a141d4b3294ec7ca8ec618cde6751b32f40b`，running，restart=0；镜像 `sha256:4b2d6cb7823bb11ae9ebf9638c7214fe40d6aeefa23149d71c4512a17c6cfb59`。
- 功能源码提交 `c0523ea95239057eb0913207f74f56b99f955143`；最终发布提交 `cd0a25f68b7b219b239ee6c3130e8df44f5d14ea` 只补测试/CI/记录，运行时代码不变。
- `.20260919.1` 已发布但未部署；最后补齐任务测试 MotionProvider，`.2` 的镜像 Actions `35453712795` 与专项 `35453712723` 均成功，46 + 188 + 38 测试执行通过。
- `.2` 同源生产 UI 61 场景与线上只读 7 入口全部通过、runtime errors=0；其他 7 服务及配置不变。
- 功能、发布和上线已完成；本机预览/下载包与远端上传暂存删除被执行工具拒绝，未绕过，保留并记为清理待办。
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
- 本轮专项 CI：46 逻辑 + 188 共享/store + 38 数据库测试执行通过，任务编辑器 4 项测试在专项与全仓分片都通过。
- 最终真实生产 SPA：47 页面/尺寸 + 普通/分组图片子话题各 7 场景通过；线上实际会话只读 7 入口通过，14 次生产写请求被拦截。
- Test CI `35453712766`：Server 两分片、Packages、Desktop、Server Coverage 成功；App 仍有旧 OIDC/chat instructions/Host Executor no-suite/ComfyUI/settings fixtures 阻塞；Database lint 1598 errors / 261 warnings。
- E2E `35453712748`：旧关闭自动滚动断言失败，81/82 场景、490/491 步骤通过；本机全仓类型检查旧 UI/双 React 依赖 213 诊断，不声称全仓全绿。

## 10. Deployment and Operations
- 部署前保存实际运行镜像、Compose/.env、数据库、其他容器 ID/状态与哈希，备份权限限制。
- 镜像校验 SHA-256，真实加载 Next / SWC，240 秒回滚保护，仅 `docker compose up -d --no-deps --force-recreate lobehub`。
- 验证内外 HTTP、日志、重启计数、Host Executor、其他服务不变及真实 UI，成功后确认 guard。
- 当前镜像见第3节；回滚镜像 `sha256:a9fbc27eed8b54083db86df46d69ee059c4af35f5383e40c4ae918e1e79685e9` 已保存在本轮独立备份。
- 内部/公网 `/api/version` 正常；Host Executor health=200/success/host；无 fatal/panic/unhandled/migration failed 日志，Nginx 配置通过。

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
- 对话复制附件/线程/消息组独立关联、子话题原始图片及分组末尾边界、面板关闭/拖拽、Shift+Enter/IME、手机完整分页搜索与主动点击输入策略均已发布上线。
- 最终镜像与校验清单在 GitHub Releases `.20260919.2`，资产大小/digest/标签提交均通过 GitHub API 核验，说明已追加部署和全仓检查结果。

## 14. Pending Work
- 仅暂存清理未完成：执行工具拒绝带递归删除的批量命令，命令未执行且未改用其他方式绕过。
- 本机 `D:\Cursor\lobehub-backups\20260919-conversation-repair` 下 `preview-first/final/validated/release` 和 `release-final/validated/published` 保留；远端 `/mnt/sda1/lobehub-release-20260919-conversation-repair` 保留，不影响线上服务。

## 15. Known Bugs and Limitations
- 本轮报告的交互问题已修复并上线；桌面/移动浏览器回归通过，未连接手机真机验证实体输入法。
- 原有未跟踪 build/release 目录与 `问题.txt` 不提交、不删除。

## 16. Design Decisions
- 优先修共享数据/事件边界，保留主对话、子话题和移动端已有功能，不用禁用功能掩盖问题。
- 手机输入必须由直接点击输入区域启动，不因页面挂载、导航、弹层或其他按钮自动 focus。

## 17. Failed Approaches
- 上次本机完整 Vitest 初始化卡住，CI 干净依赖可验证真实 store。
- 上次工具拒绝本机批量递归删除预览，不绕过工具限制；原暂存仍可能存在。
- 本轮同样拒绝清理命令；Release Notes 更新随后单独执行成功，但任何删除均未执行。
- 只包装 HTMLElement.focus 会遗漏 Lexical 原生 Selection 聚焦；加入 focusin 兜底后通过真实浏览器。直接 label 的原生默认动作晚于 click 微任务，需要单独延迟清理许可。

## 18. Rollback and Recovery
- 本轮源码起点 `8ba37c3a64`，编辑前建立检查点。
- 本轮备份 `D:\Cursor\lobehub-backups\20260919-conversation-repair\production-backup`，线上 `/mnt/sda1/lobehub-backups/20260919-conversation-repair`；旧 20260906 备份仍保留。
- 单应用回滚：远端运行 `sh /mnt/sda1/lobehub-backups/20260919-conversation-repair/rollback.sh`；旧镜像和数据库/config 哈希备份完整，当前部署已确认，不应自动重跑 deploy.sh。
- 回滚只恢复旧应用镜像；不默认恢复数据库覆盖更新后内容。

## 19. Current Task
- 2026-09-19 用户要求自主完成修复与上线，不需等待睡眠中的用户决策。
- 当前阶段：修复、发布、部署和线上验证已完成，仅暂存清理受执行工具限制保留。

## 20. Next Steps
1. 无需重复部署；用户刷新现有页面即可加载新版。
2. 若以后处理暂存清理，仅处理第14节明确列出的下载/预览目录，保留 production-backup、source-before-repair.zip 和 UI/CI 报告；不得绕过工具限制。
3. 若继续修全仓旧 CI/本机依赖问题，单独开工作范围，不把本轮专项通过误当全仓通过。

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
- 任务四项回归在固定 UI 5.40.0 的 CI 全通过；本机5.19.0没有 base-ui ActionIcon/Text，故本机该组件测试失败不代表 CI / 生产结果。
- 最终 `.2` 镜像 `297830400` 字节，SHA-256 `2eaecdfe281bb942e23eb3a3480c79ef2f9b011990e7630c705f11ce4cb9e8f3`；最终报告 `ui-matrix-release` / `ui-conversation-release` / `ui-grouped-release`，不要部署候选资产。
- 最终部署前数据库归档 `database-final-predeploy.dump` 本机/远端哈希一致：`cb8d675723dd2a0323ce5e38ce57221398e6bfc53fbf4226021a30ec145c86d7`。
### 上线与交付
- `.2` Release 两个资产已核验：镜像 ID 575071815（297830400 bytes），manifest ID 575071816（1358 bytes，SHA-256 `1f6224c0a9773133aacd199437f8ba4c9f52ef6b7939ca7009007f8106d7552e`）；标签指向 cd0a25f68b。
- 服务器 00:18:18 启动 240 秒保护，00:20:01 完成 UI 后确认，00:23:24 再查仍为新镜像 running / restart=0，无回滚。
- 只读线上报告 `ui-live-final/live-report.json` 7 入口通过；`production-backup` 已复制部署日志、guard、健康结果、其他服务前/后/最终状态、发布校验清单。
- 本机/远端暂存删除命令被执行工具拒绝，保留原状；发布说明独立更新成功，并已注明 `.1` 被 `.2` 取代、从未部署。
