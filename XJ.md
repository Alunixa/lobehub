# Project Memory

## 1. Project Overview
- LobeHub 自部署 AI 工作区，仓库根为 `D:\Cursor\lobehub`；电脑与手机 SPA、Electron、服务端和共享包构成单仓库。

## 2. Goals and Requirements
- 2026-09-21：用户反馈手机会话高级参数无法滑动，需修复触摸滚动并验证小屏/横屏/展开高级项及正常输入行为，按既有流程发布部署。
- 2026-09-20追加：编辑已发送消息时能添加附件；在会话指定位置新增自定义上下文（文字及附件）；与时间功能合并验证、发布和部署。
- 中文回复，句尾“喵~”；禁止 WSL；保留用户无关文件与现有服务。
- 每次有意义变更同步本文件及 `YHYQ.md`，显式暂存并提交本轮文件。
- 推送后由 GitHub Actions 构建并发布 GitHub Releases；部署前备份，仅更新 LobeHub 服务。
- 2026-09-19：修复复制对话/子话题图片丢失、子话题关闭/调整大小、Shift+Enter 等误跳转、手机搜索完整列表和所有输入框非主动唤起键盘；完成后自行部署。

## 3. Current Status
- **当前已发布并部署：`v2.2.8-codex.20260923.2`**，运行源码 `2ae3466070027bc5e9c3f5605915f7b29916f813`；GitHub Actions `35904190592` 成功，Release 三项资产 digest 与本地一致。
- 当前镜像 `sha256:ea7da67e7e837b16d66f6b984602e09a30491a530b13ed30f65bf7d84c6b1d6d`，容器 `3d6ea49a564c8fb22225774e29e0888ee33d4f42389f0f9fe788171f7d8b4452`；远端 UTC+8 时间 2026-09-24 03:35:49 确认部署，03:38:38 超过原 240 秒窗口后仍 running/restart=0/OOM=false。
- 首屏不再等待 IndexedDB 全量水合；缓存后台补齐且不覆盖新网络值。只读 tRPC query 优先同源 WebSocket，连接/响应故障约 900ms 回退 HTTP；mutation、上传与写请求继续 HTTP。
- 真实远端和外部 IPv6 WSS query 返回标准 `UNAUTHORIZED` 业务错误且 `bridgeSource=null`，普通 HTTP query 返回 401；内部、公开 HTTPS、外部 IPv6 HTTPS 版本接口均正常。
- Host Executor health=200/success/host，致命日志计数0；其他7容器和Compose/.env/override哈希不变，未修改数据库、Redis、RustFS、SearXNG、设备网关、DNS、IPv6或Nginx。
- `.1` 首轮与 `.2` 第二次尝试均因未及时确认由 guard 自动回滚，第三次已在窗口内确认并稳定。部署证据已归档；无用 artifact zip 清理被执行策略拒绝，未绕过。

### 历史已部署版本状态
- **当前已发布并部署：`v2.2.8-codex.20260920.1`**，运行源码`30c85bdfb5b47cc311f815788132bb719b95289b`，2026-09-20 20:57:57 UTC+8启动保护部署、21:00:12线上UI验证后确认成功。
- 当前容器`2321086197bbb98cd497b59ad1426b3ea0df4561ba276029706be37227cbbf6c`，镜像`sha256:ab97f03e2b3b6d9ef34cf0b0202d176f6abff80208a7cdabdca5db86187aea07`，确认时running/restart=0/OOM=false。
- 时间开关/秒级技能、旧消息附件编辑、指定位置自定义上下文（含附件）均已上线；同源生产UI72场景和线上9入口通过，runtime errors=0，线上验证拦截9次写请求，没有发送模型请求或修改用户设置。
- 内部与公开HTTPS版本接口正常，Host Executor health=200/success，Nginx语法通过、无致命启动日志；其他7容器ID/状态/重启计数与3项配置哈希不变。未修改DNS、IPv6、Nginx或其他服务；早前间歇访问故障根因仍未确定。
- 21:03:27 UTC+8超过240秒保护窗口后复查仍running/restart=0/OOM=false、版本接口正常、未回滚；发布说明及上线证据已归档。临时文件清理被执行工具拒绝，未绕过、未删除任何目录，功能/部署无需重做。本地领先提交仅项目记录与浏览器Markdown尾换行断言，不改变已部署运行代码。

### 历史阶段快照（以下“当前/待执行”仅描述当时状态）
- Release `v2.2.8-codex.20260920.1`于20:55:58 UTC+8发布，标签指向30c85bdfb5；GitHub API核验3资产已上传且digest一致。远端暂存镜像/manifest校验通过、deploy.sh语法通过；尚未启动部署。
- 待发布部署最终版`v2.2.8-codex.20260920.1`：运行源码`30c85bdfb5b47cc311f815788132bb719b95289b`，镜像/三专项全部通过，最终同源生产UI72场景全通过、runtime errors=0。资产`release-published/lobehub-server-image.tar`为297941504 bytes、SHA256 `d63b15652befd133d26e20e5c3617ee9995a80197fa837a12e7e89e9801c4431`；请勿使用`release-final`内a23候选。
- 候选a23镜像构建成功，但真实生产UI发现新增空白上下文弹窗触发Lexical #38（空markdown生成无子节点root）；不发布或部署该候选。手机附件完整增删/保稿/重试已通过，时间开关手机/电脑4场景通过。当前修复共享EditorCanvas空白初始化为text reader，并补3项真实编辑器回归。
- 最终候选`a23af8fa83cf8ec1cc79ed01e446c8a9a0467529`已推送；消息专项`35510649207`成功（167次测试），手机专项`35510649206`成功（272次测试），时间专项`35510742391`成功（102次测试）；镜像`35510649562`构建中。20:28线上仍为4b2d旧镜像且本轮未部署。
- 续接核验：`7328df164d`镜像Actions `35509764822`已成功；生产UI首次正确菜单验证已完成手机上传/保存失败保稿/重试/刷新，随后卡在旧包不存在“移除”翻译（显示remove），不是线上故障。修复及幂等重试已保存到`72bac61196`，最终同源构建/完整UI/发布部署仍待完成。
- 附件编辑/上下文初稿本机验证：43项通过（真实PGlite18+原线程14，独立上传/草稿/排序11）；定向源码与新测试lint通过。准备推送含时间+编辑+上下文的合并候选，由Actions构建与专项验证，当前线上仍未变。
- 用户追加附件编辑/定位插入上下文，本轮暂不部署时间单功能候选；时间最新提交`2abda25c1c`已推送，新增需求编辑前检查点`9bebde82fb`，当前定位共享EditorModal、消息更新/附件关联及会话排序入口。
- 2026-09-20 时间功能已推送候选 `4d2a651635aede4c35db393b913f516026a244e6`，尚未发布部署；镜像CI `35507508848` 构建中，Mobile专项 `35507508860` 成功，时间专项 `35507508894` 因UI5.40导入规则失败（新Alert和同包旧Text），正在修复后重建。
- 2026-09-20 新故障调查中：用户反馈外网超时，并明确使用公网 IPv6 直连；之前上线验证不等于用户当前外网可达，尚不能宣布恢复。
- 17:05–17:08 UTC+8 实测：AAAA 与当前 PPPoE 公网 IPv6 一致；真正外部 IPv6 节点北京/上海访问3210版本接口200，北京/深圳访问3210登录页200，TLS校验成功；北京/深圳访问443均在TCP建连约15秒超时。本机443返回301到3210，不能把本机结果当公网443可达。
- 用户17:09补充：9月20日早上和中午访问的就是3210，当时不通，现在自行恢复；因此443不可达是独立现象，不能解释用户此次故障，也不能继续把原因归于遗漏端口。
- 用户进一步确认：早上、中午故障和下午恢复时均使用手机流量；排除“改用Wi-Fi或切换网络类型才恢复”的解释，但不能仅据此确定运营商、DNS或服务端中的哪一环异常。
- 当前为已恢复但原因未明的间歇性访问故障；本轮没有修改线上配置，恢复不是本轮修复产生。
- Cloudflare只读API确认当前AAAA为DNS-only，最后修改于9月20日05:02:48 UTC+8，匹配当前PPPoE IPv6；未发现DDNS直到下午才更新的证据。WAN/wan_6会话自05:02持续在线，不能据此排除中间短时路由丢包或用户侧DNS缓存。
- 任务开始时跟踪文件干净，分支 `codex/deploy-server-image-20260720`，HEAD `8ba37c3a64`，比远端多 4 个仅记录提交。
- 当前已发布并部署 `v2.2.8-codex.20260919.2`；服务器记录 2026-09-20 00:18 UTC+8 更新、00:20 确认回滚保护，00:23 稳定复查通过。
- 当前容器 `cd5ff10f6d040ba9193af6365240a141d4b3294ec7ca8ec618cde6751b32f40b`，镜像 `sha256:4b2d6cb7823bb11ae9ebf9638c7214fe40d6aeefa23149d71c4512a17c6cfb59`；部署确认时restart=0，9月20日17:06复查running、restart=7，最后启动05:04:48 UTC+8，OOM=false。
- 路由器05:02重启后的应用重试日志为PostgreSQL还在recovery（57P03）；最后数据库迁移通过、Next Ready，05:05启动本地任务调度，此后未发现同类重启。不能把重启阶段错误误当当前持续故障。
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
- 2026-09-21最终00df源码：镜像Actions35588419088、手机专项35588418965成功（46逻辑+188共享/store+38数据库=272次）；`ui-params-final`10、`ui-matrix-final`47、`ui-conversation-final`7场景全通过，runtime errors=0。真实线上`ui-live-final/live-report.json`10入口全通过（含原生触摸滚动），写请求全部拦截。
- 9月21日全仓35588418956：Packages、Server两分片、Desktop、Server Coverage成功；App仍为OIDC/Host Executor no-suite/ComfyUI/settings fixtures失败，Database lint1597 errors/261 warnings。E2E35588419025为81/82场景、490/491步骤，唯一失败原关闭流式自动滚动距离断言（期望>320，实际12）；不声称全仓全绿。
- 本轮全仓`35511315013`：Packages、Server两分片、Desktop与Server Coverage成功；App失败为OIDC、Host Executor no-suite、ComfyUI、settings选择器；Database lint1600 errors/261 warnings。E2E`35511315041`81/82场景、490/491步骤通过，剩余既有关闭自动滚动距离断言。
- 2026-09-20最终30c源码：镜像`35511314975`、消息专项`35511315005`（170次）、手机专项`35511315027`（272次）、时间专项`35511365633`（102次）全部成功；次数包含专项重复执行。
- 同源生产UI72场景：`ui-message-release-validated`7、`ui-current-time-release`4、`ui-matrix-release`47、`ui-conversation-release`7、`ui-conversation-grouped-release`7；实际线上`ui-live-final/live-report.json`9入口，无runtime errors。
- 以下保留上一版本专项/全仓失败背景；本轮全仓CI仍有失败，不将专项通过表述为全仓通过。
- 本轮专项 CI：46 逻辑 + 188 共享/store + 38 数据库测试执行通过，任务编辑器 4 项测试在专项与全仓分片都通过。
- 最终真实生产 SPA：47 页面/尺寸 + 普通/分组图片子话题各 7 场景通过；线上实际会话只读 7 入口通过，14 次生产写请求被拦截。
- Test CI `35453712766`：Server 两分片、Packages、Desktop、Server Coverage 成功；App 仍有旧 OIDC/chat instructions/Host Executor no-suite/ComfyUI/settings fixtures 阻塞；Database lint 1598 errors / 261 warnings。
- E2E `35453712748`：旧关闭自动滚动断言失败，81/82 场景、490/491 步骤通过；本机全仓类型检查旧 UI/双 React 依赖 213 诊断，不声称全仓全绿。

## 10. Deployment and Operations
- 2026-09-24远端UTC+8最终部署备份：`/mnt/sda1/lobehub-backups/20260923-websocket`；最终第三次部署证据在其 `deploy-3` 子目录，本机副本为 `D:\Cursor\lobehub-backups\20260923-websocket\production-backup`。
- 当前 `.2` 镜像与容器见第3节；直接应用回滚脚本为 `sh /mnt/sda1/lobehub-backups/20260923-websocket/rollback.sh`，恢复部署前稳定镜像 `sha256:b3d69ff6973abe571002259dd210b95b10af599d2bebb18b33c2d22dc5d3e4f5`。
- 本轮没有数据库schema变化，回滚默认只恢复应用镜像，不回写数据库；部署前数据库、配置归档和旧镜像均已保存并有SHA-256清单。
- 2026-09-21最新部署备份及日志：`/mnt/sda1/lobehub-backups/20260921-mobile-params`；本机受限副本`D:\Cursor\lobehub-backups\20260921-mobile-params\production-backup`。已确认部署，不要再次运行deploy.sh；当前镜像b3d69f，回滚镜像ab97f03。
- 本轮远端暂存`/mnt/sda1/lobehub-release-20260921-mobile-params`，正式发布资产来自本机`release-final`；`release-published`内是未部署的ba65中间包。
- 最新部署已确认；本轮备份与部署日志位于`/mnt/sda1/lobehub-backups/20260920-current-time`，本机受限副本`D:\Cursor\lobehub-backups\20260920-current-time\production-backup`。以下旧a9回滚说明属于9月19日部署；本轮回滚应使用4b2d，见第18节。
- 部署前保存实际运行镜像、Compose/.env、数据库、其他容器 ID/状态与哈希，备份权限限制。
- 镜像校验 SHA-256，真实加载 Next / SWC，240 秒回滚保护，仅 `docker compose up -d --no-deps --force-recreate lobehub`。
- 验证内外 HTTP、日志、重启计数、Host Executor、其他服务不变及真实 UI，成功后确认 guard。
- 当前镜像见第3节；回滚镜像 `sha256:a9fbc27eed8b54083db86df46d69ee059c4af35f5383e40c4ae918e1e79685e9` 已保存在本轮独立备份。
- 上线确认窗口内部/公网 `/api/version` 正常；Host Executor health=200/success/host，无 fatal/panic/unhandled/migration failed 日志，Nginx配置通过；9月20日路由器重启后的独立调查见第3节。
- 公网入口是HTTPS域名加`:3210`；Nginx的443仅作重定向，但当前外部IPv6到443无法建连，不能依赖该重定向。尚无抓包证据确定是运营商还是其他上游环节阻断。

## 11. Important Files
- `src/features/MessageContentEditor/`：用户旧消息与新上下文共享附件编辑、上传队列、草稿及位置选择。
- `packages/database/src/models/messageContent.ts`：原子附件关联替换与有权限/分支约束的定位插入/幂等重试。
- `packages/conversation-flow/src/orderMessagesWithContext.ts`：上下文按父链定位，保留普通消息和替代分支顺序。
- `packages/utils/src/currentTime.ts`、`apps/server/src/modules/ModelRuntime/currentTimeHook.ts`：共享实时格式化与请求时注入。
- `packages/builtin-skills/src/current-time/`与`packages/builtin-tool-skills/src/ExecutionRuntime/`：当前日期时间技能与秒级工具。
- `YHYQ.md`：用户要求与操作历史。
- `src/features/MobileApp`：移动壳/导航/设置。
- `src/features/ImageStudio`：独立图片工作台。
- `tests/mobile-studio/verify-preview.mjs`：真实生产 bundle + 本地 API fixture。
- `tests/mobile-studio/verify-live.mjs`：只读线上检查，凭据从 stdin 输入，禁止生产写。

## 12. APIs, Interfaces, and Data Formats
- `message.editMessageContent({ id, content, editorData?, fileIds })`：保存本人user消息文字及完整附件集合，成功返回`{ success, messages }`；不自动重新生成回答。
- `message.insertContextMessage({ id, anchorId, position: 'before'|'after', threadId?, content, editorData?, fileIds })`：同事务定位上下文，`metadata.isCustomContext=true`且role=user，幂等ID重试保存最新内容；服务层归一化工具分组边界。
- 新上下文无schema迁移，真实createdAt保留；清理旧RAG关联但不删除原文件对象。手机输入框只能直接点击聚焦。
- `/trpc/lambda/*` 客户端接口，SuperJSON 传输。
- `/api/version` 健康检查；Better Auth 签名会话 Cookie 只在内存中处理。
- 复制话题必须复制 `messages_files`、threads/message_groups 独立图与父链；文件对象复用，不重复上传。
- 新 thread 的 `replaceMessages` 必须写原始 `dbMessagesMap` 数据；assistantGroup 的来源规范化为末尾真实子消息。

## 13. Completed Work
- 2026-09-24远端UTC+8：会话首屏白屏优化、后台缓存水合、WebSocket-first query/HTTP fallback、只读 bridge 与错误 envelope 修正完成；12项定向测试、Actions镜像、Release、单服务保护部署、外部IPv6 HTTPS/WSS及稳定复查全部通过。
- 2026-09-21：手机会话高级参数触摸滚动、base-ui兼容及数值宽度修复；本机专项、GitHub Actions构建/272项回归、64场景生产SPA、Release、单服务保护部署与线上10入口验收完成。
- 2026-09-20：时间开关/秒级技能、附件编辑/指定位置上下文完成实现、专项测试、生产UI、GitHub Actions/Release及单服务部署；同时修复真实UI发现的空白Lexical初始化异常。
- 2026-09-06 手机全面改版与独立生图已发布并部署，详见历史日志。
- 2026-09-19 已检查 Git、读取历史和相关规范，初始化本项目记忆。
- 对话复制附件/线程/消息组独立关联、子话题原始图片及分组末尾边界、面板关闭/拖拽、Shift+Enter/IME、手机完整分页搜索与主动点击输入策略均已发布上线。
- 最终镜像与校验清单在 GitHub Releases `.20260919.2`，资产大小/digest/标签提交均通过 GitHub API 核验，说明已追加部署和全仓检查结果。

## 14. Pending Work
- 本轮 `D:\Cursor\lobehub-backups\20260923-websocket\revision-api-2ae\artifact.zip` 与空目录 `revision-image-2ae` 的精确删除仍被执行策略拒绝；未绕过。最终镜像tar、生产证据、数据库、配置和旧镜像回滚包必须保留。
- 远端首轮与第二次部署的上传tar清理命令也被同一执行策略整体拒绝；保留不影响线上运行。不要删除父目录的 `old-server-image.tar`、`database-predeploy.dump`、配置归档或 `rollback.sh`。
- 9月21日本机`D:\Cursor\lobehub-backups\20260921-mobile-params`下`preview-release`、`preview-final`、`release-published`（ba65中间包）及`release-final/lobehub-server-image.tar`清理命令被执行工具拒绝；远端`/mnt/sda1/lobehub-release-20260921-mobile-params`也保留。不要绕过限制；保留所有production-backup、UI/CI报告和Release校验/证据。修复与部署已经完成，不重复部署。
- 本轮`D:\Cursor\lobehub-backups\20260920-current-time`中的`preview-first`、`preview-message-first`、`preview-final`、`preview-release`、`ui-package-inspect`、`release-final`和`release-published/lobehub-server-image.tar`清理命令被工具拒绝，全部仍保留；远端`/mnt/sda1/lobehub-release-20260920-current-time`也保留，不绕过限制。所有production-backup及UI/CI证据必须保留。
- 新访问超时调查未闭环：用户已确认早上/中午3210不通、下午自行恢复；需要故障当时的错误类型、时间与实际解析/网络路径证据，不能用443探测或05:02启动窗口解释全天问题。
- 独立启动配置风险：UCI nginx启动因conf.d/nginx.conf重复顶级worker_processes报错，现有rc.local在05:02:29手动启动实际配置成功；本轮未改动，若后续处理须单独备份并评估其他Nginx服务。
- 原交互修复任务仅暂存清理未完成：执行工具拒绝带递归删除的批量命令，命令未执行且未改用其他方式绕过。
- 本机 `D:\Cursor\lobehub-backups\20260919-conversation-repair` 下 `preview-first/final/validated/release` 和 `release-final/validated/published` 保留；远端 `/mnt/sda1/lobehub-release-20260919-conversation-repair` 保留，不影响线上服务。

## 15. Known Bugs and Limitations
- 本轮报告的交互问题已修复并上线；桌面/移动浏览器回归通过，未连接手机真机验证实体输入法。
- 原有未跟踪 build/release 目录与 `问题.txt` 不提交、不删除。

## 16. Design Decisions
- 优先修共享数据/事件边界，保留主对话、子话题和移动端已有功能，不用禁用功能掩盖问题。
- 手机输入必须由直接点击输入区域启动，不因页面挂载、导航、弹层或其他按钮自动 focus。

## 17. Failed Approaches
- 本轮发布SHA256SUMS最初由Windows Python文本模式写成CRLF，远端把CR视作文件名导致校验失败；部署未执行。改为LF bytes，远端两项重新校验成功并替换Release校验清单，最终清单179 bytes、SHA256 `4402d112248194661c414c40f0b303c85ac5eac5978f19bc04a9be9619e3bc6b`，镜像与manifest未改。
- 本机chat单worker专项在收集`@lobehub/icons/es/icons.js`时超时（488秒、no tests）；全仓tsgo长时间无诊断而停止，均不能记为通过。定向lint0 errors/1旧unused warning；本机旧UI无法发现CI5.40的Alert/Text迁移规则。
- 远端备份脚本经PowerShell文本管道末尾多出CR导致空命令错误，发生在BACKUP_COMPLETE和所有SHA256输出之后；备份已生成，后续校验已有文件，不重跑覆盖备份。
- 2026-09-20：外部SSH节点f/myhf无全局IPv6，mylf连接关闭，ff主机密钥不匹配；未绕过认证校验。改用Globalping真实IPv6节点取得有效证据。
- 路由器未安装timeout和tcpdump，未安装新依赖，未取得抓包证据；不得声称已抓包证明443被运营商拦截。探测进程已自然结束。
- 上次本机完整 Vitest 初始化卡住，CI 干净依赖可验证真实 store。
- 上次工具拒绝本机批量递归删除预览，不绕过工具限制；原暂存仍可能存在。
- 本轮同样拒绝清理命令；Release Notes 更新随后单独执行成功，但任何删除均未执行。
- 只包装 HTMLElement.focus 会遗漏 Lexical 原生 Selection 聚焦；加入 focusin 兜底后通过真实浏览器。直接 label 的原生默认动作晚于 click 微任务，需要单独延迟清理许可。

## 18. Rollback and Recovery
- **最新WebSocket优化部署回滚**：远端执行 `sh /mnt/sda1/lobehub-backups/20260923-websocket/rollback.sh`，恢复 `sha256:b3d69ff6973abe571002259dd210b95b10af599d2bebb18b33c2d22dc5d3e4f5`，仅重建LobeHub应用；本轮无schema变化，不默认恢复数据库dump。
- 当前部署已确认，不要重新执行 `deploy-3`；若回滚，完成后重新检查内部/公开版本、日志、restart count和其他7服务不变。
- **最新9月21日部署回滚**：`sh /mnt/sda1/lobehub-backups/20260921-mobile-params/rollback.sh`，恢复`sha256:ab97f03e2b3b6d9ef34cf0b0202d176f6abff80208a7cdabdca5db86187aea07`，仅回滚应用。本轮未改数据库schema，勿默认回写数据库；旧镜像/配置/数据库远端与本机3项SHA256均已核验。
- 以下9月20日及更早回滚记录仅历史，不能用于本次直接回滚。
- **最新部署回滚**：远端运行`sh /mnt/sda1/lobehub-backups/20260920-current-time/rollback.sh`，恢复`sha256:4b2d6cb7823bb11ae9ebf9638c7214fe40d6aeefa23149d71c4512a17c6cfb59`；只回滚应用，不默认覆盖数据库。
- 最新最终部署前数据库`database-final-predeploy.dump`本机/远端SHA256一致：`88a9aba33ffe8c3694096e0e8e7e6710eb322a3094d7d30437e3b24bf16c9a2d`；初始数据库、配置与旧镜像也完整保留。部署已确认，不要重新执行deploy.sh。
- 以下为上一轮回滚历史，不能误用于本轮直接回滚。
- 本轮源码起点 `8ba37c3a64`，编辑前建立检查点。
- 本轮备份 `D:\Cursor\lobehub-backups\20260919-conversation-repair\production-backup`，线上 `/mnt/sda1/lobehub-backups/20260919-conversation-repair`；旧 20260906 备份仍保留。
- 单应用回滚：远端运行 `sh /mnt/sda1/lobehub-backups/20260919-conversation-repair/rollback.sh`；旧镜像和数据库/config 哈希备份完整，当前部署已确认，不应自动重跑 deploy.sh。
- 回滚只恢复旧应用镜像；不默认恢复数据库覆盖更新后内容。

## 19. Current Task
- 2026-09-23用户提出的会话加载慢、白屏和WebSocket优先/HTTP fallback任务已完成实现、定向回归、Actions构建、`.2` Release、保护部署和真实IPv6公网验收。
- 当前无待执行的功能或部署操作；只剩执行策略拒绝的临时zip/tar清理待办，不绕过、不重复部署。
### 本轮过程快照（以下待执行状态已由上方实际结果取代）
- `v2.2.8-codex.20260921.1`已于2026-09-21 18:39:09 UTC+8发布，标签指向00df83a84f，GitHub API核验3项资产大小/digest全部一致；同源生产UI64场景（10参数+47矩阵+7分组会话）全通过、runtime errors=0。远端最终镜像/manifest SHA256与deploy.sh语法校验通过，尚未执行部署，下一步仅LobeHub保护替换与线上只读验收。
- 最终00df镜像35588419088与手机专项35588418965均成功；同源`ui-params-final`四手机尺寸、数值/文字保存、推理开关/下拉、折叠/返回聊天、电脑侧栏滚轮/关闭全部通过，10张截图、runtime errors=0。目视4,096完整显示；`ui-matrix-final`运行中。当前验证脚本HEAD120dae仅额外修正实际电脑入口/折叠DOM断言，与00df运行源码一致。
- 最终发布包`release-final/lobehub-server-image.tar`=298029568 bytes，SHA256 `c7049e6b0e4ef698acc9b3891ec43929c19e6b1923a2d42db49b962f6da4b024`；不要使用`release-published`中的ba65中间包。尚未Release/部署，仍须矩阵通过、发布资产核验及240秒保护窄部署。
- 关闭侧栏也按真实展开入口恢复+内容不在视口断言，而不是要求DOM卸载；与DraggablePanel保留折叠DOM的设计一致。
- 电脑测试进一步确认DraggablePanel折叠保留DOM，paramsTab.isVisible并不代表展开（被主内容遮挡）；改为按仅折叠时渲染的Header opener判定，打开后断言参数页签在视口中，不force点击、不改样式绕过真实交互。
- 电脑DOM已确认工作面板“参数”按钮可用，Tooltip内容不是tooltip角色；测试直接点击实际“参数”按钮，面板未打开时先按真实右上图标打开，避免把无关tooltip角色当成功前提。运行源码未再修改，最终构建继续。
- 最终运行源码`00df83a84f67e9f7e9fcccbc81fbf19d016f1ec5`（含数值宽度）已推送；镜像35588419088、手机专项35588418965运行中。电脑真实页头实际使用“工作面板→参数”，旧ParamsPanelToggle未挂载；修正浏览器入口，不改产品、不重启正在构建的同源包。ba65只作中间验证不可部署。
- 手机四种尺寸全部原生触摸到底/返回顶部、固定页头、手点输入、配置保存及返回聊天通过（ui-params-controls报告5条断言）；新增电脑验证卡在旧ActionIcon仅tooltip无aria-label的测试选择器，按真实组件结构用图标定位并验证tooltip，未改运行逻辑。宽度修订3378d24ef0待最终Actions。
- ba65手机390x844/320x568完整触摸和实际配置保存已通过，390x430回归把原生range的焦点错误当作键盘焦点；断言改为真正可唤起键盘的可见文字/数值输入（排除range/checkbox和隐藏input），共享线上只读检查；尚未完成全部矩阵，不宣称整体通过。
- 真实事件采集确认推理开关/下拉可保存，后续失败为测试把range和隐藏number也匹配成数值输入；改用可访问textbox。手势抬指前短暂停留消除惯性对下一tap的干扰，不用程序设置scrollTop。目视发现base-ui默认数值框48px使4096截断，将styles.input明确width（原仅maxWidth）以保留旧56/64px；需最终重建。
- ba65镜像Actions成功，手机专项成功；同源生产UI390x844已经触摸滚到最后一项，但新增开关保存断言首次tap后未改变状态，当前采集真实pointer/click事件区分惯性滚动吸收点击与控件问题，不降低断言、不部署未验证包。
- 修订源码`ba65d3c25b52fcefe98998cf06a885dac3a5d65f`已推送，镜像35586756267构建中、手机35586756298已通过新lint；扩展正式bundle回归验证数值输入/开关/推理下拉真实保存与电脑参数侧栏滚动/关闭。远端三项备份SHA256复核全部通过，原ab97应用仍running/restart=0。
- 续接检查点`1b4a2b4837`保留线上原生触摸回归；首候选213731dfff手机专项35586265812失败为Controls旧SliderWithInput/Switch导入，已对照固定UI5.40真实源码确认props兼容并迁移base-ui，不发布失败候选。消息专项35586265759成功；镜像35586265736仍在构建。
- 本轮独立备份已完成：`/mnt/sda1/lobehub-backups/20260921-mobile-params`，本机同名production-backup；数据库/配置/旧ab97镜像三项SHA256一致，部署脚本与只读线上验证helper已准备，尚未部署。当前补兼容修订后重建，保留所有原有无关未跟踪文件。
- 滚动修复本机46项轻量回归通过，定向lint/脚本语法/diff检查通过；新增4种手机尺寸（含横屏/短视口）原生触摸到底/返回顶部/输入/折叠/返回聊天验证，手机唯一滚动容器，电脑保持旧行为。17:58只读核验线上仍ab97、restart=0，准备推送Actions候选和新备份。
- 上一版生产包真实触摸复现成功：外层页面scrollHeight1029/clientHeight712，内部参数body884/884无自身溢出但overscroll=contain，手指上滑后两者scrollTop均0。修复新增page布局让手机页面唯一负责纵向滚动，电脑sidebar/popover不变；尚未构建/部署。
- 2026-09-21新任务：手机会话高级参数无法滑动。已完整读取本记忆/近期YHYQ，跟踪文件干净，编辑前检查点`f618c9ffee`；定位MobileAgentSettings页面嵌套ParamsSection(sidebar)和Controls内部overflow/overscroll，先用现有生产包复现触摸滚动，不改变线上服务。
- 用户本轮功能已发布上线并验证，最终Release说明和部署证据已归档，21:03:27稳定复查通过；临时清理因执行工具拒绝留下明确待办，不再修改代码或重复部署。

### 实施过程记录（下列待办已由上方最终状态取代）
- 最终报告`ui-message-release-validated`、`ui-current-time-release`、`ui-matrix-release`、`ui-conversation-release`、`ui-conversation-grouped-release`全部通过；已生成发布说明、manifest和SHA256SUMS，准备上传Release和远端暂存，然后执行已验证的240秒回滚保护部署。仅验证脚本尾换行和记忆提交领先30源码，运行文件未变。
- 修复版30c85bdfb5镜像与全部专项成功（消息170、手机272、时间102次测试）。同源UI空白上下文已可正常打开、上传文档、保存及刷新；排序断言需忽略编辑器标准Markdown尾换行（正文与指定位置均正确），仅修验证脚本trim，不改生产包。
- 修复已提交推送`30c85bdfb5b47cc311f815788132bb719b95289b`；本机真实EditorCanvas 5项测试通过（包含空白/空root3项），定向lint通过。新镜像`35511314975`构建中，消息专项`35511315005`、手机`35511315027`、同源时间`35511365633`待最终确认。
- 最终部署前另存数据库`database-final-predeploy.dump`，本机/远端SHA256均`88a9aba33ffe8c3694096e0e8e7e6710eb322a3094d7d30437e3b24bf16c9a2d`；配置3项哈希仍匹配，旧4b2d应用未变化。a23完整页面矩阵47+普通线程7+分组线程7成功，仅空白新上下文失败，修复版仍需同源复验。
- 生产UI诊断报告`ui-message-diagnostic`确认Lexical空root，并非菜单/权限或服务不可达；`release-final`内a23镜像是未通过UI的候选，不可部署。最终需要重建修复后的源码并再次完整验证；测试report新增未捕获控制台错误保留，避免React错误边界隐藏诊断。
- 用户再次“继续”，当前等待最终镜像，不重复构建；已保存三个专项CI完整日志到本轮备份目录`ci-final-{message,mobile,time}.log`，定向lint及git diff --check通过。核对权限、排序、重试和用户菜单入口，部署仍需最终包生产UI与Release。
- 本轮恢复已完整读取XJ及近期YHYQ、核对CI和现有报告，无相关测试进程残留。建立`72bac61196`检查点保留上轮全部修订；下一次推送包含最新幂等保存、移除附件中英文、图标兼容和浏览器验证入口修正，Actions构建后验证最终包。
- 幂等重试19项PGlite全部通过。全仓tsgo结束得到224条诊断（本机旧UI5.19/混合React与既有代码为主）；实际新问题是`common:remove`不存在，已新增中英文专用key，Button改为兼容两版本的图标节点；不声称全仓类型检查通过。
- 首生产UI脚本点消息容器中心误开图片预览，改文字双击后发现原编辑必须Alt双击；改用真实右键“编辑”入口。两次只是测试入口未命中，不声称附件编辑验证成功；报告`ui-message-first`、`ui-message-first-text`，接下来正确菜单路径验证。
- 源码复核补齐丢失响应后的幂等重试：相同插入ID不新增重复记录，但继续保存用户重试前改过的文字/附件；拒绝同ID跨thread或偷换位置，新增真实数据库回归。源码候选下一版需重新CI构建。
- 合并候选`7328df164db57696727033c2968fe5966b35a00d`已推送；消息专项`35509764848`全通过（11逻辑+70数据库/复制+53真实store/编辑器/分组服务+32投影，共166次测试），时间专项`35509765384`、手机专项`35509764833`成功；镜像`35509764822`构建中。
- 已新增`tests/message-content/previewFixture.mjs`与`--message-content`生产浏览器模式，覆盖手机/电脑附件增删、失败重试、Shift+Enter、前后位置/文档上下文和刷新、不发模型请求。准备同源UI验证，尚未执行。
- 阅读精确UI5.40 Select发布源码发现aria-label不转发，已改成真实label/id关联，随最终同源候选构建；未改依赖或线上配置。
- 本机第二轮：32项数据库/线程全部通过，11项上传/草稿/排序全部通过；补充模型真实MessageContentProcessor投影、服务端工具分组边界与store失败/导航竞态回归，转CI干净依赖跑完整专项。
- 首轮真实PGlite16项有11项通过，失败5项为新夹具的Date类型、workspace必填字段、thread.type和duplicate返回形状，已修正；上传队列4项、附件去重1项、排序3项通过，草稿3项中配额失败模拟需改HappyDOM全局stub，已修正。
- 回归推动补齐：移除/更换附件时清理旧消息RAG查询；continuation线程按逻辑位置包含新增上下文，不以新增记录时间遗漏，保留原始时间；新增同源专项CI、服务端工具分组边界集成测试，待最终执行。
- 源码实现初稿已接通：用户消息编辑为保存文字/完整附件集合（不自动重新生成）、独立上传队列/失败重试/移除/文件解析、浏览器草稿恢复、前后位置选择、自定义上下文标识及消息菜单/右键入口；共享EditorCanvas手机不主动聚焦。下一阶段补真实数据库与store/上传/浏览器回归、定向lint，尚未部署。
- 续接检查点`684975ef78`；时间专项CI `35508252489`、手机专项`35508252573`已确认成功，时间镜像尚不部署。
- 新功能实现中：新增独立`MessageContentModel`原子编辑/定位插入与tRPC/客户端服务，`orderMessagesWithContext`按父链排序自定义上下文，保留真实创建时间和普通消息/替代分支顺序，无数据库迁移；UI/测试尚待完成。
- 设计：编辑用户消息使用独立原子接口，完整替换附件关联但不删除文件对象；上下文是`role:user`+`metadata.isCustomContext`，可文字/附件、插入前/后、不自动生成；服务端验证消息/附件权限与当前thread，禁止拆开工具调用对。
- 最新任务：已发送消息附件编辑 + 在指定消息处插入自定义上下文（含附件），需要保留旧内容/附件、顺序/分支关系、后续模型投影、权限与手机主动输入行为；尚未修改这两项源码。
- 时间候选`2abda25c1c`修复label/移动说明及请求instructions残留；待拿最终CI和同源UI结果，合并新需求后最终发布部署，不部署中间候选。
- 本轮部署脚本已生成并上传到`/mnt/sda1/lobehub-backups/20260920-current-time/deploy.sh`，只做`sh -n`语法通过，未执行；需要传入最终40位源码SHA，并验证未有deployment.started，旧镜像必须4b2d。本机同目录verify-production.py使用新版9入口只读验证，尚未执行。
- bf95344500候选时间CI通过lint、37时钟/技能、61设置/聊天测试，唯一失败是旧instructions转system后仍残留原生字段；已定位payload合并并补`instructions: undefined`再叠加路由结果，不删除断言。
- 首个生产UI验证发现Switch包装组件不转发aria-label，FormGroup手机布局丢弃desc；已读取精确UI5.40发布包源码，改显式label/id/title和正文说明，两端都能读到时区及开关含义，并增加真实保存失败/重试UI测试。
- 备份本机/远端三项SHA256全部匹配：数据库e00a8b9e、配置da571d5c、旧镜像841888a3；独立备份完成，本轮尚未改线上应用。UI检查临时包在`ui-package-inspect`，结束后删除。
- 当前修正：Alert改base-ui+title，技能包旧Text同步迁移；客户端时钟移到SDK初始化后实际chat调用前；直连回归使用真实ModelRuntime实例而不是部分对象强制类型转换；历史Anthropic instructions测试显式关闭Responses覆盖，与其测试目的对齐。
- 已创建独立远端备份 `/mnt/sda1/lobehub-backups/20260920-current-time`：当前镜像4b2d、数据库、Compose/.env、其他7服务状态、回滚脚本；本机受限副本下载校验中。下一步推送修订、等待专项+镜像、同源UI、Release、单服务部署。
- 本机最终时钟/技能37 tests和设置/过滤18 tests通过；新增服务端技能adapter时区透传且不创建沙箱测试、线上只读手机/电脑外观设置入口检查。准备推送只包含时间功能、测试/CI/记录，由Actions生成发布候选；尚未部署。
- 新增浏览器直连跨午夜/关闭不注入/原消息不变的回归，以及写入成功后刷新失败不撤销设置的回归；已停止前后两轮同命令滞留的本机聊天测试进程，改有界单worker执行，不把未完成测试算通过。
- 续接检查点 `537e461021` 保存全部时间功能初稿；本机时钟/helper/runtime/技能4文件37 tests、设置11 tests、过滤6 tests通过。聊天大测试本机初始化仍慢，等待有界结果；当前尚未推送发布。
- 修正空时区RangeError需错误描述；成功保存但刷新失败不撤销已保存设置；请求时钟hook放在业务校验后更接近模型发送边界。准备定向lint/类型检查与生产CI。
- 已实现初稿：共享currentTime helper、服务端beforeChat/beforeGenerateObject实时hook、客户端直连注入、手机/电脑外观设置开关、current-time技能、lobe-skills只读getCurrentTime及中英文标题；尚未测试/发布。
- 不改旧SystemDateProvider，详细时间由统一模型边界独立注入避免工具跳过；缺失/非法保存时区回退UTC，工具显式非法时区返回错误。新增设置失败条件回滚，防止开关保存失败后显示假成功，不覆盖并发新设置。
- 2026-09-20 新功能：设置开关启用每次模型请求的实时日期/分钟/时区，新增current-time内置技能与秒级工具；起点`1d6c921df6`，编辑前检查点`baf77579b0`。
- 设计：默认关闭详细时间注入，保留旧日期行为；服务端ModelRuntime请求前hook覆盖聊天/任务/重试/结构化生成，客户端直连同样注入；在发送时重新取时，不写入用户消息历史。复用lobe-skills增加只读getCurrentTime，无网络时间服务、无沙箱或命令执行权限要求。
- 当前阶段：已读架构/UI/TypeScript/测试/Zustand/技能规范并定位现有日期提供器、共享设置和runtime hooks；准备实现、定向验证和发布，不修改网络配置。
- 2026-09-20：优先排查公网 IPv6 访问超时，不改成 Tunnel、不盲目重新部署或重启路由器；当前只读调查域名、IPv6、实际 Nginx、入站规则和外部探测。
- 排查前检查点已由上轮建立：`c608d0b8e5`；当前未修改应用或线上配置。
- 2026-09-19 用户要求自主完成修复与上线，不需等待睡眠中的用户决策。
- 原交互修复阶段：修复、发布、部署和上线验证已完成，仅暂存清理受执行工具限制保留；新超时调查仍未闭环。

## 20. Next Steps
0. 本轮会话加载与WebSocket-first修正版已上线；用户刷新页面后使用。不要再次运行deploy-3或重复部署。
1. 若后续仍觉得某个具体会话慢，采集该会话的准确时间、会话ID、浏览器Network瀑布和WebSocket/HTTP实际选择，以区分数据库查询、附件、模型配置或网络链路瓶颈。
2. 清理被执行策略拒绝的artifact zip和远端上传tar保持待办，不绕过；保留生产备份、最终镜像、Release校验与回滚证据。
3. 如3210间歇超时复发，记录准确时间/截图、客户端AAAA与外部IPv6探测；本轮没有修改网络，旧间歇性故障根因仍未确认。
4. 全仓旧CI/本机依赖问题另行处理；本轮只声明定向12项测试和权威镜像构建通过，不声称全仓全绿。

## 21. Change Log
- 2026-09-24 UTC+8：上下文续接后复核 `.2` 仍为正式 Release、三项资产完整，`.1` 仍为 prerelease；确认最终部署记录已同步到本文件，本次仅完成文档归档，不重建、不重新发布、不重新部署。
- 2026-09-24 03:38:38 UTC+8：`.2` 第三次部署超过原240秒窗口后稳定复查通过，外部IPv6 HTTPS/WSS、HTTP fallback、Host Executor、日志、配置与其他服务全部正常；Release说明更新，证据归档完成。
- 2026-09-24 03:35:49 UTC+8：在保护窗口内确认修正版部署；新镜像ea7da67、容器3d6ea49、restart=0/OOM=false，业务error不再误标bridge source。
- 2026-09-24 03:22:00 UTC+8：第二次尝试因确认过晚由guard自动回滚；代码/网络探针已通过，随后第三次按正确确认时序重新部署。
- 2026-09-24 02:22:34 UTC+8：`.1` 首轮因未确认由guard自动回滚；发现并修正HTTP tRPC嵌套error envelope边界，发布`.2`取代。
- 2026-09-21 18:44:59 UTC+8：超过240秒窗口稳定复查通过、未回滚；最终Release说明与线上10入口/保护标记/配置和其他服务证据已归档。原生PowerShell清理命令先验证目标边界但仍被工具拒绝，未执行且未绕过，本机及远端暂存保留。
- 2026-09-21 18:42:28 UTC+8：v2.2.8-codex.20260921.1上线并确认240秒保护，镜像b3d69f/restart=0/OOM=false，内部与公开HTTPS及Host Executor正常；线上10入口无runtime errors，其他7服务及配置不变。
- 2026-09-20 21:00:12 UTC+8：新版本实际部署与线上9入口验证通过，确认240秒回滚保护；新镜像ab97f03、restart=0、其他7服务及配置一致；最终发布资产与哈希已核验，收尾记录及清理中。
- 2026-09-20：继续用户时间功能请求；完整读取XJ/YHYQ，核验草稿与规范，建立537e检查点，执行本机专项测试及lint，修复RangeError lint和设置刷新失败不应回滚持久化结果的边界。
- 2026-09-20：补记用户确认故障及恢复前后均为手机流量；完整读取XJ和近期YHYQ，以干净跟踪状态的`4c73625e9f`为修改前检查点，仅更新两份项目记录，不重复当前健康探测、不修改线上配置。根因仍未确认。
- 2026-09-20 17:13 UTC+8：用户澄清早上/中午3210也超时、现已恢复；纠正端口假设，当前仅记录间歇故障，未将443独立问题当根因。
- 只读历史证据：root cron每周日05:00等待70秒重启；05:02路由器启动，Nginx实际配置05:02:29启动，Cloudflare AAAA 05:02:48更新，PostgreSQL05:04:48接受连接、LobeHub05:04:54 Ready；无上午/中午再次应用启动记录。
- DDNS运行周期100秒，Cloudflare API当前AAAA DNS-only、modified_on `2026-09-19T21:02:48.041904Z`；配置凭据只在内存处理并用于只读GET，未输出或持久化。现有stdout丢弃，DDNS内存日志端点需登录，未读取到历史日志。
- 已检查network/wan_6 uptime、系统/数据库/应用日志、内核网络错误、Nginx访问状态与启动路径；未改应用或路由器配置、未安装依赖、未启动后台监控。本轮临时SSH探测进程均结束。
- 2026-09-20 17:08 UTC+8：外部Globalping结果：`23KxuVAYUMwc4dcC400021AYb`北京/上海3210 `/api/version` 200（305/155ms）；`24sXFZ32KPrs8lU6A00021AYc`北京/深圳3210 `/signin` 200（440/433ms）；`2plPX70v761y4UayO00021AYc`北京/深圳443 TCP连接超时（14982/15003ms）。
- 外部3210请求已在Nginx access.log看到真实外部IPv6来源，证书有效；本机无代理强制IPv6到443为301跳3210。记录已告知用户并索取实际地址/截图；本轮只更新项目记录，未变更线上服务。
- 2026-09-20 17:04 UTC+8：重新完整读取 XJ、近期 YHYQ 和相关部署记忆；核对 Git、容器、IPv6 地址/路由、DNS、Nginx 实际配置/监听、fw4、DDNS 非敏感项和日志，线上未改动。
- 路由器本轮启动约 05:02，LobeHub 已运行约12小时；DDNS 使用 pppoe-wan，AAAA 匹配当前地址；防火墙 WAN input ACCEPT、Lucky 附加链空，Nginx 实际配置为 `/etc/nginx/nginx.conf`，3210 双栈监听。
- 外部 SSH 节点 f 无全局 IPv6/默认 IPv6 路由，不可把其 IPv6 探测失败算成家庭服务失败；ff 主机密钥与记录不一致，停止该入口，未绕过主机密钥校验。
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

## 2026-09-23：会话加载性能排查阶段性结论

- 已检查 `packages/trpc/src/client/lambda.ts`：浏览器通用 tRPC 只配置 `httpBatchLink`、`httpLink` 和条件分流，没有可直接复用的网页端 WebSocket RPC 服务端；当前 `/trpc/lambda` 是 Next.js Fetch Route，不能仅替换客户端 link 就升级为 WebSocket 喵~
- 已检查 `src/layout/GlobalProvider/CacheHydrationGate.tsx`：首屏在身份状态和 SWR IndexedDB 缓存水合完成前返回 `null`，硬超时为 1500ms；这会直接表现为整页白屏，且不是会话 HTTP 请求本身造成喵~
- 已检查 `src/features/Conversation/ChatList/index.tsx` 与 `src/features/Conversation/store/slices/data/action.ts`：已有缓存时可以先显示旧消息并后台刷新；没有缓存时会在消息请求完成前渲染 `SkeletonList`，同时会话页并行请求消息、助手配置、助手文档、Notebook 文档和 Topic Memory 喵~
- 已检查 `src/libs/swr/index.ts` 与初始化 Provider：交互数据默认 `dedupingInterval=0`、聚焦刷新节流5分钟，SWR缓存通过 IndexedDB水合；需要基于真实性能瀑布决定是否调整缓存/首屏门闩，不能盲目把一次性查询迁移到新建 WebSocket 喵~
- 已检查 tRPC 依赖与仓库 WebSocket 用途：现有 WebSocket 主要用于 Agent Gateway、设备网关和机器人连接；没有与会话列表/消息查询匹配的公共浏览器协议、认证和 Next.js 部署升级入口喵~
- 当前下一步：启动隔离本地开发入口采集导航、首个可见内容、CacheHydrationGate释放、会话请求TTFB/大小和重复请求证据，再以数据选择最小的首屏/缓存修复，并仅在有完整服务端协议时增加短超时 WebSocket fallback 喵~

## 2026-09-23：WebSocket优先传输实现阶段

- 已确认上一轮隔离开发进程已停止，当前没有占用`3011`/`9886`的遗留Next/Vite进程；本机缺少`KEY_VAULTS_SECRET`、`AUTH_SECRET`和`DATABASE_URL`，因此不能用本机Next 500作为生产性能证据喵~
- 性能方案调整为两部分：首屏身份范围确定后立即渲染，不再等待IndexedDB全量水合；水合继续后台进行并触发一次作用域内SWR重验证，避免白屏与匿名作用域污染同时存在喵~
- 新增同源只读tRPC WebSocket传输协议：浏览器对GET型`/trpc/*`请求优先复用`/api/trpc-ws`长连接，WebSocket连接或响应异常时快速回退原生HTTP；POST/写请求继续走HTTP，避免连接中断造成写操作重复执行喵~
- 生产启动器改为外层HTTP/WS复用代理，内部Next仍监听回环端口；代理只允许固定tRPC读取路径和GET方法，转发原始Cookie/鉴权/工作区请求头，不开放任意URL代理喵~
- 本阶段已建立的安全边界：WebSocket连接超时、请求超时、失败冷却、页面隐藏关闭、同源校验、路径白名单、HTTP状态原样返回；服务端不记录请求体、Cookie或鉴权值喵~
- 待完成：源码实现、客户端/启动器定向测试、Docker构建与运行验证、GitHub Actions同源镜像/SPA预览、Release说明、独立备份后的LobeHub单服务保护部署和公网/本地回归喵~

## 19. Current Task
- 2026-09-23：实现会话加载性能优化：首屏不再等待 IndexedDB 全量水合，查询优先同源 WebSocket，连接/响应失败自动回退 HTTP；写请求继续使用 HTTP，避免重复提交风险喵~
- 修改前检查点：`7081603c31`喵~
- 当前尚未修改运行时代码、Docker、线上配置或线上服务喵~

## 20. Next Steps
- 实现客户端只读 tRPC WebSocket-first 传输和测试喵~
- 实现启动器 HTTP 反代与 `/api/trpc-ws` 只读 WebSocket bridge喵~
- 调整首屏水合门闩、补充专项测试并执行构建验证喵~
- 通过 GitHub Actions 构建/发布后，按既有备份、回滚保护和单服务部署流程验证线上本地/公网入口喵~

## 21. Change Log
- 2026-09-23：建立 `7081603c31` 修改前检查点，开始 WebSocket 优先查询与首屏白屏优化喵~

## 13. Completed Work
- 2026-09-23：新增客户端 `websocketFirstLink`，query 优先同源 `/api/trpc-ws`，连接/响应失败 900ms fallback HTTP；只读查询使用，写操作保持 HTTP，避免重复副作用喵~

## 19. Current Task
- 客户端 WebSocket-first link 已完成，待实现服务端 WebSocket bridge、启动器 HTTP 反代、首屏门闩调整及定向验证喵~

## 21. Change Log
- 2026-09-23：新增 `packages/trpc/src/client/websocketFirstLink.ts` 并接入 `packages/trpc/src/client/lambda.ts`喵~

## 5. Architecture
- 生产容器启动器现在采用双层服务：公开 `PORT` 由 Node HTTP/WS 代理监听，Next standalone 仅监听 `127.0.0.1:INTERNAL_PORT`；普通 HTTP 原样流式转发，`/api/trpc-ws` 使用只读 tRPC query bridge喵~
- WebSocket bridge 复用原 Next `/trpc/lambda/*` 处理认证、上下文、业务逻辑和 SuperJSON；bridge 不执行 mutation，客户端失败自动 fallback HTTP喵~

## 7. Configuration and Environment
- 新增可选 `INTERNAL_PORT`（默认公开 PORT + 1）与 `SERVER_LISTEN_HOST`（默认 `0.0.0.0`）；公开 `PORT` 接口保持不变喵~

## 13. Completed Work
- 2026-09-23：实现公开 HTTP 代理、同源 `/api/trpc-ws` 只读 bridge、内部 Next 回环监听及 Docker `ws` 运行依赖打包喵~

## 19. Current Task
- 客户端与服务端 WebSocket-first 主链路已落地，待首屏缓存门闩调整、测试修正和完整构建验证喵~

## 21. Change Log
- 2026-09-23：新增 `scripts/serverLauncher/realtimeServer.js`，修改 `startServer.js` 与 Dockerfile 接入双层 HTTP/WS 启动架构喵~

## 17. Failed Approaches
- 2026-09-23：定向 `bun run check ... --lint --type` 因本机 `node_modules/.bin/eslint` 缺失而未执行检查；Node 启动器语法和 `git diff --check` 已通过，不把工具未运行当作代码通过喵~

## 21. Change Log
- 2026-09-23：记录首轮脚本语法、diff 检查及本机 ESLint 缺失阻塞喵~

## 5. Architecture
- 首屏 CacheHydrationGate 只等待身份范围确定，IndexedDB 在 SWR provider 后台加载；`SWRMutateInitializer` 收到 scope hydration-ready 后触发一次当前作用域重验证喵~
- IDB hydration 采用“只填充缺失 key”策略，网络已写入的同 key 优先，避免异步缓存回填覆盖 fresh data喵~

## 9. Testing and Verification
- 新增 `CacheHydrationGate` 回归：Web 不等待 IDB、桌面身份初始化、1500ms 身份超时喵~
- 新增 `localStorageProvider` 回归：late IndexedDB hydration 不覆盖网络值喵~

## 13. Completed Work
- 2026-09-23：完成首屏缓存门闩拆分与后台 hydration 竞态保护喵~

## 19. Current Task
- 首屏门闩与后台缓存链路已完成，待补 WebSocket link/server bridge 测试并修正启动器边界，再做构建验证喵~

## 21. Change Log
- 2026-09-23：修改 `CacheHydrationGate.tsx`、`SWRMutateInitializer.tsx`、`Query.tsx`、`localStorageProvider.ts` 及对应缓存/门闩测试喵~

## 9. Testing and Verification
- 2026-09-23：定向 Vitest `CacheHydrationGate.test.tsx` 4/4、`localStorageProvider.test.ts` 19/19 通过，共 23 项；未运行全仓测试喵~

## 21. Change Log
- 2026-09-23：完成首屏/缓存定向回归，23 项通过喵~

## 9. Testing and Verification
- 2026-09-23：新增 `websocketFirstLink.test.ts` 4/4 通过，覆盖 timeout/error fallback、mutation HTTP、WS 成功；测试运行伴随既有 `D:/tsconfig.json` 路径解析提示喵~

## 17. Failed Approaches
- 2026-09-23：WebSocket link 首轮 mutation 测试使用无 observer 的 `.subscribe()`，触发 tRPC observable fixture 的 `observer.next` 异常；改为 `.subscribe({})` 后通过，非生产代码故障喵~

## 21. Change Log
- 2026-09-23：新增 `packages/trpc/src/client/websocketFirstLink.test.ts`，4项定向测试通过喵~

## 12. APIs, Interfaces, and Data Formats
- 外层普通 HTTP 代理保留端到端请求头及请求体，支持上传、mutation、SSE/流式响应；WebSocket bridge 仅接受标准 tRPC `query` 消息并返回同样的 SuperJSON envelope喵~

## 9. Testing and Verification
- 2026-09-23：实时启动器 `node --check` 通过；临时集成夹具验证 HTTP health、POST content-type/body、WS Cookie/query 和 Origin 拒绝喵~

## 21. Change Log
- 2026-09-23：修正 `realtimeServer.js` 普通 HTTP 头部转发，补齐写请求兼容性并完成本地集成验收喵~

## 2026-09-23：继续完成会话加载性能优化

- 用户再次要求继续处理会话加载慢、白屏和 WebSocket 优先查询方案，并自行完成后续验证、发布和部署喵~
- 本轮修改前检查点：`a7bc4abdff`，当前已存在客户端 WebSocket-first、服务端只读 bridge、HTTP 反代和后台缓存水合实现，跟踪工作树干净喵~
- 当前阶段：审查实现边界并补齐定向测试、Docker/生产构建、GitHub Actions、Release 和仅 LobeHub 服务的保护部署喵~

## 2026-09-23：修正 WebSocket tRPC 协议边界

- 已修正 `scripts/serverLauncher/realtimeServer.js`：内部 HTTP tRPC 成功包转换为标准 WebSocket `result.type=data`，业务错误保持标准 `error` envelope，bridge 自身错误带 `source=realtime-bridge` 喵~
- 已修正 `packages/trpc/src/client/websocketFirstLink.ts`：tRPC 业务错误不再误触发 HTTP 重复查询，连接/格式/bridge 错误仍快速降级 HTTP 喵~
- 当前待办：新增协议转换与错误分类回归，随后运行定向 lint、测试、构建和生产链路验证喵~

## 2026-09-23：WebSocket 协议回归通过

- `packages/trpc/src/client/websocketFirstLink.test.ts`：6/6 通过，覆盖超时回退、传输错误回退、业务错误直传、bridge 错误回退、mutation HTTP 和 WS 成功喵~
- `scripts/serverLauncher/realtimeServer.test.mjs`：3/3 通过，覆盖 HTTP 成功转 WebSocket data、上游 tRPC error 保留和非法 bridge 响应标记喵~
- `node --check scripts/serverLauncher/realtimeServer.js`：通过；Vitest 仅报告仓库既有 `environmentMatchGlobs` 弃用提示，不影响测试结果喵~

## 2026-09-23：定向质量检查结果

- 两组定向 Vitest 重新执行仍为 6/6 与 3/3 通过喵~
- `bun run check ... --lint` 未进入 ESLint，因为本机 `node_modules/.bin/eslint` 不存在；不把工具缺失当作代码通过喵~
- `git diff --check` 的记录文件尾随空格和控制字符已清理，跟踪源码没有新增空白错误喵~

## 2026-09-23：启动器真实集成回归

- 新增 `scripts/serverLauncher/realtimeServer.integration.test.mjs`，使用临时内部 HTTP 服务和真实 `ws` socket 验证双层启动器喵~
- 集成回归 2/2 通过：普通 POST 的 method/body/content-type 保留，WebSocket query 返回标准 data envelope 并转发 Cookie，mutation 在 bridge 层拒绝且不访问上游喵~
- 首次运行被 happy-dom 的 CORS 模拟拦截，已明确使用 Node 测试环境并等待 socket/bridge 关闭；不是生产代码问题喵~

## 2026-09-23：本机构建与类型检查边界

- 本机 `docker version` 未返回可用 daemon 信息，不能以本机 Docker 构建作为交付证据；正式镜像交给 GitHub Actions 的 `codex-build-server-image.yml` 喵~
- `bun run type-check` 启动 `tsgo --noEmit` 后超过历史约四分钟上限且无诊断，已停止；不把未完成的全仓类型检查宣称为通过喵~
- 当前可复验证据保持为：WebSocket-first 6/6、bridge envelope 3/3、真实 HTTP/WS 集成 2/2、启动器 `node --check` 通过；定向 lint 仍受本机缺失 ESLint 阻塞喵~

## 2026-09-23：WebSocket 优先查询 Release 与首轮部署

- 已在 GitHub Actions 35895283592 成功产物基础上发布 v2.2.8-codex.20260923.1，标签指向源码提交 5bd938fbea5b008d9453a84f0249fb8e87c86600，镜像、manifest、SHA256SUMS 的 GitHub digest 与本地校验一致喵~
- 远端部署前备份已完成：/mnt/sda1/lobehub-backups/20260923-websocket，保存旧镜像、数据库、Compose/.env 配置归档、容器状态、校验文件和回滚脚本，旧运行镜像 sha256:b3d69ff6973abe571002259dd210b95b10af599d2bebb18b33c2d22dc5d3e4f5 已固定喵~
- 仅执行 docker compose up -d --no-deps --force-recreate lobehub，新镜像为 sha256:6276d599c7daf689b2147f76fd48d6c59b158e66dbb78b4ad81a8f3a7191e384，容器 5863a5375da99c92516b544e1e31ee2d3022c7b13fb391aa35b1d4f15f08fa9a，内部/应用公开版本接口均返回 2.2.8，running/restart=0/OOM=false喵~
- 240秒保护脚本仍在运行，尚未写入最终确认标记；其他容器、数据库、DNS、IPv6、Nginx和Compose配置均未重启或修改喵~
- 真实未登录探针已完成 WebSocket 握手并收到响应，普通 HTTP tRPC query 返回 UNAUTHORIZED/HTTP 401；发现上游 HTTP tRPC 错误 envelope {error:{json:...}} 尚未转换为标准 WebSocket error，当前会被标记为 source=realtime-bridge 并 fallback HTTP喵~

## 2026-09-23：当前待修正边界

- 在确认本轮部署前，需修正 scripts/serverLauncher/realtimeServer.js 对 tRPC HTTP 错误 envelope 的转换，并补 realtimeServer.test.mjs 回归，确保真实业务错误不会误标为 bridge 基础设施错误喵~
- 修正后需要重新运行定向测试、推送并等待新的 GitHub Actions 镜像成功，再创建新的 Release、备份并窄部署；当前线上暂不视为最终完成喵~

## 2026-09-23：修正 tRPC HTTP 错误到 WebSocket envelope 的转换

- 已修改 `scripts/serverLauncher/realtimeServer.js`，当内部 HTTP tRPC 错误使用 `{error:{json:...}}` 结构时提取标准错误对象再返回 WebSocket，避免真实业务错误被误标为 `source=realtime-bridge` 喵~
- 当前待补 `realtimeServer.test.mjs` 回归并重新执行定向验证，未把修正视为已发布或已部署喵~

## 2026-09-23：补充 HTTP 错误 envelope 回归

- 已在 `scripts/serverLauncher/realtimeServer.test.mjs` 增加未授权 HTTP tRPC `{error:{json:...}}` 转标准 WebSocket error 的行为测试，待定向 Vitest 执行喵~

## 2026-09-23：错误 envelope 定向测试结果

- `realtimeServer.test.mjs` 4/4、`realtimeServer.integration.test.mjs` 2/2 通过，共 6 项；Vitest 仅报告仓库既有 `environmentMatchGlobs` 弃用提示喵~
- 本次命令未实际收集 `packages/trpc/src/client/websocketFirstLink.test.ts`，该客户端测试需按 package 既有方式单独执行，不能把本次 6 项当作客户端全套通过喵~

## 2026-09-23：客户端 WebSocket-first 回归复跑

- 在 `packages/trpc` 包目录按既有配置单独运行 `src/client/websocketFirstLink.test.ts`，6/6 通过喵~
- 当前本地可靠验证为 bridge 4/4、启动器集成 2/2、客户端 WebSocket-first 6/6，尚未重新构建或部署修正后的镜像喵~

## 2026-09-23：修正版 Actions 触发方式

- 修正提交 `2ae3466070` 已推送，但工作流 push path filter 不包含 `scripts/serverLauncher`，因此没有自动产生新 run喵~
- 将对同一提交手动 dispatch `Codex Build Server Image`，后续只接受该提交的成功镜像作为修正版部署产物喵~

## 2026-09-23：首轮部署保护自动回滚

- 首轮新镜像未在 240 秒保护窗口内写入确认标记，远端 guard 于 `2026-09-24 02:22:34 +08:00` 按设计执行回滚喵~
- 当前已恢复旧镜像 `sha256:b3d69ff6973abe571002259dd210b95b10af599d2bebb18b33c2d22dc5d3e4f5`，容器 `4d21a5726510151d07574ed8ca6c9cee4af6cb2f08f7bfc025ed965f25ecd79a` running/restart=0/OOM=false，版本接口仍返回 `2.2.8`喵~
- 该回滚只重建 LobeHub 服务，没有修改数据库、Redis、RustFS、SearXNG、设备网关、DNS、IPv6、Nginx 或 Compose 配置；后续修正版部署继续使用本轮备份目录喵~

## 2026-09-23：修正版 Actions 资产下载尝试

- `gh run download` 的首个 PowerShell 包装命令因执行策略拒绝，整条命令未执行，没有删除或修改任何文件喵~
- 后续使用新的专用目录直接下载成功 run `35904190592` 的镜像资产，不复用被拒绝的清理命令喵~

## 2026-09-23：GitHub CLI 资产下载卡住

- `gh run download` 对成功 run `35904190592` 建立 HTTPS 连接但超过两分钟仍未写入目标目录，已终止本轮启动的卡住进程；Actions 状态仍为 success，未影响远端服务喵~
- 下一步使用 GitHub API artifact 下载地址直接保存到新的 revision 目录，并继续校验镜像 SHA-256 喵~

## 2026-09-23：API 下载过滤器引号失败

- GitHub API artifact 下载首次因 PowerShell 传递给 `gh --jq` 的单引号表达式不符合 jq 语法而失败，没有创建下载文件或改变线上状态喵~
- 后续改为变量拼接双引号过滤表达式，继续使用同一成功 run 的 artifact ID 喵~

## 2026-09-23：gh API 输出参数兼容性

- 当前 GitHub CLI 版本的 `gh api` 不支持 `--output`，第二次下载尝试只解析出 artifact ID 后被 CLI 拒绝，未创建镜像文件喵~
- 已确认 artifact ID `10771111644`，后续改用同一 URL 的 PowerShell `Invoke-WebRequest` 直接保存并校验喵~

## 2026-09-23：修正版镜像 artifact 已下载

- Actions `35904190592` 成功 artifact 已通过 API 下载并解压到 `D:\Cursor\lobehub-backups\20260923-websocket\revision-api-2ae` 喵~
- 修正版镜像大小 `298148352` bytes，SHA-256 为 `3ca664242b6630a7d8d9efb6e15e76f40ec96f8fc0ef8343bb1ac607dda61d32`，对应源码提交 `2ae3466070` 喵~
- 原始 artifact zip 保留作为下载证据；解压后的 tar 用于后续远端校验和部署喵~

## 2026-09-23：创建 WebSocket 错误 envelope 修正版 Release 材料

- 已生成 `v2.2.8-codex.20260923.2` 的 `release-manifest.json`、LF `SHA256SUMS` 和 Release Notes喵~
- Release 目标提交为 `2ae3466070027bc5e9c3f5605915f7b29916f813`，镜像 `298148352` bytes，SHA-256 `3ca664242b6630a7d8d9efb6e15e76f40ec96f8fc0ef8343bb1ac607dda61d32`喵~
- Notes 已记录 `.1` 保护自动回滚、`.2` 的嵌套 HTTP tRPC error 转换修复、12 项定向测试及仅 LobeHub 服务部署范围喵~

## 2026-09-23：修正版 `.2` Release 已发布

- `v2.2.8-codex.20260923.2` 已发布为正式 Release，标签指向 `2ae3466070027bc5e9c3f5605915f7b29916f813` 喵~
- GitHub 资产已核验：镜像 `298148352` bytes、digest `sha256:3ca664242b6630a7d8d9efb6e15e76f40ec96f8fc0ef8343bb1ac607dda61d32`；manifest digest `sha256:ce020af3355ed509974061d7066685a939a715ccc9c62774755a529306aaf64a`；SHA256SUMS digest `sha256:5554395d9071cc40ea674eac7cab705c726250feca993327e4108e4e07019a5c` 喵~
- 第二次部署将使用远端 `/mnt/sda1/lobehub-backups/20260923-websocket/deploy-2`，保留父目录 `.1` 备份与回滚证据喵~

## 2026-09-23：第二次部署上传的远端变量引号问题

- 首次向 `deploy-2` 上传修正版镜像时，PowerShell 提前展开了远端命令中的 `$B`，远端目录未创建，三个 scp 上传均失败且未落盘喵~
- 后续用单引号保护远端 shell 变量并重新创建目录，保持本地与远端父备份不变喵~

## 2026-09-23：修正版镜像已上传远端并校验

- `deploy-2` 目录已创建，修正版镜像、manifest 和 SHA256SUMS 上传成功喵~
- 远端哈希与本地/Release 一致：镜像 `3ca664242b6630a7d8d9efb6e15e76f40ec96f8fc0ef8343bb1ac607dda61d32`，manifest `ce020af3355ed509974061d7066685a939a715ccc9c62774755a529306aaf64a`，校验清单 `5554395d9071cc40ea674eac7cab705c726250feca993327e4108e4e07019a5c` 喵~
- 下一步在远端离线 load/运行依赖检查后启动第二次 240 秒保护部署喵~

## 2026-09-23：修正版离线运行探针引号问题

- `deploy-2` 新镜像已成功 load，但首次 `docker run -e` 探针因 Windows SSH 引号传递导致 Node 代码丢失字符串引号而语法失败，未重建线上容器喵~
- 改用远端 shell 单引号包裹 Node 检查脚本重新执行，确认镜像本身未被判定为失败喵~

## 2026-09-23：修正版镜像离线运行依赖验证通过

- `deploy-2` 镜像已成功 load，离线 Node 检查通过 `@swc/helpers`、Next server、`ws`、`realtimeServer.js` 和 `startServer.js` 喵~
- 新镜像 ID 为 `sha256:ea7da67e7e837b16d66f6b984602e09a30491a530b13ed30f65bf7d84c6b1d6d`，当前线上仍是旧镜像，尚未开始第二次重建喵~

## 2026-09-23：第二次部署命令模板转义失败

- 第二次保护部署脚本首次未执行，原因是本地 JavaScript 模板字符串把远端 `${APP_URL%/}` 当作本地插值，工具在执行前报语法错误喵~
- 线上仍保持旧镜像，后续仅转义远端 shell 表达式后重试，不改变部署逻辑喵~

## 2026-09-23：修正版真实线上 WebSocket 与 IPv6 外部验收

- 远端未登录 WebSocket query 返回标准 `UNAUTHORIZED` error，`errorCode=-32001`、`errorDataCode=UNAUTHORIZED`、`bridgeSource=null`，HTTP query 仍返回 401 喵~
- 本机通过 IPv6 外部 HTTPS 访问 APP_URL `/api/version` 返回 HTTP 200 和版本 `2.2.8` 喵~
- 本机真实 `wss://` 连接握手并收到标准业务 error，未带 `realtime-bridge` source，证明修正版经过公网 IPv6 WebSocket 入口喵~
- 当前 deploy-2 guard 仍未确认，下一步核对其他服务/配置不变并等待保护窗口结束喵~
## 2026-09-23：.2 第二次保护部署因确认过晚自动回滚

- .2 第二次部署已完成内部/公开版本、远端 WebSocket 标准业务 error、HTTP 401和本机外部 IPv6 HTTPS/WSS 全部验收，但等待 180 秒后才执行最终确认，超过 guard 截止时间喵~
- deploy-2 guard 于远端 2026-09-24 03:22:00 +08:00 自动回滚到旧镜像，当前容器 9c37f0c7ecf8bb0d11a6224f34eeccaa69a171a480a5e26395b7c98a51c64807，旧镜像 running/restart=0/OOM=false，版本接口正常喵~
- 该回滚是部署确认时序问题，不是 .2 代码或 WebSocket 验收失败；保留 deploy-2 日志，第三次部署将在探针连续通过后立即写确认标记喵~
## 2026-09-24：会话首屏与 WebSocket-first 修正版最终部署完成

- 最终部署版本为 v2.2.8-codex.20260923.2，运行源码 2ae3466070027bc5e9c3f5605915f7b29916f813，Actions 35904190592 成功喵~
- 第三次保护部署于 2026-09-24 03:33:51 +08:00 开始，03:35:49 写入确认，03:35:57 写入稳定标记，03:38:38 超过原 240 秒窗口后最终复查通过喵~
- 当前容器 3d6ea49a564c8fb22225774e29e0888ee33d4f42389f0f9fe788171f7d8b4452，镜像 sha256:ea7da67e7e837b16d66f6b984602e09a30491a530b13ed30f65bf7d84c6b1d6d，running/restart=0/OOM=false喵~
- 内部 127.0.0.1:13210/api/version、应用公开 HTTPS、外部 IPv6 HTTPS 均返回 2.2.8/HTTP 200喵~
- 真实远端和外部 IPv6 wss query 均返回标准 UNAUTHORIZED 业务 error，bridgeSource=null；普通 HTTP query 返回 401，确认业务错误不触发 bridge fallback 误分类喵~
- Host Executor health 返回 200、success=true、mode=host；启动与最终日志致命模式计数为 0喵~
- 其他 7 个容器 ID/重启数/状态/镜像与部署前完全一致，Compose/.env/override 哈希一致；未修改数据库、Redis、RustFS、SearXNG、设备网关、DNS、IPv6 或 Nginx喵~
- 首轮 .1 和第二次 .2 尝试均由 guard 自动回滚并完整保留证据；第三次部署已确认，父备份 /mnt/sda1/lobehub-backups/20260923-websocket 继续作为直接回滚入口喵~

## 2026-09-24：真实跨设备消息同步与会话秒开修复

### Current Task
- 用户确认 `.20260923.2` 仍存在同一会话手机与电脑最新消息不同步，以及本地进入会话长时间等待的问题喵~
- 本轮修改前检查点为 `c1d37ced5d`；当前只更新项目记录，运行时代码、线上容器与其他服务尚未改变喵~

### Root Cause
- 当前 `websocketFirstLink` 只把普通 query 经 WebSocket 发送到外层启动器，启动器仍为每条 query 单独请求内部 HTTP tRPC；没有会话订阅、数据库变更广播或跨设备缓存失效事件，因此不能产生实时同步喵~
- WebSocket-first 截断了原 `httpBatchLink` 的批量读取能力，并增加外层 WebSocket、内部单条 HTTP 与 900ms fallback 路径；本地初始查询也可能比直接 HTTP batch 更慢喵~
- 当前 IndexedDB provider 在 React 挂载后异步扫描整个 scope；会话 hook 可能先以空内存缓存发起网络请求，现有 hydration 后全局重验证不能保证当前会话缓存优先进入 Conversation store喵~

### Design Decisions
- 普通 tRPC query 恢复 HTTP batch，WebSocket 只负责持久订阅和轻量 `messages.updated` 通知，不再代理首屏数据读取喵~
- 消息写入成功后按用户或 workspace 会话作用域发布 Redis 事件，WebSocket 服务端只接受经现有认证解析得到的可信订阅目标，不允许客户端指定任意 Redis channel喵~
- 客户端收到事件后只刷新当前会话精确 SWR key；本机正在流式生成时避免远端失效刷新覆盖流式内存，终态后再校验喵~
- 首屏按当前会话 SWR 序列化 key 直接读取 IndexedDB 单键缓存，命中后立即填充 Conversation store，再由 HTTP batch 后台校验；不等待全 scope 扫描喵~
- 广播节奏为用户消息稳定落库一次、助手终态稳定一次，不按 token/chunk 广播，避免另一设备频繁全量拉取喵~

### Next Steps
1. 先提交本轮根因与设计记录，再恢复普通 query 的 HTTP batching喵~
2. 实现认证后的会话订阅、Redis fan-out、断线清理和客户端精确失效喵~
3. 覆盖普通消息 mutation、编辑、删除、自定义上下文及 Agent Runtime 终态广播喵~
4. 实现当前会话 IndexedDB 单键快速恢复与生产挂载顺序回归喵~
5. 运行定向 Vitest、Node 语法、差异检查和 Actions 镜像构建，发布新 Release 后按既有单服务保护流程部署喵~
6. 最终使用两个独立客户端验证新消息、编辑和删除自动同步，并记录会话首个可见内容的性能结果喵~

### Implementation Status
- 已从 `packages/trpc/src/client/lambda.ts` 移除普通 query 的 WebSocket-first link，恢复 `httpBatchLink`/`httpLink` 原有分流；旧 link 与测试文件已删除，外层 bridge 暂时保留旧客户端兼容喵~
- 新增 `apps/server/src/services/message/realtime.ts`，按用户或 workspace 主体及会话上下文生成不可猜测 Redis channel，并以 best-effort 方式发布 `messages.updated`喵~
- 消息服务的创建、编辑、插入上下文、更新、删除和压缩成功路径已接入会话广播；全量删除使用主体级全局 channel，Agent Runtime 终态在稳定快照解析后广播喵~
- 新增受认证的 `message.getRealtimeSubscription`，只向外层启动器返回服务端生成的 channel；浏览器不能指定 Redis channel喵~
- `realtimeServer.js` 新增共享 Redis subscriber、channel 引用计数、subscribe/unsubscribe、断线清理、同源认证转发和 keep-alive 内部 HTTP agent；Docker 运行依赖增加 `ioredis@5.11.1`喵~
- 新增浏览器消息订阅单例与 `MessageRealtimeSync`，当前会话收到通知后精确 revalidate；流式期间延迟刷新，重连成功后补一次校验喵~
- IndexedDB 增加版本化单键读取，`useClientDataSWRWithSync` 可在全 scope hydration 前把当前消息键直接注入 SWR；网络已返回时不会被旧缓存覆盖喵~
- 当前仅完成源码初稿和 `node --check`/`git diff --check`，尚未完成 TypeScript、Vitest、真实 Redis fan-out、生产构建或部署验证喵~

## 2026-09-24：上下文压缩续接与测试修正状态

### Current Status
- 已从上下文压缩摘要续接，确认核心运行代码已提交到 `3054e7ab47`，线上仍为 `v2.2.8-codex.20260923.2` / 源码 `2ae3466070`，本轮真实订阅与会话单键缓存尚未推送、构建、发布或部署喵~
- 当前未提交内容只包含启动器并发订阅/心跳修正、缓存竞态修正及对应测试；历史未跟踪构建目录和 `问题.txt` 保持不动，禁止使用 `git add -A` 喵~

### Testing and Verification
- 缓存首轮测试发现 `mutate(..., { revalidate: false })` 会让 SWR 丢弃已经启动的旧网络响应；实现已改为先读取 IndexedDB 精确单键，再以 `fallbackData` 启动唯一一次 HTTP revalidate，回归随后通过喵~
- 已有一次合并定向运行通过 8 个文件、111 项测试；后续新增 Redis 同 channel 并发订阅引用计数与流式期间延迟刷新两项测试并分别通过，当前有效覆盖合计 113 项，提交前仍需统一复跑喵~
- 本轮源码使用现有 `node_modules/.bun/eslint@10.0.2.../eslint/bin/eslint.js` 定向检查为 0 error；`bun run check ... --lint` 因 `node_modules/.bin/eslint` 缺失未执行喵~
- `bun run check ... --type` 会忽略显式文件并执行全仓 `tsgo --noEmit`，运行约五分钟无输出后已停止，类型检查尚未验证，必须由干净 GitHub Actions 构建继续兜底喵~

### Current Task
- 下一步只显式暂存本轮测试、竞态修正与两份记录文件并提交检查点，然后统一复跑 113 项定向测试、直接 ESLint、`node --check` 和 `git diff --check` 喵~
- 验证通过后推送当前分支并触发 `.github/workflows/codex-build-server-image.yml`，仅接受绑定最终源码提交的成功镜像，再进行 Release、独立备份、240 秒保护部署和双客户端真实同步/首屏耗时验收喵~

### Verification Result
- 后续测试与竞态修正已提交为 `f0033422de`，只包含本轮 10 个目标文件，未暂存历史构建目录或 `问题.txt` 喵~
- 最终统一 Vitest 通过 9 个文件、113 项测试：消息实时 helper 3、MessageService 26、Agent Runtime Coordinator 35、启动器 envelope/broker 5、真实 HTTP/WS/订阅集成 3、Conversation 数据层 37、缓存挂载顺序 2、浏览器订阅 1、流式保护 1 喵~
- 对 `c138599aca..HEAD` 范围内 20 个 JavaScript/TypeScript 文件运行 ESLint 10.0.2 为 0 error；`node --check scripts/serverLauncher/realtimeServer.js` 与 `git diff --check c138599aca..HEAD` 均通过喵~
- 本地验证后工作区只剩任务开始前的历史未跟踪目录和 `问题.txt`；下一步更新记录提交并推送最终源码，由 GitHub Actions 执行真实镜像与 SPA 构建喵~

### Build and Artifact Verification
- 最终分支已推送，远端 `codex/deploy-server-image-20260720` 指向 `f2d03143e0766d7a0d3a61da8cf7587fe3fbd2d1`；自动触发的 GitHub Actions `35971082150` 精确绑定该提交并成功完成喵~
- Actions 中 OCI 构建、运行依赖验证、生产 SPA 导出、SPA artifact 上传和服务器镜像上传全部成功；作业耗时约 6 分 39 秒，仅有既存 Actions Node/Dockerfile secret lint/Buildx 清理警告喵~
- 新证据目录为 `D:\Cursor\lobehub-backups\20260924-realtime-sync`；服务器 artifact ZIP `298424482` bytes / SHA-256 `0c0acbe9416460837882045af580f11a72d968f90531e803d96eb2bc5f33ba03`，SPA ZIP `26233620` bytes / SHA-256 `b6a4f2a5607867ad1c64bb6177bed95730c36bc587c16e084670b215dd112b54`，均与 GitHub API digest 一致喵~
- 解包服务器镜像 tar 为 `298424320` bytes / SHA-256 `e2c22c5901dd50f6a0ae99e1573409091ddd0575cc60832851abc853f723f74d`；镜像标签 `lobehub/lobehub:codex-f2d03143e0766d7a0d3a61da8cf7587fe3fbd2d1`，平台 `linux/amd64`，运行用户 `nextjs`，入口 `/bin/node /app/startServer.js` 喵~
- 生产 SPA 共 1745 个文件，包含 `subscribeMessages`、`unsubscribeMessages`、`messages.updated` 与 `/api/trpc-ws`，未包含已删除的 `websocketFirstLink` 标记；下一步进行只读生产基线、Release 和独立保护部署喵~

### Release and Pre-deployment Baseline
- 正式 Release `v2.2.8-codex.20260924.1` 已发布，标签指向 Actions 构建源码 `f2d03143e0766d7a0d3a61da8cf7587fe3fbd2d1`；GitHub 上镜像、manifest、SHA256SUMS 的大小与 digest 均匹配本地喵~
- Release 资产 digest：镜像 `e2c22c5901dd50f6a0ae99e1573409091ddd0575cc60832851abc853f723f74d`，manifest `31ac50b89ff330a1f66d494a4bec9a4657de7a86c483dde3f2aac5698608d17c`，SHA256SUMS `f2fb2119b933cfd92bcdb82ae2e974e4bc218ec58c6c056659cd20d518579abe` 喵~
- 2026-09-24 15:53 +08:00 只读生产基线：旧容器 `3d6ea49a564c` / 镜像 `ea7da67e7e83`，running、restart=0、OOM=false；端口仍为 `127.0.0.1:13210 -> 3210`，内外 `/api/version` 正常，近 30 分钟致命日志计数 0 喵~
- PostgreSQL、Redis、RustFS、SearXNG、设备网关、Onlyboxes 与 `linuxytd` 容器均保持原 ID；Compose、`.env`、override SHA-256 分别为 `fdaca5c7...378e`、`fe096d3b...9f8c`、`e6786a2f...f047f` 喵~
- Host Executor 按实际 `HOST_EXECUTOR_BASE_URL` 只读复测返回 `success=true, mode=host`；最初固定探测 `127.0.0.1:3211` 未命中及两次远端 shell 引号/换行提示均未修改任何服务喵~
- 下一步在 `/mnt/sda1/lobehub-backups/20260924-realtime-sync` 建立新独立备份、回滚脚本与 240 秒 guard，只重建 LobeHub 服务喵~

### Deployment Backup
- 新独立备份目录 `/mnt/sda1/lobehub-backups/20260924-realtime-sync` 已创建，旧镜像 tar 约 988.6 MB / SHA-256 `b72e9694d36060a5bece763c6a5bc43734c143b944362bd04944349725777902` 喵~
- 数据库备份约 43.7 MB / SHA-256 `b5302bb9eb87f33ac710bf44859cd0e4ed9578cd64ca41da635d940c03f087f9`，配置归档 SHA-256 `b882f6278ac6751d7d98ca626a950c01f885bda99674e55f85ab2d75d9d04f7c` 喵~
- 已创建 `rollback.sh` 和等待 240 秒的 `guard.sh`，回滚只将旧镜像恢复为 `lobehub/lobehub:latest` 并使用 `docker compose up -d --no-deps --force-recreate lobehub` 重建应用喵~
- 首次 `pg_dump` 因 PostgreSQL 容器没有预期的 `POSTGRES_USER/POSTGRES_DB` 而尝试不存在的 root 角色；随后只从 LobeHub 的 `DATABASE_URL` 解析用户名和库名、不输出密码，备份成功喵~
- 续跑脚本末尾的只读 `docker inspect` 因 PowerShell stdin 追加回车而把容器名识别为 `lobehub\r`；独立命令随后确认旧容器仍为 `3d6ea49a564c`、running/restart=0/OOM=false，版本接口正常，服务从未重建喵~
- 下一步上传 Release 三项资产、远端校验并离线加载/探测新镜像；服务替换只在 guard 启动后执行喵~

### Image Staging
- Release 三项资产已上传远端 `release` 目录，`SHA256SUMS` 对镜像和 manifest 校验通过；新镜像已导入为 `lobehub/lobehub:codex-f2d03143e0766d7a0d3a61da8cf7587fe3fbd2d1`，镜像 ID `sha256:2e84ffa13a8d86712d9ba227199e2a6ab28d64775a8d0fe2bb0e53a54798e7a2` 喵~
- 首次离线探针错误检查 `/app/scripts/serverLauncher/realtimeServer.js`，而 Dockerfile 实际复制到 `/app/realtimeServer.js`；该失败只发生在临时 `docker run --rm`，运行服务未变化喵~
- 随后的内联更正命令在本地 PowerShell 解析 Node `for` 语句时失败，未执行远端命令；改用 LF 脚本后确认 `/app/realtimeServer.js`、`/app/startServer.js` 存在，`next`、`ws`、`ioredis` 可解析，`RUNTIME_PROBE_OK` 喵~
- 镜像导入和探针完成后旧线上容器仍为 `3d6ea49a564c`、旧镜像 `ea7da67e7e83`、running/restart=0/OOM=false；下一步启动 guard 并仅重建 LobeHub 喵~

### Failed Deployment and Rollback
- 2026-09-24 16:03:52 +08:00 启动首轮保护部署，只执行 `docker compose up -d --no-deps --force-recreate lobehub`；新容器持续重启，日志明确为 `Cannot find module '@ioredis/commands'` 喵~
- 根因是 Dockerfile 最小运行镜像只复制了 `ioredis` 主包，Actions 的旧运行依赖检查仅使用 `require.resolve('ioredis')`，没有真正加载模块，因此未发现传递依赖缺失喵~
- 首次手动回滚命令被本地 PowerShell 提前解释远端 `$(cat ...)`，未执行远端操作；改用单引号保护后于 16:05:38 开始回滚，16:06:30 完成喵~
- 当前已恢复旧镜像 `sha256:ea7da67e7e837b16d66f6b984602e09a30491a530b13ed30f65bf7d84c6b1d6d`，容器 `bbc91f4e2317` running/restart=0/OOM=false，内外 `/api/version` 正常，其他 7 容器保持原 ID，guard PID 已停止喵~
- 问题 Release `v2.2.8-codex.20260924.1` 不得部署；下一步完整补齐 `ioredis` 运行依赖闭包，并把 Actions/离线探针改为真正 `require('ioredis')` 和创建/关闭客户端，重新构建修正版喵~

### Runtime Dependency Fix
- 失败镜像中 `/app/node_modules/.pnpm/ioredis@5.11.1` 的完整依赖闭包存在，但单独 `COPY /deps/node_modules/ioredis` 会把根 symlink 解引用为普通目录，使模块加载时无法回到 pnpm 虚拟仓库解析 `@ioredis/commands` 等依赖喵~
- Dockerfile 已移除解引用复制，改为让 `/app/node_modules/ioredis` 指向 `.pnpm/ioredis@5.11.1/node_modules/ioredis`，并在镜像构建中断言入口文件存在喵~
- Actions 运行依赖检查已从仅 `require.resolve` 升级为真正加载 `ioredis`、创建并关闭 lazy client、加载 `/app/realtimeServer.js` 并确认 broker 导出，能在发布前捕获传递依赖缺失喵~
- 下一步运行 YAML/差异检查并提交修复，推送后只接受新提交的成功 Actions 镜像，发布 `.2` 修正版并复用现有独立备份进行第二次保护部署喵~

### Corrected Build Result
- 修复提交为 `adb31345bb58d5d06aeedef318b2d204e2b9ad80`；工作流 YAML 解析、Dockerfile/Actions 静态断言和 `git diff --check` 均通过喵~
- 推送后自动 run `35973730654` 已启动；因一次错误的完整 SHA 筛选又创建了手动 run `35973780030`，手动 run 随即取消，但 concurrency 随后取消了自动 run，二者均未产生可用镜像喵~
- 队列清空后只触发权威 run `35973965711`；该 run 绑定修复提交并成功完成 OCI 构建、真正加载 ioredis 的运行依赖验证、生产 SPA 导出和两项 artifact 上传，耗时约 9 分 16 秒喵~
- 修正版 artifact 目录为 `D:\Cursor\lobehub-backups\20260924-realtime-sync\revision-adb31345`；服务器 ZIP `298302114` bytes / SHA-256 `f1eadab57f4624187aa07ab89a9f1ca6034a23111145d1264d04830193f51ffa`，SPA ZIP `26233620` bytes / `ce2ec624acca246f161bbd598c96e97f6f40c1716b93508643cfd0f8ac36269c`，均匹配 GitHub digest 喵~
- 修正版镜像 tar `298301952` bytes / SHA-256 `893c9b5e851090971f20c18d2fb80f5227cc6981ea30ef3ae41c031712549c35`，标签 `lobehub/lobehub:codex-adb31345bb58d5d06aeedef318b2d204e2b9ad80`；下一步发布 `.20260924.2` 并执行 deploy-2 独立快照与保护部署喵~

### Corrected Release
- 正式 Release `v2.2.8-codex.20260924.2` 已发布，标签精确指向修复源码 `adb31345bb58d5d06aeedef318b2d204e2b9ad80`，不是后续仅记录提交喵~
- GitHub 资产已核验：镜像 `298301952` bytes / SHA-256 `893c9b5e851090971f20c18d2fb80f5227cc6981ea30ef3ae41c031712549c35`，manifest `2112` bytes / `e3200b3ef432836230efe570b89e96e9516d1c32bcb028df5365871bd1786ff9`，SHA256SUMS `179` bytes / `3746ca9d0e23780d1d54b250ed38471af817bed6d9944ce9094b944c1c71e4ff` 喵~
- Release Notes 已完整记录实时同步/会话单键缓存、`.1` 的 ioredis 故障与回滚、pnpm symlink 修复、增强 Actions 探针、113 项测试和仅 LobeHub 服务的部署范围喵~
- 下一步在远端备份根目录创建 `deploy-2`，保存第二次部署前容器/配置/其他服务基线，上传 `.2` 资产并使用真实 `require('ioredis')` 离线探针后启动独立 240 秒 guard 喵~

### Deploy-2 Staging
- 远端 `/mnt/sda1/lobehub-backups/20260924-realtime-sync/deploy-2` 已创建，保存第二次部署前 LobeHub inspect、其他容器、配置哈希和独立数据库快照喵~
- 第二次数据库快照约 43.7 MB / SHA-256 `2dafb1d1448bff97067393e61bdb03a90048c8b6b7094a513c27cc12fcd2ab84`；父目录旧镜像、首次数据库/配置备份和回滚脚本继续保留喵~
- `.2` Release 镜像与 manifest 远端 `sha256sum -c` 通过；新镜像 ID `sha256:8fb5d27bd5c336f3677db02ea059a2fc7de25b06137b16f290669d85e26ea368` 喵~
- 离线验证确认 `/app/node_modules/ioredis` 为 `.pnpm/ioredis@5.11.1/node_modules/ioredis` symlink，真实加载 Next、ioredis、lazy Redis client 与 `/app/realtimeServer.js` 成功，输出 `DEPLOY2_RUNTIME_PROBE_OK` 喵~
- staging 完成后线上仍为旧容器 `bbc91f4e2317`、旧镜像 `ea7da67e7e83`、running/restart=0/OOM=false；下一步启动 deploy-2 独立 guard 并只重建 LobeHub 喵~

### Deploy-2 Final Confirmation
- 2026-09-24 16:41 +08:00 只读最终快照确认 `deploy-2` guard PID `7395` 已退出，`guard.log` 记录 `confirmed=2026-09-24 16:36:28 +0800`，确认与稳定标记均存在喵~
- 当前容器仍为 `065ac2a81e4a3459fbe598d88e83332884f5d1b28571c4a87ec250f5c752c1bb`，镜像 `sha256:8fb5d27bd5c336f3677db02ea059a2fc7de25b06137b16f290669d85e26ea368`，running/restart=0/OOM=false，内部与公开 `/api/version` 均返回 `2.2.8` 喵~
- Compose、`.env`、override 三项 SHA-256 与部署前完全一致；其他 7 个服务容器 ID 和镜像与部署前完全一致，最近 15 分钟致命日志计数为 0，Redis `PING=PONG` 喵~
- 两次只读快照包装命令分别因本地 PowerShell 重定向误解析和执行策略拒绝而未执行远端主体；后续改用 Base64 编码脚本成功，首次成功脚本尾部因顶层基线通配未命中返回 1，但已取得的 guard、容器、版本与配置结果有效喵~
- 修改前检查点为 `de893bc942`；下一步使用两个独立 Playwright context 对同一真实会话执行临时上下文消息新增、编辑、删除自动同步，并记录首次与 IndexedDB 缓存后的消息可见耗时，凭据仅走内存且临时消息必须在 `finally` 清理喵~

### Live Realtime Verification Harness
- 新增 `tests/mobile-studio/verify-live-realtime.mjs`，从 stdin 接收生产 URL、会话 cookie 和会话上下文，凭据不写文件、不进入报告或日志喵~
- 脚本使用独立桌面与 iPhone 13 Playwright context，分别记录冷启动、同 context IndexedDB 暖缓存重载至锚点消息可见及 `subscription.ready` 的耗时喵~
- 写入路径只使用 `message.insertContextMessage`、`message.editMessageContent` 和 `message.removeMessage`；测试期间拦截模型生成接口，临时消息在 `finally` 删除，并要求两端都自动显示新增、编辑和删除结果喵~
- 脚本还要求两个客户端各收到至少两次订阅就绪和三次 `messages.updated`，保存仅包含临时消息的桌面/手机局部截图及无凭据 JSON 报告喵~
- `node --check`、ESLint 10.0.2 与 `git diff --check` 均通过；首轮 ESLint 仅发现 import 排序，手工修正后 0 error，尚未执行生产写入验收喵~
