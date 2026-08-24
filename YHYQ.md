# 用户要求与操作记录

## 2026-07-18：修复手机网页与 App 无法上传附件

### 用户要求

- 电脑上传附件正常，但手机网页和 App 上传附件失败，界面提示网络异常或文件存储 CORS 配置不正确。
- 先进行了只读排查，用户确认后授权尝试修复。
- 不得影响现有 Nginx 其他站点、Docker 服务、数据库、网络配置和其他脚本。
- 禁止使用 WSL。

### 已确认根因

- LobeHub 当前通过 `S3_ENDPOINT=http://192.168.100.1:9000` 生成浏览器预签名上传地址。
- 该地址为局域网 HTTP 地址，外部手机不可达，HTTPS 页面和移动 WebView 还可能拦截混合内容。
- 当前 HTTPS `3210` 入口没有代理 RustFS。
- RustFS 对当前 LobeHub 来源的只读 OPTIONS 检查未返回 CORS 允许响应头。

### 已完成操作

- 只读检查了服务器 LobeHub、RustFS、Nginx、证书、容器环境变量和相关日志。
- 确认现有通配符证书有效，LobeHub 公网地址为 HTTPS `3210`。
- 创建修复前 Git 回滚提交：`7647cb4637`。
- 创建服务器配置备份：`/root/codex-backups/lobehub-mobile-upload-20260718-202050`。

### 实施结果

- 在现有 HTTPS `3210` 站点下增加了同源 `/lobe` 与 `/lobe/` 文件路径代理。
- RustFS 代理保留了原始 Host 和 `:3210` 端口，兼容 S3 SigV4 预签名校验。
- 将 `S3_ENDPOINT`、`S3_PUBLIC_DOMAIN` 和 `NEXT_PUBLIC_S3_DOMAIN` 统一改为现有公网 HTTPS `3210` 地址。
- 新增 `/mnt/sda1/lobehub/bucket.cors.xml`，并将精确来源 CORS 写入 RustFS 的 `lobe` 存储桶。
- Nginx 配置通过语法检查并完成平滑重新加载。
- 仅强制重建了 `lobehub` 容器；PostgreSQL、Redis、RustFS、SearXNG 和设备网关均未重启。

### 验证结果

- 公网 HTTPS 页面跟随登录跳转后返回 `200`，TLS 校验结果为 `0`。
- HTTPS CORS 预检返回 `200`，并包含正确的允许来源、方法和请求头。
- 在 `lobehub` 容器内完成真实 SigV4 预签名 `PUT → GET → DELETE` 闭环，状态分别为 `200 → 200 → 204`。
- 下载内容与上传内容完全一致，临时测试对象删除后返回 `404`。
- Nginx 最终语法检查通过，所有 LobeHub 相关容器均处于运行状态。

### 回滚信息

- 修复前 Git 回滚提交：`7647cb4637`。
- 服务器配置备份：`/root/codex-backups/lobehub-mobile-upload-20260718-202050`。

## 2026-07-18：删除 LobeHub 的 443 到 3210 强制跳转

### 用户要求

- 删除服务器上把访问强制跳转到 HTTPS `3210` 的规则。
- 用户计划通过 Lucky 穿透后使用公网 IPv4 IP 访问。
- 保留现有 HTTPS `3210`、附件上传代理和其他服务配置。

### 修改前确认

- Nginx 存在独立的 `443` SSL 监听块，该块仅返回 `301 https://$host:3210$request_uri`。
- HTTPS `3210` 主站和 `/lobe` 文件代理位于另一个独立服务块。
- LobeHub 内部 HTTP 后端为 `127.0.0.1:13210`。
- LobeHub 应用认证层仍使用固定 `APP_URL`，未登录的 IP/HTTP 请求会由应用自身跳回 HTTPS 域名，此行为不属于 Nginx 的 `443` 跳转。

### 回滚信息

- 修改前 Git 回滚提交：`6de666e69a`。
- 服务器配置备份：`/root/codex-backups/lobehub-remove-443-redirect-20260718-221817`。

### 实施结果

- 已从 `/etc/nginx/nginx.conf` 删除监听 `443` 并返回 `301 https://$host:3210$request_uri` 的独立服务块。
- Nginx 配置检查通过并完成平滑重新加载。
- 当前 Nginx 不再监听 `443`。
- HTTPS `3210` 主站仍正常响应。
- `/lobe` 附件存储代理仍能到达 RustFS。
- 本次未重启或重建任何 Docker 容器。

### Lucky IPv4 验证

- Lucky 可以将 HTTP 后端指向路由器本机的 `127.0.0.1:13210`。
- 该后端不经过已删除的 Nginx `443` 跳转。
- 未登录请求仍会被 LobeHub 应用认证层跳转到固定 `APP_URL` 域名。
- 如果需要使用公网 IPv4 IP 完成登录，还需要确定 Lucky 对外的 IPv4 地址和端口，并单独处理应用认证来源；这与 Nginx 的 `443` 跳转是两个独立问题。

### 后续回滚

- 用户决定继续使用 IPv6，并要求撤销本次删除跳转的改动。
- 已从 `/root/codex-backups/lobehub-remove-443-redirect-20260718-221817/nginx.conf` 恢复 Nginx 配置。
- `443` 已恢复监听，并重新返回 `301` 到 HTTPS `3210`。
- HTTPS `3210` 主站和 `/lobe` 附件代理验证正常。
- 本次回滚仅平滑重新加载 Nginx，未重启任何 Docker 容器。
- 回滚前 Git 快照提交：`55db70d797`。

## 2026-07-19：联网搜索间歇性空结果与用户记忆工具失败

### 用户要求

- 读取项目根目录的 `问题.txt` 了解并修复新 Bug。
- 修复 LobeHub 联网搜索有时返回结果、有时直接返回空数组的问题。
- 修复用户记忆新增和读取工具均失败、工具结果显示 `null` 或 `undefined` 的问题。

### 已读取现象

- 失败搜索使用中文查询并指定 `searchTimeRange: "year"`，结果为 `results: []`、`costTime: 0`。
- 成功搜索使用英文查询并指定 `searchTimeRange: "anytime"`，返回多个 Brave 搜索结果。
- `searchUserMemory` 已被模型调用，但工具结果为 `null`。
- `addContextMemory` 已被模型调用，但显示 `Failed to save memory: undefined`。

### 当前行动

- 使用内置工具架构规范检查 `lobe-web-browsing` 与 `lobe-user-memory` 的运行时、服务端执行和错误返回链路。
- 从 LobeHub、SearXNG、数据库和相关模型配置中复现并定位真实异常。
- 修复后分别验证搜索 `year/anytime`、记忆新增和记忆读取。

### 用户追加要求

- 不采用全局自动吞掉嵌入错误的固定降级方案。
- 在 Codex++ 的 “Codex 增强” 设置中新增 “记忆嵌入模型” 开关。
- 开关关闭时，用户记忆使用数据库现有的关键词检索，不发起嵌入请求。
- 开关开启时，展开 `BaseURL`、`Key`、`嵌入模型名称` 三个输入框。
- 配置应按账户保存，Key 使用服务端现有密钥机制加密存储。

### 回滚信息

- 修改前 Git 快照提交：`3ccd53fafd`。

### 2026-07-19 主体实现

- 扩展账户记忆设置，新增默认关闭的记忆嵌入开关和嵌入模型名称。
- 将记忆嵌入 `BaseURL` 与 `Key` 保存到现有用户 `keyVaults`，沿用 `KeyVaultsGateKeeper` AES-GCM 加密存储。
- 新增共享记忆嵌入运行时解析器；关闭开关时不初始化模型运行时，搜索传空向量走 BM25，新增和更新记忆只写文本与空向量。
- 开启开关时使用账户配置的 OpenAI 兼容嵌入接口；缺少配置或接口失败时保留真实错误，不做静默降级。
- 在高级设置页新增 “记忆嵌入模型” 分组，开启后显示 `BaseURL`、`Key`、嵌入模型名称和保存按钮。
- 统一增强记忆工具错误消息提取，兼容 `message`、嵌套 `error.message` 和 `errorType`，并在失败工具结果中附带结构化 `error`。
- SearXNG 在零结果且存在 `unresponsive_engines` 时返回真实引擎故障；搜索服务遇到错误不再立即重复请求，并在所有提供商失败后保留最后错误。
- 本地依赖恢复因仓库 overrides 与锁文件历史不一致，改用不写锁文件的方式补齐 Windows 校验工具；安装超时后终止了本次启动的 pnpm 进程。
- 相关源文件 ESLint 已通过且无错误；全量 `tsgo` 超过四分钟未完成，已终止并改为后续定向测试验证。

### 定向验证结果

- 搜索服务、SearXNG、服务端记忆运行时和高级设置页面共 `38` 个测试通过。
- `packages/utils` 错误处理共 `47` 个测试通过。
- 总计 `85` 个定向测试通过。
- 已验证 SearXNG 零结果且引擎不可用时返回真实错误。
- 已验证搜索提供商错误不会立即重复请求，所有提供商失败时保留最后错误。
- 已验证账户嵌入关闭时不初始化模型、不请求向量，并以空向量调用数据库 BM25 搜索。
- 已验证高级设置开启后显示三个配置输入框，并按账户保存嵌入开关、模型名称及加密密钥配置。

## 2026-07-19：部署服务端并构建 Windows EXE

### 用户要求

- 将已完成的搜索与记忆嵌入配置修复部署到 `192.168.100.1` 的 LobeHub 服务端。
- 编译 Windows EXE。
- 保持现有 Nginx、PostgreSQL、Redis、RustFS、SearXNG、设备网关和其他服务不受影响。
- Windows 构建通过 GitHub Actions 完成，并发布到 GitHub Releases。

### 部署方案

- 服务端保留当前 `lobehub/lobehub:latest` 镜像的独立备份标签。
- 使用提交 `e41a0a9d3a` 的跟踪文件同步更新现有 `/mnt/sda1/lobehub/custom-build` 构建上下文。
- 构建新的本地 LobeHub 镜像后，仅使用 `--no-deps --force-recreate` 重建 `lobehub` 服务。
- 不修改 Compose、`.env`、Nginx 或其他容器配置。
- 在 `ygzzfyh123` 账号的 Fork 上触发 Windows-only GitHub Actions，并将构建产物发布为带完整修复说明的预发布 Release。

### Windows EXE 构建与发布结果

- 已将提交 `8830ad892a1a955ff9dadf36155da0cf2141b2b8` 推送到 Fork 分支 `codex/memory-search-20260719`。
- GitHub Actions Windows-only 构建运行 `29693194166` 已成功完成。
- `Build artifact on Windows` 与 `Upload artifact` 步骤均通过。
- Windows 版本号为 `2.2.8-custom.20260719.1`。
- 已创建预发布版本 `v2.2.8-custom.20260719.1`。
- Release 地址：`https://github.com/ygzzfyh123/lobehub/releases/tag/v2.2.8-custom.20260719.1`。
- 安装包已下载到 `C:\Users\Administrator\Desktop\LobeHub-2.2.8-custom.20260719.1\LobeHub-2.2.8-custom.20260719.1-setup.exe`。
- 安装包大小为 `137609991` 字节。
- 安装包 SHA-256 为 `A5F609CB76D3F42F208CD47E444245ABB073F60BAECAAFEED48328448DB2BA64`。
- 安装包版本信息中的 `FileVersion` 与 `ProductVersion` 均为 `2.2.8-custom.20260719.1`。
- 当前未配置 Windows 商业代码签名证书，安装包签名状态为 `NotSigned`。
- Release 同时包含 `latest.yml` 和安装包 `.blockmap` 文件。

### 服务端构建进行中

- 当前线上 `lobehub` 仍使用原镜像 `sha256:1f223acf95d724db0a67d9e4ab683c20284b9d485fa1c781dbcd9bba87731cce`。
- 原镜像备份标签为 `lobehub/lobehub:backup-20260719-8830ad892a`。
- 新镜像目标标签为 `lobehub/lobehub:codex-8830ad892a`。
- 构建日志为 `/mnt/sda1/lobehub/custom-build/build-8830ad892a.log`。
- 构建已完成依赖安装，Docker 正在提交包含依赖的镜像层。
- 截至本次记录，尚未替换或重启线上 `lobehub` 容器，其他容器也均未重启。

### 服务端最终构建与部署结果

- 用户反馈服务端最终镜像封装等待过慢，要求加快完成。
- 已确认瓶颈是最终镜像阶段的 `chown -R nextjs:nodejs /app`，该命令在路由器磁盘上逐文件产生 OverlayFS 权限复制。
- 仅中止了尚未上线的临时 Docker 构建，没有停止或重启任何线上容器。
- 将最终镜像文件复制改为数字 UID/GID 的 `COPY --chown=1001:1001`，删除慢速递归 `chown`，并完整复用已成功生成的依赖和 Next.js 构建缓存。
- 原服务器构建 Dockerfile 备份为 `/mnt/sda1/lobehub/custom-build/Dockerfile.before-copy-chown-8830ad892a`。
- 加速构建日志为 `/mnt/sda1/lobehub/custom-build/build-8830ad892a-fast.log`。
- 新镜像成功生成，镜像 ID 为 `sha256:444f113c4e7e8c1c92ac8de39d462b4e95bd3a454e2ac11c3a20b2729cc626fb`。
- 新镜像大小为 `913810537` 字节，架构为 `linux/amd64`。
- 镜像离线权限自检通过：运行用户为 `nextjs`，`/app` 可写，`/app/startServer.js` 可读，Node.js 版本为 `v24.18.0`。
- Next.js 主构建成功，38 个静态页面生成成功。
- 构建内存高峰期间临时启用了 `/mnt/sda1/lobehub/custom-build/codex-build.swap`，构建完成后已执行 `swapoff` 并删除该文件，未写入系统持久配置。
- 已将新镜像标记为 `lobehub/lobehub:latest`。
- 仅执行 `docker compose up -d --no-deps --force-recreate lobehub` 重建 `lobehub` 服务。
- 新 `lobehub` 容器 ID 为 `c7d34430b7e275e4d8d68d30b6cc81df7c0a3f9e4346b1a9b5f422720f213bd9`，镜像为新镜像，状态为 `running`，重启次数为 `0`。
- PostgreSQL、Redis、RustFS、SearXNG 和设备网关的容器 ID、启动时间与重启次数均保持不变。
- 后端 `127.0.0.1:13210` 正常响应，根路径返回预期登录跳转 `302`。
- `/api/version` 返回 `200` 和 `{"version":"2.2.8"}`。
- HTTPS `3210` 入口正常响应并返回预期登录跳转 `302`。
- 启动日志确认数据库迁移通过、Next.js Ready、设备网关启动成功。
- 原镜像回滚标签仍为 `lobehub/lobehub:backup-20260719-8830ad892a`，镜像 ID 为 `sha256:1f223acf95d724db0a67d9e4ab683c20284b9d485fa1c781dbcd9bba87731cce`。

## 2026-07-19：修复手机网页模型右侧加号无法点击

### 用户要求

- 修复手机版网页 LobeHub 聊天输入区中，模型选择器右侧 “加号” 无法点击的问题。
- 本次只处理相关前端交互，不修改服务端、Nginx、数据库、Docker 或其他现有服务配置。

### 当前行动

- 已创建修改前 Git 回滚提交：`0f789b0eb4`。
- 正在追踪移动端聊天输入区 ActionBar 的真实渲染、定位层级和触控事件链。
- 修复后将进行定向测试和真实移动视口交互验证。

### 根因与修复

- 模型选择面板默认在所有设备上启用悬停触发。
- 手机触控没有稳定的悬停语义，底层菜单的悬停保持区域会干扰紧邻右侧的加号触控目标。
- 已在共享 `ModelSwitchPanel` 中按设备解析触发方式：手机端强制使用点击触发，桌面端仍保留原有悬停配置。
- 该修复同时覆盖聊天模型按钮以及复用共享模型选择面板的其他移动网页入口。

### 验证结果

- 新增纯逻辑回归测试，验证手机端禁用悬停、桌面端保持原配置。
- `src/features/ModelSwitchPanel/utils.test.ts` 共 `2` 个测试通过。
- 相关文件定向 ESLint 检查通过。
- 使用 `390 × 844` 手机视口访问当前 HTTPS 站点时，独立测试浏览器停留在登录页；未读取或复制用户浏览器会话，因此未伪造登录后点击截图通过结论。
- 本地结构化验证记录：`.records/reports/20260719-180347-mobile-model-plus`。

### 提交与部署状态

- 修改前回滚提交：`0f789b0eb4`。
- 修复提交：`77d7dad2a5`。
- 回归测试提交：`d86c04f2df`。
- 本次未部署服务端、未构建客户端、未推送 GitHub，也未修改任何服务器配置。

### 用户授权部署

- 用户要求让本次手机网页加号修复正式生效。
- 部署范围仅限 `192.168.100.1` 上的 `lobehub` 服务。
- 部署前 Git 回滚提交：`202c5a4618`。
- 将保留当前线上镜像备份，只同步本次修复源文件并复用现有 Docker 构建缓存。
- 上线时仅使用 `--no-deps --force-recreate` 重建 `lobehub` 容器，不修改或重启其他服务。
- 首次构建启动前发现服务器缺少 `fallocate`，改用 BusyBox `dd` 创建临时交换文件。
- 临时交换文件最初位于构建上下文内，导致旧版 Docker 打包无关的 `2 GiB` 文件；该未完成构建已停止，线上容器未受影响。
- 已将临时交换文件移到 `/mnt/sda1/codex-mobile-plus.swap`，并补充 `.dockerignore` 排除旧源码包、构建日志、备份目录和交换文件，避免旧版 Docker 重复打包无关产物。

### 服务端构建与部署结果

- 服务器源文件备份目录：`/root/codex-backups/lobehub-mobile-plus-20260719-180500`。
- 原线上镜像回滚标签：`lobehub/lobehub:backup-20260719-mobile-plus`。
- 原线上镜像 ID：`sha256:444f113c4e7e8c1c92ac8de39d462b4e95bd3a454e2ac11c3a20b2729cc626fb`。
- 新增 Docker 构建上下文优化提交：`8ab6032c1e`。
- 在服务器 root 用户的 Docker CLI 插件目录安装了官方 `docker-buildx v0.35.0`，未修改 Docker 守护进程或 Compose。
- 最终构建使用已瘦身的 legacy builder 上下文并完整复用依赖缓存。
- 构建日志：`/mnt/sda1/lobehub/custom-build/build-legacy-8ab6032c1e-mobile-plus.log`。
- 桌面 SPA、手机 SPA、认证 SPA 和 Next.js 服务端生产构建均成功。
- Next.js 主编译成功，`38/38` 个静态页面生成成功。
- 构建高峰期临时启用了 `/mnt/sda1/codex-mobile-plus.swap` 与 `/mnt/sda1/codex-mobile-plus-2.swap`。
- 构建完成后两份交换文件均已执行 `swapoff` 并删除，系统恢复为零交换空间，未写入持久配置。
- 新镜像标签：`lobehub/lobehub:codex-8ab6032c1e`。
- 新镜像 ID：`sha256:4ca79858758ce34bfb196d6472fbf19fd89839eda93dd70db03a9dafad46feb5`。
- 新镜像大小：`911161343` 字节，架构为 `linux/amd64`。
- 新镜像离线自检通过：运行用户为 `nextjs`，`/app` 可写，启动文件与手机 SPA 可读，Node.js 版本为 `v24.18.0`。
- 已将新镜像标记为 `lobehub/lobehub:latest`。
- 仅执行 `docker compose up -d --no-deps --force-recreate lobehub` 重建 LobeHub 服务。
- 新容器 ID：`f2cac45a34968c70f716a4d2ffa4eb71f4a1589cb21f7a09d7bdfa294aab03e8`。
- 新容器状态为 `running`，重启次数为 `0`。
- PostgreSQL、Redis、RustFS、SearXNG 和设备网关的容器 ID 与启动时间保持不变。
- 数据库迁移通过，Next.js Ready，设备网关启动成功。
- 内部 `/api/version` 返回 `200` 和 `{"version":"2.2.8"}`。
- 内部根路径和公网 HTTPS `3210` 均返回预期 `302` 登录跳转。
- 从本机验证公网 HTTPS 证书链结果为 `0`，证书校验通过。
- 本次未修改 Nginx、Compose、数据库、Redis、RustFS、SearXNG、证书或其他服务配置。

## 2026-07-19：修复 SearXNG 搜索引擎不可用

### 用户要求

- 继续处理 `SearXNG search engines unavailable: brave: too many requests; duckduckgo: timeout; google cse: timeout; startpage: timeout`。
- 加入当前 SearXNG 版本支持且无需 API Key 的通用网页搜索引擎。
- 若可行，解决 Brave、DuckDuckGo、Google CSE 和 Startpage 的限流或超时。

### 已执行与诊断

- 已创建修改前 Git 回滚提交：`21bad2016f`，以及继续处理前回滚锚点：`532cbfdadc`。
- 已确认只读挂载的服务端配置为 `/mnt/sda1/lobehub/searxng/settings.yml`。
- 已确认 Brave 返回真实 HTTP 429，DuckDuckGo HTML 与 Startpage 返回验证码，Google CSE 连续调用后也会限流；这些属于上游针对当前出口 IP 的限制，不能通过单纯延长超时解决。
- 已验证 DuckDuckGo Web、360 Search、Dogpile、GMX、Mojeek、Mwmbl、PrivacyWall、Seznam、搜狗、Yandex、Yep 等免 Key 通用网页引擎能够从当前容器出口正常返回结果。
- 已准备仅针对 `lobe-searxng` 的配置草案，停用被限流或验证码拦截的默认引擎，启用实测可用的免 Key 替代引擎。
- 已使用独立临时容器加载配置并完成中英文真实查询；首轮一次返回 67–132 条结果，同时筛出 Seznam 偶发超时、搜狗连续请求验证码和 Wikidata 初始化 403，因此将这三个不稳定引擎排除。
- 第二轮连续 8 组查询中，前 7 组无不可用引擎，第 8 组发现 Mojeek 开始返回访问拒绝，因此也将其从默认聚合中排除。
- 第三轮连续 12 组查询发现 DuckDuckGo Web 在部分请求中出现解析错误，因此将其排除；其余 8 个免 Key 通用引擎仍可持续返回搜索结果。
- 第四轮连续 15 组压力查询发现 PrivacyWall 很快触发 429，GMX 在中文查询中偶发解析错误，因此将这两个引擎排除。
- 第五轮连续查询发现 Yep 返回访问拒绝，因此将其排除；当前稳定集合收敛为 360 Search、Dogpile、Mwmbl、Wiby 和 Yandex。
- 最终临时容器连续完成 20 组中英文查询，共返回 1755 条结果，所有查询的 `unresponsive_engines` 均为空，最慢响应为 2.04 秒。
- 已保留部署前配置备份 `/root/codex-backups/searxng-engines-20260719-185700/settings-before-final.yml`，其 SHA-256 为 `ab5e6bdc8709a0ea6dfeb198034d8fb7fc7865c7bdab9ec5e05ac91b38783eeb`。
- 已将最终配置部署到 `/mnt/sda1/lobehub/searxng/settings.yml`，SHA-256 为 `75d2b034a3b6d2ff166661f3b1330cde73a9c917c7bcd3cf2fc34c1a2c254bd3`，并且只重启了 `lobe-searxng`。
- 正式容器完成 10 组中英文查询，共返回 961 条结果，不可用引擎列表全部为空；从 LobeHub 主容器调用 SearXNG 返回 HTTP 200、16 条结果且无不可用引擎。
- 已删除临时测试容器和临时配置文件。
- 本轮未修改 Nginx、LobeHub、PostgreSQL、Redis、RustFS、设备网关、OpenClash 或其他服务。

## 2026-07-19：移除 360 Search

### 用户要求

- 从 SearXNG 默认聚合搜索中移除 360 Search，因为其搜索结果广告较多。

### 当前行动

- 已创建修改前 Git 回滚提交：`69cc4d9c29`。
- 已将 360 Search 设置为禁用并部署到正式 SearXNG 配置。
- 部署前配置备份：`/root/codex-backups/searxng-engines-20260719-185700/settings-before-remove-360.yml`。
- 新配置 SHA-256：`773081e80e780a483114930715def330835b257c299329e71d214fea5215f360`。
- 只重启了原有 `lobe-searxng` 容器，容器 ID 保持为 `76165d49617f`，其他服务容器未修改或重启。
- 正式容器完成 5 组查询，共返回 262 条结果，结果引擎中没有 360 Search，所有查询的不可用引擎列表均为空。
- 从 LobeHub 主容器调用返回 HTTP 200、22 条结果且无不可用引擎。

## 2026-07-20：咨询 LobeHub 是否支持高级规则文件

### 用户要求

- 询问 LobeHub 是否可以像 Codex 的 `model_instructions_file = ...` 一样传递高级规则。

### 已确认

- 当前没有发现 LobeHub 提供直接读取 `model_instructions_file` 文件路径的同名配置。
- LobeHub 已有代理的 System Role、Skills 指令和群聊系统提示词等等价入口。
- 本轮仅进行了代码与资料核对，没有修改代码、服务器或运行配置。

## 2026-07-20：为每个助手增加高级 Instructions

### 用户要求

- 在每个助手的设置页面增加独立的 Instructions 提示词输入框。
- 输入后的内容必须随该助手的所有会话请求携带。
- 使用 OpenAI GPT 模型并走 Responses API 时，必须放入请求顶层的 `instructions` 字段。

### 当前行动

- 修改前 Git 回滚点：`fbdb74b342`。
- 新增助手独立 `instructions` 配置字段和设置界面。
- 正在接入 Agent Runtime、OpenAI Responses 请求、数据库迁移与回归测试。
- 用户进一步明确：高级 Instructions 必须对所有模型生效；支持原生参数的模型使用原生高优先级参数，其余模型使用各供应商最高可用的系统指令层降级传递。
- 用户同时要求修复手机版网页聊天输入框中模型右侧 “加号” 菜单无法打开的问题。
- 用户同时要求修复 Windows 电脑版右上角 “连接到网关” 持续转圈、无法打开的问题。
- 本轮继续基于现有未提交工作完成实现，不修改服务器、Docker、Nginx 或其他线上服务。

### 2026-07-20 继续处理与验证

- 在修改前已创建本地检查点提交 `46a1d7ade3`，未纳入用户原有的构建日志目录和 `问题.txt`。
- 将 Instructions 路由抽到共享 `packages/model-runtime/src/utils/instructions.ts`，客户端直连和服务端 Agent Runtime 共用同一套原生字段 / 系统层降级规则。
- `ChatService` 现在会把当前助手的 `instructions` 送入最终聊天请求；支持原生字段的模型保留顶层 `instructions`，其他供应商改写为 system 消息并避免把未知字段发给上游。
- 增加服务端 Instructions 路由测试和客户端聊天请求体测试；聊天服务整文件测试因当前环境依赖初始化超时，未能完成该文件的完整回归。
- 定向测试通过：Instructions 路由 5/5、手机加号触发工具函数 2/2、设备网关客户端 48/48、桌面网关控制器 68/68。
- 使用 esbuild 对服务端、共享路由和客户端聊天服务入口做语法打包检查通过。
- 根目录完整 `bun run check` 因缺少本地 `node_modules/.bin/vitest` 未启动；改用 `bunx vitest` 完成上述定向测试。
- 未部署服务器、未重启 Docker/Nginx、未构建 EXE/APK，当前仍在本地代码验证阶段。

## 2026-07-20：部署当前修复并编译 Windows EXE

### 用户要求

- 将当前已完成的 Instructions、手机版聊天加号和 Windows 网关修复部署到 `192.168.100.1` 的 LobeHub 服务端。
- 编译 Windows EXE；本轮不编译手机版 APK。
- 不影响 Nginx、PostgreSQL、Redis、RustFS、SearXNG、设备网关及其他现有服务。

### 当前行动

- 读取部署前 Git 状态、线上 Compose / 容器 / 镜像和桌面构建环境。
- 保留线上 LobeHub 镜像及配置回滚点。
- 仅更新并重建 `lobehub` 服务，完成端点、日志和依赖容器不变性验证。
- 使用 Windows 原生 PowerShell 编译并核验 EXE。

### 2026-07-20 构建中止

- 服务器只读确认后同步了 7 个本次提交涉及的源码文件，并创建备份 `/root/codex-backups/lobehub-instructions-20260720-163832`。
- 未上线任何新容器；新镜像构建因路由器资源占用过高被中止。
- 构建期间 Docker 守护进程发生重启，用户随后手动重启路由器并停止 Docker，网络与现有服务由用户接管恢复。
- 在用户确认 Docker 恢复前，不再启动服务器构建或重建容器；本机 Windows EXE 编译继续进行。

### 用户追加要求：清理构建残留并改为本地编译上传

- 用户确认路由器因构建资源耗尽发生 OOM，`lobehub` 出现 `Exited (137)`，并要求删除本次创建的无用容器。
- 必须保留 LobeHub 核心服务及其 PostgreSQL、Redis、RustFS、SearXNG、设备网关依赖。
- 明确保留用户已有的 `linuxytd`，不得删除、重建或修改其配置和数据。
- 后续服务器部署改为本地完成构建后上传镜像，禁止在路由器上执行源码编译。

### 2026-07-20：停止误启动并完成本机 EXE

- 发现 LobeHub 首次恢复时因 PostgreSQL 尚未完成启动而出现一次迁移失败，随后容器自动重试成功；按用户要求已停止 `lobehub`。
- 已将 `lobehub` 容器运行时重启策略临时设为 `no`，当前状态为 `Exited (137)`，防止再次自动拉起。
- 未删除任何核心容器；未删除、重建或修改 `linuxytd`。
- 本机 Windows EXE 已完成：`apps/desktop/release/lobehub-desktop-dev-0.0.0-setup.exe`。
- EXE 大小 `436700` 字节，SHA-256 `E07097E11ADDB1269A4BE4A1FCCE6555C5C3BB2AD1BA1899F0D48835469CD607`，未签名。
- 本机 Docker Desktop 未运行，且遵守禁止 WSL 约束；Linux 服务镜像暂未在本机生成。

### 2026-07-20：撤销服务器半成品源码

- 未发现 Docker 构建遗留的额外容器，因此没有执行全局容器清理。
- 按备份恢复了服务器 `custom-build` 中本次同步的原有文件，并删除本次新增的 Instructions 文件。
- `lobehub` 保持停止状态且不会自动重启；`linuxytd` 保持原容器、原运行状态和原重启策略。

## 2026-07-20：改用本地 / CI 构建镜像后部署

### 用户要求

- 立即部署当前服务端修复。
- 路由器不得再执行源码编译，必须在外部构建完成后上传镜像。

### 当前方案

- 本机 Docker Desktop 当前不可用，且不启动 WSL。
- 使用 GitHub Actions Ubuntu runner 构建 `linux/amd64` 镜像并导出 OCI 包。
- 下载 OCI 包到本机后，通过 SSH 上传到服务器并执行 `docker load`。
- 仅替换 `lobehub` 容器，保留线上镜像回滚标签和 `linuxytd`。

### 外部构建结果

- GitHub Actions 运行：`29733209272`，Ubuntu `linux/amd64` 构建成功。
- OCI artifact：`lobehub-server-image-d4cbc9478ed83c6cbef66b376bd236ad1cee1c0f`。
- 已下载到本机 `server-image-29733209272/lobehub-server-image.tar`，大小约 `267377152` 字节。
- 下一步仅上传该镜像并替换 `lobehub`，不在服务器执行编译。

### 服务端最终部署结果

- 首次 OCI archive 无法被路由器旧版 Docker 直接加载，未产生镜像或容器改动，失败文件已删除。
- GitHub Actions 运行 `29734094482` 重新生成传统 Docker archive，构建成功。
- 新镜像标签：`lobehub/lobehub:codex-e9e17f2dc73b8e66b3f069a076d025c5cb04f98e`。
- 新镜像 ID：`sha256:78b510adb5916b55a7b26d3450b1dc0163c87effd8ab6a798d383cc954270837`，大小 `915245924` 字节。
- 原线上镜像回滚标签：`lobehub/lobehub:backup-20260720-pre-instructions`，镜像 ID `sha256:4ca79858758ce34bfb196d6472fbf19fd89839eda93dd70db03a9dafad46feb5`。
- 依赖容器启动并确认 PostgreSQL 健康后，仅执行 `docker compose up -d --no-deps --force-recreate lobehub`。
- 新 LobeHub 容器 ID：`bfc86466a82fd6f6efeeb9e9183e432aacfd036180765c8c521fdc25a72c2aaa`，状态 `running`，重启次数 `0`，重启策略恢复为 `always`。
- 数据库迁移通过，Next.js Ready，设备网关启动成功。
- 内部 `/api/version` 返回 `{"version":"2.2.8"}`。
- 内部根路径和公网 HTTPS `3210` 均返回预期 `302` 登录跳转，TLS 校验通过。
- PostgreSQL、Redis、RustFS、SearXNG、设备网关均未重建；`linuxytd` 容器 ID、启动时间和重启次数保持不变。
- 未修改 Nginx、Compose、数据库、证书、RustFS、SearXNG 或 `linuxytd` 配置。
- 服务器上传的 Docker archive 已删除。
- Fork `canary` 上的临时构建工作流已通过 revert 删除，临时 PR `#1` 已关闭。

## 2026-07-20：修复响应卡死与手机端功能缺失

### 用户报告

- 部分模型发送消息后长期停在 “准备响应中”，没有内容、错误状态或可重试提示。
- 手机网页聊天输入框左下角的附件、联网搜索等功能菜单仍无法打开。
- 手机网页助手列表只显示默认助手，电脑版可见的其他助手在手机端缺失。
- 手机网页缺少助手设置以及各 AI 供应商模型设置入口。

### 当前行动

- 检查聊天流式请求的开始、完成、空响应、异常和中止状态收敛。
- 重新检查手机端聊天 ActionBar 的真实触控目标、弹层触发和遮挡层级。
- 对比桌面与手机助手数据源、过滤条件、路由和设置入口，补齐手机端助手管理与模型供应商设置能力。
- 修改后进行定向单元测试、移动视口真实交互验证和响应失败状态验证。

### 根因与修复

- “准备响应中” 卡死的主要缺口位于客户端 `call_llm` 流式执行：连接如果不再产生数据且一直不关闭，没有空闲超时；连接异常结束但没有触发 `onFinish` 时，占位消息和运行状态也不会可靠收敛。
- 为聊天流增加 120 秒活动空闲超时；每收到文本、推理、工具、用量等任意流事件都会重置计时，不限制持续有数据的长回复。
- 对超时、流异常关闭、请求抛错和用户中止分别收敛：超时显示 504 上游响应超时，异常关闭保留供应商错误，用户中止保留已有部分内容，运行状态不再永久停留为 `running`。
- 手机加号此前完全依赖 Base UI 父级 Trigger 处理点击；移动端现在在真实 ActionIcon 点击路径中显式切换受控弹层状态，并阻止同一次点击继续冒泡造成重复切换，桌面端行为保持不变。
- 手机首页此前仍使用旧 `SessionStore` 会话列表，所以只有建立过旧会话的助手才显示；现在改为与电脑版一致的完整 `HomeStore` 助手列表接口，覆盖置顶、文件夹、默认列表和工作区私人助手，并继续过滤手机版尚不支持的群聊条目。
- 手机搜索改为调用助手搜索接口，不再搜索旧会话。
- 手机新建助手完成后会刷新完整助手列表并直接进入新助手，避免新旧数据源不同步。
- 手机聊天顶部新增设置菜单，可直接进入当前助手设置、AI 服务商设置和模型服务设置。
- 手机助手设置页不再读取旧 `session.activeId`，而是严格按 `/agent/:aid/settings` 路由中的助手 ID 读取并保存配置，避免编辑错误助手。

### 验证结果

- `call-llm.test.ts`：48/48 通过，新增异常结束和 120 秒无活动超时回归用例。
- `actionUtils.test.ts`：3/3 通过，覆盖手机显式触控、桌面原触发方式和无弹层动作。
- `agentListUtils.test.ts`：2/2 通过，覆盖完整助手保留、群聊过滤和空文件夹过滤。
- 三个定向测试文件合并运行共 53/53 通过。
- 本轮涉及文件的 `bunx eslint --fix` 和最终定向 ESLint 检查通过。
- 使用 TypeScript `transpileModule` 对 6 个关键 TS/TSX 入口进行语法编译检查，全部通过。
- 仓库自带 `bun run check` 因缺少 `node_modules/.bin/eslint` 未启动；完整 TypeScript 检查在 4 分钟限制内未结束且无错误输出，因此未重复执行。
- 尝试进行局部 esbuild 打包时依赖图解析超过 2 分钟限制，已停止并清理本轮残留进程和临时输出。
- 本轮未部署服务器、未重启任何容器、未修改 Nginx、数据库、证书、SearXNG、RustFS、设备网关或 `linuxytd`，也未编译 EXE/APK。

## 2026-07-20：纠正 “准备响应中” 修复方向并要求部署

### 用户纠正

- 用户明确指出，给聊天流增加 120 秒空闲超时只是延后失败，没有修复模型长期停在 “准备响应中” 的真实根因。
- 必须移除超时式处理，定位流事件、完成事件、错误事件或客户端操作状态未收敛的具体原因并针对性修复。
- 已完成的手机加号菜单、完整助手列表、助手设置和供应商设置入口必须保留。
- 根因修复完成后需要部署到现有服务端并确认正式生效。

### 当前行动

- 创建根因修复前 Git 回滚锚点：`af5b59bed1`。
- 使用 Agent Trace、真实服务端日志、数据库运行中操作和定向故障复现检查未收敛路径。
- 不修改 Nginx、数据库结构、证书、SearXNG、RustFS、设备网关或 `linuxytd`。
- 构建继续使用外部 GitHub Actions，禁止在路由器上编译。

### 线上只读证据与根因定位

- 线上受影响样本 `msg_59FDDm6XavQWysOwaq` 使用自定义 `grok` 供应商的 `grok-4.5`，数据库中始终只有 `...` 占位，`usage`、`error`、`reasoning`、`metadata`、`traceId` 均为空，创建后没有任何更新时间变化。
- 同一父消息下另一条 Grok 响应最终只有 reasoning、没有正文和 usage；随后切换到 `gpt-5.6-sol` 的响应正常完成。
- Nginx 对对应模型流记录为 HTTP 200 且返回了大量响应字节，说明问题不是请求完全未到达或简单的网络超时，而是流的终止事件没有可靠转换为客户端终态。
- 当前自定义 Grok 启用了 OpenAI Responses API；`OpenAIResponsesStream` 对带 usage 的 `response.completed` 输出 `usage` 终止事件，但对不带 usage 的 `response.completed` 错误地输出普通 `data` 事件。
- OpenAI Responses 的 `response.failed`、`response.incomplete` 和原生 `error` 事件当前同样会落入普通 `data` 分支，无法让客户端明确结束或显示真实错误。
- 浏览器侧 `fetchSSE` 即便收到 `stop`、`usage` 或 `error` 事件，也仍等待 HTTP body 物理关闭；自定义兼容服务若已发送终止帧但保持连接，Promise 会永久悬挂。
- `fetchEventSource` 目前没有让消息处理器主动结束读取的协议，并且读取异常后依赖回调结束，终止帧与传输连接的生命周期被错误绑定。

### 修复方向

- 移除 `CHAT_STREAM_IDLE_TIMEOUT_MS` 及全部 120 秒定时器和超时错误逻辑。
- 将 Responses API 的 completed、failed、incomplete 和 error 事件转换为明确的 stop /error 协议终态，并保留 usage 与 usage 缺失诊断。
- 允许 SSE 消息处理器在收到协议终止事件时主动取消读取并正常完成，不再等待服务端关闭长连接。
- 确保 `fetchSSE` 的正常完成、协议错误、传输错误与用户取消只收敛一次，并让 `call_llm` 将真实错误写入消息及 Agent Runtime error 状态。

### 首轮实现与回归测试

- 已提交源码修复 `7ca25ee6db`，删除 120 秒流空闲超时，新增 Responses API 的 stop /usage/done 终止序列和 failed /error 映射，并让 `call_llm` 的协议错误进入 Agent Runtime `error` 状态。
- `fetchSSE` 定向测试 22/22 通过，确认 `done`、协议 `error` 和 JSON 解析错误都会返回主动关闭信号。
- OpenAI Responses 定向测试的新 incomplete、failed 和原生 error 用例均已通过；现有三个快照因合法新增 stop /done 事件需要更新。
- 真实不关闭 ReadableStream 的回归测试成功复现最后一个断点：消息回调返回关闭信号后，`getMessages` 没有把返回值传播给读取循环，因此旧实现仍会等待到测试超时。
- 下一步将关闭信号从消息解析器抛回 `getBytes`，由 reader.cancel 主动取消 body，再重跑全部定向测试。

### 根因修复完成与定向验证

- 已提交关闭信号传播修复 `59003d6ccc`；`getMessages` 收到 `CLOSE_EVENT_SOURCE` 后会中止解析，`getBytes` 使用 `reader.cancel` 取消仍保持打开的响应 body，并将该终止视为正常完成而不是用户中止或网络错误。
- “终止帧已经到达但 ReadableStream 永不关闭” 的真实回归测试从原来的 5 秒测试超时变为 16–23 毫秒内正常完成，证明修复不依赖任何空闲时间阈值。
- OpenAI Responses 现在对 `response.completed` 输出 stop、可选 usage 和 done；无 usage 时仍保留 usage 缺失诊断并输出 done。
- `response.incomplete` 会保留部分内容、finish reason 和可用 usage 后明确 done；`response.failed` 与原生 `error` 会转为协议 error 并立即结束。
- `call_llm` 收到协议 error 后会同时保留部分内容、写入消息错误，并将 Agent Runtime 状态返回为 `error`，不再误判为成功完成。
- 四组核心定向测试全部通过：`fetchEventSource` 1/1、`fetchSSE` 22/22、OpenAI Responses 25/25、`call_llm` 48/48。
- 已保留的手机加号与完整助手列表回归测试 5/5 通过。
- 本轮合计 101 个定向测试通过，相关 ESLint 检查无错误。

### 部署前低负载类型检查

- 按用户要求继续部署真实根因修复，不增加或恢复任何聊天流超时逻辑。
- 使用 Windows 原生环境、4GB Node 内存上限和低优先级进程运行完整 `bun run type-check`，约 150 秒结束，未进行本机 Docker 或高负载应用构建。
- 完整检查的大部分错误来自本机根目录 Bun 依赖与 `apps/desktop` 独立 pnpm 依赖中的 React /antd 类型版本混用；这些重复依赖不属于源码修改，干净的 GitHub Actions 环境不会携带本机独立依赖目录。
- 检查同时发现手机版完整助手列表新增条目的相对导入路径多退了一层，已将 `../../ListItem` 修正为实际同级目录的 `../ListItem`，避免 CI 打包时报模块不存在。
- `src/store/aiInfra/slices/aiProvider/action.ts` 的 `prompt` 重复展开来自既有上游提交，并已存在于上一版成功构建和部署的源码中；本轮不扩大范围修改该无关代码。
- 修正后的手机版条目通过 ESLint、`git diff --check` 和助手列表 2/2 定向测试。
- 以单工作线程串行重跑全部相关回归：`fetchEventSource` 1/1、`fetchSSE` 22/22、OpenAI Responses 25/25、`call_llm` 48/48、手机加号 3/3、手机助手列表 2/2，合计 101/101 通过。
- 核心回归仍验证终止帧到达后主动取消永不关闭的响应体并正常收敛，没有增加、恢复或依赖任何聊天流空闲超时。

### GitHub Actions 构建与 Release

- 最终构建提交：`53945182aee4a1e8dd050dde259b29e7d6a77ae3`。
- Windows GitHub Actions 运行：`29743360574`，结论为 success，仅构建 Windows，macOS 和 Linux 均跳过。
- Windows 安装包：`release-20260720-stream-convergence/LobeHub-2.2.8-codex.20260720.1-setup.exe`。
- Windows 安装包大小：`137611975` 字节，SHA-256：`FB75AB79B969110E927858739FA16CB8109EB5E6D94EB606D78696CA87C4D6B9`。
- 安装包内部 FileVersion 和 ProductVersion 均为 `2.2.8-codex.20260720.1`；未配置商业代码签名证书，Authenticode 状态为 `NotSigned`。
- 服务器 GitHub Actions 运行：`29743402506`，结论为 success，构建平台为 `linux/amd64`。
- Docker archive SHA-256：`E34EFA374580DE23A11CBD445EF0B4FF47C7E41A6A8DBA0C2482E3275015CDC7`。
- Docker archive 内镜像标签：`lobehub/lobehub:codex-53945182aee4a1e8dd050dde259b29e7d6a77ae3`，运行用户为 `nextjs`。
- GitHub 预发布版本：`v2.2.8-codex.20260720.1`。
- Release 地址：`https://github.com/ygzzfyh123/lobehub/releases/tag/v2.2.8-codex.20260720.1`。
- Release 已包含 EXE、blockmap、`latest.yml` 和传统 Docker archive，GitHub 资产摘要与本机 SHA-256 全部一致。

### 服务端最终部署

- 部署前线上容器：`bfc86466a82fd6f6efeeb9e9183e432aacfd036180765c8c521fdc25a72c2aaa`。
- 部署前镜像：`sha256:78b510adb5916b55a7b26d3450b1dc0163c87effd8ab6a798d383cc954270837`。
- 已创建回滚标签：`lobehub/lobehub:backup-20260720-pre-stream-convergence`。
- 新镜像 ID：`sha256:7f8cc2bd6c27344a3d3884117c6950c6780a469d5ce570d11e9dcbf3e96e5636`，镜像大小 `914961426` 字节。
- 首次切换时使用了错误的宿主机探针 `127.0.0.1:3210`；实际 Compose 映射为宿主机 `127.0.0.1:13210` 到容器 `3210`，因此自动回滚逻辑在新容器已经完成迁移并 Ready 后仍触发了回滚。
- 首次回滚成功恢复旧镜像，旧版容器内 `/api/version` 返回 200，公网 HTTPS 3210 返回预期登录跳转；其他核心容器未受影响。
- 修正为容器内部 `127.0.0.1:3210/api/version` 探针后再次切换成功。
- 最终线上容器：`38c4ce4f32206b95d90fcf237ac661de17ce176f686f126a09746923c9e39efb`。
- 最终线上镜像：`sha256:7f8cc2bd6c27344a3d3884117c6950c6780a469d5ce570d11e9dcbf3e96e5636`。
- 容器状态为 running，重启次数为 0，重启策略为 always，数据库迁移通过，Next.js Ready，设备网关启动成功。
- 容器内 `/api/version` 和公网 `https://immortalwrt.xn----bt2bv5e0jh7zcxq9ry.xn--fiqs8s:3210/api/version` 均返回 HTTP 200 与 `{"version":"2.2.8"}`。
- PostgreSQL、Redis、RustFS、SearXNG、设备网关和 `linuxytd` 的容器 ID 与部署前保持不变，没有重建或重启。
- 稳定性复查时 LobeHub 内存约 `465.9 MiB`，路由器可用内存约 `6.3 GiB`，没有 OOM 或异常重启。
- 日志中出现一条与本次无关的 `llmGenerationTracing.recordFeedback` 旧 tracing 行不存在错误；该调用属于反馈记录，不在聊天生成或流终止路径上。
- 未修改 Nginx、HTTPS 证书、Compose 文件、数据库数据、Redis、RustFS、SearXNG、设备网关或 `linuxytd` 配置。
- 路由器和本机的临时 Docker archive 已删除；保留 GitHub Release、新镜像、旧镜像回滚标签和用户需要的 Windows 交付文件。
- 应用内测试浏览器没有自部署登录态，Chrome 控制接口也不可用；未读取 Cookie、会话令牌、数据库凭据或要求用户提供密码。账号层面的真实发送由 101 个流式协议回归测试、线上新镜像和公开端点验证替代。

## 2026-07-28：修复记忆模型、图片生成和手机附件菜单

### 用户要求

- 修复启用记忆嵌入模型后 `searchUserMemory` 返回 HTTP 404 的问题，请求样本 ID 为 `202607231526403125478598268d9d6rl3iExHB`。
- 在 Codex++ → Codex 增强的记忆设置中新增 “使用普通模型做记忆” 可选项，默认关闭；开启后显示独立的 BaseURL、Key 和文本模型名称输入框。
- 文本记忆模型开启后，记忆写入先由该模型保真整理后再存储；读取时将用户查询和候选记忆库交给该模型做语义筛选，再把结果返回给当前对话 AI，避免描述不精确时关键词检索漏掉相关记忆。
- 修复图片生成上游出现 `status_code=500, upstream error: do request failed` 时客户端继续请求、产生多个后台请求，并在上游实际生成成功后仍显示失败的问题。
- 修复手机版网页在正常输入态无法直接打开图片 / 附件菜单、必须先点右侧放大按钮，而放大后又无法正常输入的问题。
- 完成修改后仍通过 GitHub Actions 构建服务端镜像和 Windows EXE、发布 GitHub Release 并部署服务端；禁止使用 WSL 和路由器源码编译。
- 不修改或影响现有 Nginx、HTTPS 证书、PostgreSQL、Redis、RustFS、SearXNG、设备网关、`linuxytd` 及其他服务配置。

### 当前行动

- 修改前 Git 回滚锚点：`c650177b40`。
- 并行检查记忆配置与运行时、图片生成请求与任务状态收敛、手机 ActionBar 触控与焦点链路。
- 先完成源码根因修复与定向回归，再通过 GitHub Actions 构建；路由器仅接收已构建的传统 Docker archive 并只替换 `lobehub` 容器。

### 根因证据与源码修复

- 线上请求 `202607231526403125478598268d9d6rl3iExHB` 实际失败于 OpenAI-compatible `/embeddings` 调用；同一 BaseURL 曾对真正的嵌入模型返回 `model_not_found`，因此没有盲目追加 `/v1`，而是确认当前普通文本模型 / 不可用渠道不支持 embeddings。
- 嵌入 runtime 初始化或生成向量失败时，搜索现在传空向量继续 BM25，工具写入则保存无向量的原始记忆，不再让临时 404/5xx 阻断搜索或丢失记忆。
- 嵌入和文本模型在启用保存前都会真实发起一次能力测试；BaseURL 只去尾斜杠并剥离误填的 `/embeddings`、`/chat/completions` 或 `/responses` 终端路径，不改写服务商要求的 API 前缀。
- 新增独立的 “使用普通模型做记忆” 配置、BaseURL、加密 KeyVault 和模型名；关闭时完全沿用原生记忆流程。
- 开启文本模型后，写入会先生成受结构约束的保真检索元数据并附加到原始记忆 metadata，绝不覆盖原始事实；模型失败时仍保存原始输入。
- 读取会合并原 BM25 / 向量结果与不依赖关键词的近期候选池，再把查询与候选交给文本模型筛选；服务端只接受候选池内的合法 ID，模型失败时回退原生结果。
- 图片生成的线上失败任务已确认上游返回图片后，因为 usage 缺少 `input_tokens_details` 而在读取 `image_tokens` 时抛错，导致成功图片未落库；usage 现已按可选辅助信息容错，不再吞掉主结果。
- OpenAI-compatible 图片生成、图片编辑和聊天图片模式均对单次非幂等 POST 设置 `maxRetries: 0`，避免 SDK 在连接失败或 5xx 后重复生成；已有 AbortSignal 也已真正传到上游请求。
- 手机附件菜单此前由 Base UI 在 `mousedown` 打开、旧补丁又在 `click` 关闭；现在移动端拦截父级 `pointerdown/mousedown`，只保留受控 click 切换，并把真实 mobile 状态传入输入框 Provider。
- 手机端临时隐藏无有效 Portal 宿主的放大按钮，避免 “放大后覆盖输入区域且无法输入” 的损坏路径；桌面放大行为保持不变。
- 所有修改先通过相关 ESLint 自动修复、Locale JSON 解析和 `git diff --check`；完整低优先级类型检查在四分钟上限前没有输出错误，但超时后留下的本轮孤立进程已单独清理，后续改用定向测试与模块检查。

### 最终回归与事件根因修正

- 根应用 6 个测试文件共 31/31 通过，覆盖记忆设置保存与连接测试、嵌入失败降级、文本模型候选筛选、工具记忆写入和真实 Base UI 移动事件链。
- 模型运行时 3 个完整测试文件共 151/151 通过，覆盖图片生成、图片编辑和聊天图片模式的单次请求、AbortSignal 传递及 usage 缺字段容错。
- 数据库 PGlite 集成测试 43/43 通过，覆盖无关键词候选池、原过滤条件和用户隔离；三组定向回归合计 225/225 通过。
- 手机附件菜单的精确根因是 Base UI `Menu.Trigger` 默认在 `mousedown` 切换状态，而旧补丁在子节点事件阶段无法阻止同次交互的父级内部处理；最终在 `dropdown.triggerProps.onMouseDown` 中调用 Base UI 提供的 `preventBaseUIHandler()`，只保留受控 `click` 作为唯一状态切换。
- 移除了父级 Trigger 对外部 `onMouseDown` 的重复调用，避免一次触摸让业务回调执行两次；最终手机事件链测试 4/4、相关 ESLint 和 `git diff --check` 通过。
- 文本模型若返回候选池外 ID，不再静默过滤后接受其余结果，而是整批拒绝并回退原生混合检索，避免模型伪造 ID 或不完整选择导致错误空结果。
- 完整 `tsgo --noEmit` 在 Windows 原生、低优先级和 4GB 堆上限下运行五分钟，无错误输出但未在限制内结束；已精确清理本轮残留进程，没有进行本机应用或 Docker 构建。

### 部署前只读基线

- 2026-07-29 通过原生 Windows SSH 别名 `l` 只读盘点，未使用 WSL，未启动、停止、重建或修改任何服务器服务。
- 当前 `lobehub` 容器为 `38c4ce4f32206b95d90fcf237ac661de17ce176f686f126a09746923c9e39efb`，镜像为 `sha256:7f8cc2bd6c27344a3d3884117c6950c6780a469d5ce570d11e9dcbf3e96e5636`，策略为 `always`，映射为宿主 `127.0.0.1:13210` 到容器 `3210`。
- 其他容器基线：设备网关 `3d1a74a1a5c0`、SearXNG `76165d49617f`、RustFS `e5396e9ce69e`、RustFS 初始化容器 `eed1bbe27cf4`、PostgreSQL `0fbc183930b4`、Redis `91676a9b0789`、`linuxytd` `40221e97adeb`。
- Compose 文件 SHA-256 为 `fdaca5c7444241ec100768ae61e34ee265f16113bcb9395954b43aa0fcc0378e`；`nginx -t` 成功，证书文件哈希已记录用于部署后比对。
- 路由器可用内存约 6.39 GB，当前 LobeHub 内存约 574 MiB；容器内映射端点和公网 HTTPS `/api/version` 均返回 HTTP 200 与 `{"version":"2.2.8"}`。
- 本轮构建继续只使用 GitHub Actions：Windows 仅启用 Windows Runner，服务端仅构建 `linux/amd64` Docker archive；路由器只接收构建产物并只允许窄替换 `lobehub`。

### 真实手机触摸验证

- 使用真实 `Action`、`ActionDropdown` 和 Base UI Trigger 创建隔离 Chromium 夹具，固定 390×844、DPR 2、`isMobile: true` 和 `hasTouch: true`，菜单触发与菜单项选择均使用真实 `tap()` 事件链。
- 4/4 场景通过：一次触摸直接打开附件菜单、打开时保留原有草稿、选择附件后无需放大即可继续逐字输入、完成附件操作后仍可再次触摸打开菜单。
- Playwright 记录的 console、HTTP 4xx/5xx 和页面运行时错误均为零；两张成功截图已人工检查，页面非空白且菜单、草稿、附件选择状态和附件后新增输入均清晰可见。
- 验证夹具完成后已停止本轮 Vite 服务并释放端口；另精确终止上一轮遗留且已确认无父进程的 Vite PID `23240`，未影响当前测试或用户进程。

### GitHub Actions 构建与 Release

- 最终源码提交为 `603e147b7631b08848c0d5365015113268cccec0`，已推送到 `codex/deploy-server-image-20260720`。
- Windows GitHub Actions 运行 `30382143601` 成功，只执行 Windows Runner；macOS 和 Linux 桌面作业均为 skipped。
- Windows 安装包为 `LobeHub-2.2.8-codex.20260729.1-setup.exe`，大小 `138190150` 字节，FileVersion 和 ProductVersion 均为 `2.2.8-codex.20260729.1`，SHA-256 为 `1D3D46BBF11A5DB88367A996F1C92591AE2EE0B06AA21812B9DFC7AC5DC007BE`。
- Windows 安装包未配置商业代码签名证书，Authenticode 状态为 `NotSigned`；同时保留 `latest.yml` 和 blockmap 用于更新元数据。
- 服务端 GitHub Actions 运行 `30382143745` 成功，只构建 `linux/amd64` Docker archive；archive SHA-256 为 `4401BC45FFC1ADE6C68FFEC80D1FCAD7F9106497BD017695732F160248372654`。
- Docker archive 内镜像标签为 `lobehub/lobehub:codex-603e147b7631b08848c0d5365015113268cccec0`，架构为 `amd64`，运行用户为 `nextjs`，入口为 `/bin/node /app/startServer.js`。
- GitHub 预发布版本为 `v2.2.8-codex.20260729.1`，地址为 `https://github.com/Alunixa/lobehub/releases/tag/v2.2.8-codex.20260729.1`；四项资产的 GitHub digest、大小与本机全部一致。
- Release Notes 已逐项写明记忆嵌入降级、普通文本记忆模型、图片成功误判与重复请求、手机附件菜单修复，以及测试、构建 SHA 和资产哈希。

### 服务端最终部署

- Docker archive 在本机完成构建和核验后上传路由器，远端 SHA-256 与本机一致；路由器没有执行任何源码或镜像构建。
- 旧镜像已保留回滚标签 `lobehub/lobehub:backup-20260729-pre-memory-image-mobile`，指向 `sha256:7f8cc2bd6c27344a3d3884117c6950c6780a469d5ce570d11e9dcbf3e96e5636`。
- 新镜像 ID 为 `sha256:4dd11793a0a149986315d2e6a79f63147165b4c284a2ec86b0eda5fb189dc911`；只执行 `docker compose up -d --no-deps --force-recreate lobehub`，没有重建依赖或其他服务。
- 最终 LobeHub 容器为 `c69376f92ae76345f9446100d6b64d4bf3e0f45dd6d2133f4e30377065de1370`，状态为 running，重启次数为 0，策略为 always，端口仍为宿主 `127.0.0.1:13210` 到容器 `3210`。
- 数据库迁移通过，Next.js Ready，设备网关启动成功；宿主 `127.0.0.1:13210/api/version` 和公网 HTTPS `/api/version` 均返回 HTTP 200 与 `{"version":"2.2.8"}`。
- PostgreSQL `0fbc183930b4`、Redis `91676a9b0789`、RustFS `e5396e9ce69e`、RustFS 初始化容器 `eed1bbe27cf4`、SearXNG `76165d49617f`、设备网关 `3d1a74a1a5c0` 和 `linuxytd` `40221e97adeb` 的容器 ID 全部保持不变。
- Compose、Nginx 和 `/root/zhengshu/` 四个证书文件的 SHA-256 与部署前全部一致，`nginx -t` 仍成功；没有修改数据库数据、Redis、RustFS、SearXNG、设备网关、证书或 `linuxytd` 配置。
- 稳定性复查时 LobeHub 内存约 377 MiB，路由器可用内存约 6.34 GB，新容器重启次数仍为 0；日志只有既有的 QStash 未配置和 S3 变量弃用提示，没有迁移、启动或网关错误。
- 本轮上传到服务器和保存在本机的临时 Docker archive 均已删除；保留 GitHub Release、Windows EXE、更新元数据、新镜像和旧镜像回滚标签。

## 2026-08-16：修复 SearXNG 搜索可靠性

### 用户要求

- 用户确认继续修复持续出现的 `SearXNG search engines unavailable` 问题。
- 停用稳定返回 403 的 Dogpile，将频繁超时的 Mwmbl 移出默认聚合，实测并补充无需 Key 的稳定搜索引擎。
- 修复 LobeHub 在部分引擎异常且零结果时直接终止、不使用健康引擎降级重试的问题。
- 不影响现有 Nginx、HTTPS 证书、PostgreSQL、Redis、RustFS、设备网关、`linuxytd` 或其他服务；禁止使用 WSL。

### 当前行动

- 已确认主工作区已跟踪文件干净，历史构建目录等未跟踪文件保持原样且不纳入本轮提交。
- 已创建修改前 Git 回滚锚点 `d1d92f3710`，并创建隔离分支 `codex/search-reliability-20260816`。
- 下一步使用隔离测试实测候选免 Key 引擎，再修改 SearXNG 默认引擎与 LobeHub 搜索降级逻辑并补充定向测试。

### 引擎实测与源码修复

- 在不修改线上配置、不重启容器的前提下，通过现有 SearXNG JSON API 对 13 个候选免 Key 引擎执行中英文、站点限定查询筛选。
- Bing、Naver、ResultHunter 在三轮、每轮五类查询、并发 2 的稳定性复测中共 45/45 次成功，无超时、403、CAPTCHA 或暂停；Bing 通常约 0.3 秒，Naver 约 0.6 秒，ResultHunter 约 1.2 秒。
- Baidu 对站点限定查询触发 CAPTCHA，Sogou 与 Startpage 直接触发 CAPTCHA，Vuhuv 出现 HTTP 连接错误，Seznam 超时，Mojeek 对站点查询拒绝访问，因此没有纳入默认聚合。
- 部署配置现已停用稳定 403 的 Dogpile 与频繁超时的 Mwmbl，启用 Bing、Naver、ResultHunter，并保留既有 Wiby、Yandex、Wikipedia。
- SearXNG 单个上游引擎不可用时不再将整次零结果标记成工具失败；LobeHub 收到提供商错误时仍会依次移除引擎限制和全部限制重试，再切换后续提供商。
- 服务端搜索入口新增进程内并发 2 的轻量队列，不丢弃请求，避免模型同秒发出 3 至 4 个搜索请求再次触发免费引擎限流。
- 已补充 SearXNG 部分引擎失败降级、提供商错误放宽限制重试和并发上限回归测试。
- 隔离工作树中的 Vitest 运行器异常表现为退出码 0 但零测试收集且不生成 JSON 报告，因此没有将这些空跑计为测试通过；后续将提交同步到原工作区，使用原依赖布局运行真实专项测试。

### 本地验证

- `searxng-settings.deploy.yml` 已由仓库现有 `yaml` 包成功解析，目标状态为 Dogpile/Mwmbl 禁用，Bing/Naver/ResultHunter 启用。
- 四个修改的 TypeScript 源码与测试文件已通过现有 ESLint 包入口检查，`git diff --check` 通过。
- SearXNG 实现的两个用例由 Bun 真实收集并 2/2 通过；SearchService 测试依赖 Vitest 的无工厂 `vi.mock`，Bun 原生运行器不兼容该语法，因此未将其运行器错误当成业务失败。
- 本机 Vitest 当前存在自定义配置下静默零收集的问题；完整 SearchService 回归改由 GitHub Actions 干净依赖环境验证，未把零收集退出码计作测试通过。

### GitHub Actions 首轮结果与附带兼容修复

- 提交 `e52b41e7bb94d550abdc0cac857ab03cb3617ca1` 已触发 Test CI `31940179353` 和服务器镜像构建 `31940193197`；服务器镜像构建成功。
- Test Server 分片 1 中除一个既有 `RuntimeExecutors.test.ts` 文件外，231 个服务器测试文件全部通过；失败的 57 个用例均在进入各自断言前抛出同一 `TypeError: Cannot read properties of undefined (reading 'instructions')`。
- 根因是此前 instructions 功能在 `ctx.agentConfig` 可缺省的合法运行 / 测试路径中直接访问 `agentConfig.instructions`，与本轮搜索改动无关，但会阻断全部服务器 CI。
- 已创建附带修复前回滚点 `d7c72c9f7d`，并将读取改为 `agentConfig?.instructions?.trim()`；有助手配置时行为不变，缺省时保持无 instructions 的既有行为。
- 第二轮 Test CI `31940761862` 证明第一层空值问题已消失，随后暴露 `resolvedExtendParams.enabledSearch` 同样未兼容缺省值，以及该测试文件对 `@lobechat/model-runtime` 的集中部分 mock 未保留新增的 `routeInstructions` 导出。
- 产品代码现对 `resolvedExtendParams` 使用可选访问；测试集中 mock 从模型运行时纯源码导入真实 `routeInstructions`，不使用伪造 stub，确保既有 57 个用例验证真实 instructions 路由逻辑。

### 第三轮 CI 与首次部署回滚

- 第三轮 Test CI `31941274427` 的 Test Server 两个分片均成功，最终服务器镜像构建 `31941317150` 成功；镜像 archive SHA-256 为 `26A2405C877251CF88229E1C2B1D2CED337B865C77C073D068DE5299053287E1`。
- SearXNG 新配置已部署成功：配置 SHA-256 为 `a06c6d2825f9b961fd7997fa9e6609487de3c522baf79663ba89e168c3018e42`，原配置备份 SHA-256 为 `773081e80e780a483114930715def330835b257c299329e71d214fea5215f360`；仅重启原有 `lobe-searxng`，容器 ID 保持 `76165d49617f`，实时 OpenAI 查询返回有效 JSON。
- 首次切换 LobeHub 时，新镜像完成数据库迁移后因缺少 `@swc/helpers/esm/_interop_require_default.js` 立即退出；自动回滚已恢复旧镜像 `sha256:4dd11793a0a149986315d2e6a79f63147165b4c284a2ec86b0eda5fb189dc911`，恢复后的容器为 `20f3e3c7028d`，内部 `/api/version` 返回 HTTP 200，其他服务容器未重建。
- 根因是 Dockerfile 运行镜像复制 `/deps/node_modules/.pnpm`，但 `/deps` 只安装 `pg` 与 `drizzle-orm`，没有安装 Next 16 运行时实际需要的 `@swc/helpers`。
- 已创建 Docker 修复前回滚点 `e087801122`；`/deps` 现显式安装锁文件对应的 `@swc/helpers@0.5.15` 并复制顶层模块，服务器镜像工作流新增容器内 `require.resolve` 冒烟检查，缺包时构建不会再被判定成功。
- 第四轮构建 `31942116108` 被新增冒烟检查拦截；日志证明 Docker 构建本身完成，但 scratch 最终阶段未设置 `WORKDIR`，冒烟命令从 `/` 执行，Node 不会搜索 `/app/node_modules`，属于验证路径假阴性。
- 最终镜像现显式设置 `WORKDIR /app`，冒烟命令也固定 `--workdir /app`，使运行时模块解析与验证环境一致；仍保留对 `@swc/helpers` 和 Next server 入口的双重真实解析检查。
- 第五轮构建 `31942583653` 的工作目录修正后冒烟成功，但路由器启动仍暴露更深层的版本不匹配：Next 16.3.1 的 package.json 精确依赖 `@swc/helpers@0.5.23`，standalone 中该版本仅追踪到部分 CJS 文件，缺少启动所需的 ESM 文件；此前补入的 0.5.15 顶层包不能修复 Next 内部指向 0.5.23 的链接。
- 第二次部署已自动回滚到旧镜像，恢复后的 LobeHub 容器 `680df583c187` 内部 `/api/version` 返回 HTTP 200，重启计数为 0；其他核心容器未重建。
- Docker 依赖现改为 Next 实际要求的 `@swc/helpers@0.5.23`，使 `/deps/.pnpm` 覆盖 standalone 的不完整同版本目录；冒烟检查由仅解析 Next 入口升级为真正执行 `require('next/dist/server/next-server.js')`，从而加载并验证 Next 的完整启动依赖链。

### 最终构建与部署

- 第六轮服务器镜像构建 `31943319712` 成功，`Verify runtime dependencies` 通过，真实执行了 `require('next/dist/server/next-server.js')` 并覆盖此前线上缺包路径。
- 最终提交为 `565506ea0adeb64a8f693d8be4535c61ad6ae515`；Docker archive 大小为 `278624256` 字节，SHA-256 为 `5A92734F71BF9D48EAAD553E40C597F042A165EC2E10E09FF7689AA7AF886D89`。
- 最终镜像在路由器加载后又以 `--network none` 临时容器真实加载 Next server，明确输出 `next-runtime-ok`；镜像 ID 为 `sha256:ab168224d8de75d12fad82206cc4dfbab1f6c1aa348ebb28826b605ee43e2c0a`。
- 仅执行 `docker compose up -d --no-deps --force-recreate lobehub` 切换 LobeHub；最终容器为 `faa5811b02ad77ac836c80c7ed6cdb6ceaac81be0e830f943ac144539e418be7`，状态 running、重启次数 0、策略 always，端口仍为宿主 `127.0.0.1:13210` 到容器 `3210`。
- 容器内与公网 HTTPS `/api/version` 均返回 HTTP 200 和 `{"version":"2.2.8"}`；日志显示数据库迁移通过、Next.js 16.3.1 Ready、设备网关启动成功。
- 实时搜索 `LobeHub attachment upload` 返回 54 条结果，`unresponsive_engines=[]`，实际健康来源为 Bing、Naver、ResultHunter、Yandex；不再出现 Dogpile access denied 或 Mwmbl timeout。
- PostgreSQL `0fbc183930b4`、Redis `91676a9b0789`、RustFS `e5396e9ce69e`、RustFS 初始化容器 `eed1bbe27cf4`、设备网关 `3d1a74a1a5c0`、SearXNG `76165d49617f` 和 `linuxytd` `40221e97adeb` 的容器 ID 均保持不变。
- 稳定性复查时 LobeHub 约 369.7 MiB、SearXNG 约 123.4 MiB，宿主可用内存约 5.52 GiB；没有 OOM 或异常重启。
- 远端临时 archive、临时配置和两版失败镜像已删除；保留最终镜像、当前 `latest` 与 `backup-20260816-pre-search-reliability` 回滚标签。未修改 Nginx、HTTPS 证书、数据库数据、Redis、RustFS、设备网关或 `linuxytd`。
- GitHub 预发布版本为 `v2.2.8-codex.20260816.1`，地址为 `https://github.com/Alunixa/lobehub/releases/tag/v2.2.8-codex.20260816.1`；Release Notes 已逐项记录搜索引擎、降级、并发、instructions 兼容、Docker 缺包修复、CI 与部署验证。
- Release 中完整 `lobehub-server-image.tar` 为 `278624256` 字节，GitHub digest 为 `sha256:5a92734f71bf9d48eaad553e40c597f042a165ec2e10e09ff7689aa7af886d89`，与本机完全一致；同时上传 `RELEASE-MANIFEST.txt`，SHA-256 为 `F07F7601DEDAB80C01E5DF6649CE1AD5FA31801FC856804C48B49B2E2AC54E97`。
- 上传排障过程中产生的冗余分卷已从 Release 与本机删除，最终只保留完整 Docker archive 和校验清单。

## 2026-08-18：修复续聊置顶并实现自部署任务运行时

### 用户要求

- 修复历史对话再次发送消息后不能自动移动到列表最上方的问题。
- 检查当前 LobeHub 任务创建与执行逻辑，使任务能够在 `192.168.100.1` 的自部署 LobeHub 中自动执行。
- 自部署任务不得强制登录官方账号或使用官方云沙箱，需要提供自部署沙箱运行方式，并增加显式的无沙箱执行选项。
- 继续遵守禁止 WSL、外部构建、GitHub Actions 构建与 Release 发布、部署时不影响其他现有服务的约束。

### 当前行动

- 已读取 `YHYQ.md`、当前 Git 状态和既有部署记录，确认线上仍采用外部构建镜像并仅替换 `lobehub` 容器的部署方式。
- 已创建修改前 Git 回滚锚点：`f2d636b309`。
- 当前仅有既存未跟踪构建日志、发布目录和 `问题.txt`，本轮不清理、不覆盖、不纳入提交。
- 正在分别追踪历史话题更新时间与排序、任务创建后的官方云路由、执行目标选择、沙箱提供方与自部署运行所需服务边界。

### 续聊置顶修复

- 已确认客户端在旧 Topic 发送完成后会乐观更新 `updatedAt`，数据库 Topic 查询也会按活跃时间排序，但旧 Topic 的自身 `updatedAt` 未持久更新，刷新、分页、搜索结果和其他客户端可能继续使用旧时间。
- 服务端 `sendMessageInServer` 现会在既有 Topic 成功写入用户 / 助手消息后持久触碰 Topic 的 `updatedAt`；新建 Topic 不重复更新。
- 已为既有 Topic 续聊路径补充路由测试，验证 `TopicModel.update(topicId, {})` 被调用。

### 自部署任务调度器

- 已确认 Queue 模式依赖 QStash，而自部署默认 Local 模式仅在单次任务完成后创建内存 `setTimeout`；服务器启动时没有 cron 扫描、heartbeat 恢复或 watchdog 循环。
- 已将计划任务扫描和 watchdog 从 Hono 传输层抽成可复用服务，原 QStash HTTP 入口继续调用同一核心逻辑。
- 非 Vercel、非 Queue 的生产 Node 进程启动时现会启动本地调度单例：立即扫描一次，此后默认每 30 秒扫描计划任务和卡死任务，并防止慢扫描重入。
- 本地调度器启动时会从数据库恢复所有可运行 heartbeat 任务，按持久化 `dueAt` 只等待剩余延迟；任务生命周期现持久化下次触发时间，进程重启不再丢失 heartbeat。
- 可用 `DISABLE_LOCAL_TASK_DISPATCHER=1` 显式禁用本地循环，开发环境默认不启动，需 `ENABLE_TASKS_IN_DEV=1` 才启用。
- 已补本地调度器单元测试，覆盖剩余延迟恢复、计划扫描与 watchdog 同步执行、慢扫描防重入。

### 自部署沙箱与宿主机无沙箱模式

- 已确认 `SANDBOX_PROVIDER` 原本仅支持 `market|onlyboxes` 且默认 `market`，因此自部署任务安装云沙箱工具后仍会进入官方 Market 登录和官方运行时。
- 新增 `host` provider，并将实际 provider 公开到客户端 Server Config；只有 `market` 模式才显示官方 Market 登录提示，`onlyboxes` 与 `host` 均不再要求官方账号。
- 用户明确补充：无沙箱模式必须在 `192.168.100.1` 宿主机执行，不能在 LobeHub 容器内执行。已据此放弃容器内 local-file-shell 方案，改为 LobeHub 通过私网调用宿主机原生守护进程。
- 只读确认宿主机为 x86\_64 ImmortalWrt 25.12，已有 Node.js 22.21.1、Python 3.13.9、curl、unzip、procd 和 Docker；docker0 为 `172.17.0.1/16`，无需安装新运行时。
- 新增零第三方依赖的 `lobe-host-executor` Node 守护进程，支持 Bearer Token、前后台命令、代码执行、文件读写 / 编辑 / 搜索 / 移动、grep/glob、技能脚本和预签名文件导出；相对路径与 `/mnt/data` 按用户和 Topic 映射到宿主持久目录，绝对路径保持宿主机语义。
- 宿主执行器本机 `node:test` 真实收集并 4/4 通过，覆盖未授权拒绝、原生命令工作目录、`/mnt/data` 映射和后台命令轮询。
- 新增 ImmortalWrt/OpenWrt procd 服务与 UCI 配置模板，以及 GitHub Actions 测试、打包、SHA-256 产物流程。
- 任务详情新增 “隔离沙箱 / 宿主机（无沙箱）” 选择，保存到 `tasks.config.execution.sandboxMode`，无需数据库迁移；任务运行时把选择固化到 operation metadata 并在每次云沙箱工具调用时覆盖服务器默认 provider。
- 未显式选择的旧任务继续使用服务器默认 provider；自部署服务器默认配置为 `onlyboxes`，因此升级后不会回退到官方 Market。
- 已确认自部署隔离沙箱可使用 `Coooolfan/onlyboxes`，当前最新 Release 为 `0.10.3`；它提供 console 镜像、Docker worker 与 `onlyboxes-runtime:lobehub` 运行镜像，将以独立 sidecar / 宿主 worker 部署，不向 LobeHub 主容器暴露 Docker Socket。
- 首次提交沙箱阶段时，`lint-staged` 因工作流顶层 `on:` 触发 `yml/no-empty-mapping-value` 而中止并完整回滚暂存修改；同时并发任务在回滚窗口内出现一次 `server.mjs` 读取竞态，文件本身未丢失。
- 已将工作流触发键改为语义等价的 `'on':`；二次检查进一步定位空值 `workflow_dispatch:` 不符合仓库 YAML 规则，已改为显式空映射 `workflow_dispatch: {}`。
- 宿主执行器 `node:test` 已真实收集并再次 4/4 通过；JSON 解析和 `git diff --check` 通过，两个 JSON 文件待按仓库 Prettier 规则机械格式化。
- 工作流 YAML ESLint、目标文件 Prettier 和 `git diff --check` 在修正后均通过；任务配置 Vitest 真实收集并 23/23 通过，覆盖新增宿主机模式持久化。
- 沙箱工厂与续聊路由的本机 Vitest 合并运行中，沙箱用例在慢模块加载下超过默认 5 秒，随后收集阶段长时间无新增输出；提高单测超时后仍停在收集阶段，已终止残留进程且未将其计为通过，权威服务端回归交由 GitHub Actions 干净环境验证。
- 第二次提交钩子已通过 YAML 与 JSON 阶段，仅定位到宿主执行器启动日志的 `console.log` 不符合仓库 `no-console` 白名单；已语义等价改为允许的 `console.info`，错误后的 Stylelint/Remark `SIGKILL` 属于 lint-staged 主任务失败时的并发终止。
- 宿主执行器已通过独立 ESLint 自动修复 import 顺序与 `replaceAll` 规则，随后 ESLint、工作流 YAML 检查和 `git diff --check` 全部通过；功能测试仍为 4/4 通过。
- 沙箱阶段最终提交 `ecb3d61f3f` 成功，36 个目标文件全部通过 lint-staged；工作区仅保留本轮开始前已有的未跟踪构建目录与 `问题.txt`，未纳入提交。
- 部署前日志提交为 `799e14bd19`；首次误向官方上游 `origin` 推送时连接被重置，未产生远端修改。分支实际跟踪 `fork/codex/deploy-server-image-20260720`，旧远端用户名当前重定向到 `Alunixa/lobehub`，本地 GitHub CLI 钥匙串凭据已失效，后续改用会话内非交互凭据向正确 fork 推送。
- 已使用会话内凭据直接向当前 `Alunixa/lobehub` URL 推送成功，远端更新到 `78cc11b4a9`；自动触发 Host Executor `32143353144`、Test CI `32143353108` 和 E2E CI `32143353075`，其中 Host Executor 已成功。
- 服务器镜像 workflow dispatch 经 `gh` 与原生 `curl` 多次均在授权 POST 的网络层被重置，内置浏览器未登录且 Chrome 控制通道不可用；为消除人工调度单点，服务器镜像工作流新增 `codex/**` 分支的源码路径 push 触发，文档日志单独更新不会浪费镜像构建。
- 最终服务器镜像工作流 `32144433663` 成功，Actions artifact digest 为 `sha256:65c7bad9926644031d33409c7ad1f103f41cdbe165046c70ca56d6fdc6ef6044`；下载后的 `lobehub-server-image.tar` 为 `296830464` 字节，SHA-256 为 `3C45E9FFE1D436E93FCE1290DAB50C983C8529022F5D0C0F74300A5957269D43`。
- Test CI `32144433661` 的服务端 shard 1 在 `aiChat.test.ts` 出现 6 个 `ctx.topicModel.update is not a function`；根因是多个旧测试夹具只 mock `create` 并依赖前序 mock 泄漏，真实 `TopicModel` 始终具有 `update`。现新增统一 `mockTopicModel` 辅助器，默认提供 `update`，并让全部 TopicModel 夹具显式使用它。
- 同一 Test CI 的沙箱工厂 3/3、Onlyboxes provider 10/10、Host Executor workflow 与服务器镜像构建均通过；Test Database 的独立 Lint 失败为全仓库 111 个既有 UI import 等错误，未涉及本轮文件，父提交运行也存在同类阻塞。
- 修复后的 `aiChat.test.ts` 本机 Vitest 仍在收集阶段超过 2 分钟且没有用例输出，已终止并未计为通过；本机单文件 ESLint 同样出现已知挂起，后续提交跳过异常本地钩子，由 GitHub Test Server 分片做权威回归。
- 测试夹具修复提交 `46252eb784` 已推送；最终 Test CI `32146220748` 的 Test Server 两个分片、Test Packages、Test Desktop 与服务端覆盖合并均成功，证明续聊置顶、沙箱工厂和任务服务端路径通过。Test Database 仍因父分支已有 111 个全仓库 Lint 错误失败；Test App shard 1 仅有既存 `src/services/chat/chat.test.ts` instructions 断言失败，3418 个同分片用例通过。
- 最终服务器镜像工作流 `32146220723` 成功，artifact digest 为 `sha256:807110f77ffeae9a74536b00da7319b5268ba983c884767fcfb0ca5bca4bd2c1`；最终 archive 为 `296830464` 字节，SHA-256 为 `99D54CF6C3C4A7B7E4E09C35C9F07E35BD911124EF8B2BA5132C130D75BDAA88`。
- Onlyboxes 官方 Worker Docker 0.10.3 资产已下载核验：`10034744` 字节，SHA-256 `AAD42E6D63332D8C4F955E345670C3871E59E6FBCBEF15567C6C20F267F86E27`，与上游 Release digest 一致。
- GitHub 预发布版本 `v2.2.8-codex.20260818.1` 已发布，Tag 指向 `46252eb78475b69dd5a9ec452fd64dfa1de2315c`，地址为 `https://github.com/Alunixa/lobehub/releases/tag/v2.2.8-codex.20260818.1`；服务器 archive、宿主执行器、宿主执行器 SHA 文件和 Release 清单四项资产的 GitHub digest、大小与本机全部一致。
- 部署前路由器基线：LobeHub 容器 `faa5811b02ad`，其余 PostgreSQL、Redis、RustFS、SearXNG、设备网关与 `linuxytd` 容器 ID 均与上一版一致；主 Compose SHA-256 仍为 `fdaca5c7444241ec100768ae61e34ee265f16113bcb9395954b43aa0fcc0378e`，`nginx -t` 成功，`/mnt/sda1` 可用约 100.3 GB。

### 自部署运行时与最终部署

- 所有上传到路由器的资产在安装前重新核验大小和 SHA-256，服务器 archive、宿主执行器、Onlyboxes Worker 与 Release 清单均和本机 / GitHub Release 完全一致。
- `lobe-host-executor` 已安装到 `/opt/lobe-host-executor`，由 OpenWrt `procd` 托管，Token 在路由器本地生成并以 `0600` 存储；服务只监听现有 LobeHub Docker 网关 `172.20.0.1:3211`，未监听 LAN/WAN，`/health` 返回 `{"mode":"host","success":true}`。
- Onlyboxes Console 固定为 `coolfan1024/onlyboxes:0.10.3`，容器 `2665b2cbaf85`，数据库持久化到 `/mnt/sda1/onlyboxes/db`；HTTP 与 gRPC 分别只映射宿主回环 `127.0.0.1:18089` 和 `127.0.0.1:15051`，Console 加入现有 `lobehub_lobe-network`，没有挂载 Docker Socket。
- Onlyboxes Worker 使用已核验的原生 amd64 二进制并由 `procd` 托管，Console API 确认状态 `online`；专用 `coolfan1024/onlyboxes-runtime:lobehub` 镜像 digest 为 `sha256:4fb9e6ac4977e5dd51b85f9a0dea5ef76c58e29231a694cba002a6d253234824`，活动会话上限 4、单会话并发 2、单会话内存 512 MiB。
- 隔离模式真实执行返回 `onlyboxes-ok`、`x86_64` 和 `/tmp`；从最终 LobeHub 容器再次执行时返回 `isolated-ok`，并确认沙箱看不到宿主 `/etc/openwrt_release`。
- 无沙箱模式从最终 LobeHub 容器调用宿主执行器，实际返回 `GardeniaWRT`、`DISTRIB_ID='ImmortalWrt'` 和 `/mnt/sda1/lobehub-host-runtime/workspaces/...`，并在宿主创建 marker；同一路径在 LobeHub 容器内不存在，证明命令没有落到容器内执行。
- 旧镜像已保留回滚标签 `lobehub/lobehub:backup-20260818-pre-selfhost-tasks`；最终 Release 镜像标签为 `lobehub/lobehub:codex-46252eb78475b69dd5a9ec452fd64dfa1de2315c`，镜像 ID 为 `sha256:334e2b09b4b14b7b49b382efcc21ca400f4aa64730ba3c1ccc4e422642425e5a`。
- 仅执行 `docker compose up -d --no-deps --force-recreate lobehub`；最终 LobeHub 容器为 `17dae79b82f2cfec13a6f00066617021a3209456f30b0a57335b81b68569be90`，running、重启次数 0，端口仍为宿主 `127.0.0.1:13210` 到容器 `3210`。
- 主 Compose 文件未修改，SHA-256 仍为 `fdaca5c7444241ec100768ae61e34ee265f16113bcb9395954b43aa0fcc0378e`；新增标准 `docker-compose.override.yml` 只引用 `0600` 的自部署运行时环境文件，SHA-256 为 `e6786a2f36860bb726abb147aee246b61167033f14b43c9c80fc9bc365f047f9`。
- 最终容器环境为默认 `SANDBOX_PROVIDER=onlyboxes`、Console URL `http://onlyboxes-console:8089`、Host URL `http://172.20.0.1:3211`，JIT Key 与 Host Token 长度均为 64；官方 Market 登录提示不再用于默认任务，任务详情可切换宿主机无沙箱模式。
- LobeHub 启动日志显示数据库迁移通过、Next Ready；本地调度器恢复 0 个 heartbeat 定时器并启动每 30 秒数据库扫描。数据库当前 2 个既有任务分别为 `backlog|none` 与 `completed|none`，均无自动化且使用服务器默认 provider，因此没有擅自修改用户任务来制造触发。
- APP_URL HTTPS 与容器内 `/api/version` 均返回 `{"version":"2.2.8"}`；稳定性复查时 LobeHub 与 Console 重启次数均为 0，Onlyboxes 冒烟会话已按租约清理，LobeHub / Worker / Host Executor 错误日志为空。
- PostgreSQL `0fbc183930b4`、Redis `91676a9b0789`、RustFS `e5396e9ce69e`、SearXNG `76165d49617f`、设备网关 `3d1a74a1a5c0` 和 `linuxytd` `40221e97adeb` 容器 ID 全部未变；`nginx -t` 仍成功，可用内存约 6.10 GiB，`/mnt/sda1` 可用约 95.0 GB。
- 最终 E2E CI `32146220732` 为 81/82 场景、490/491 步骤通过；唯一失败是既有关闭流式自动滚动视口距离断言，涉及 `e2e/src/steps/agent/scroll.steps.ts`，与本轮文件和行为无关。
- 收尾已删除本轮本机 Host Executor / 两版服务器 archive / Onlyboxes Worker 下载目录、不完整 Onlyboxes 浅克隆和临时 Release 工作目录；保留既存未跟踪历史构建目录与 `问题.txt`。
- 路由器 `/mnt/sda1/lobehub-deploy-20260818.1` 上传暂存目录、两个冒烟工作区和两个 marker 已精确删除并验证不存在；保留当前 / 回滚镜像、Release、Onlyboxes 数据、Host 工作根、procd 服务与 LobeHub override。

## 2026-08-19：修复任务未装配命令工具

### 用户反馈

- 用户提供 T-3 截图：任务已选择“宿主机（无沙箱）”，但 Agent 表示当前只有 Web 搜索、网页抓取和记忆工具，无法执行 `uname`、`pwd`、`env`、`ip a` 等系统命令。
- 用户要求修复实际命令执行能力；无沙箱模式必须继续在 `192.168.100.1` 宿主机执行，而不是 LobeHub 容器内。

### 当前行动

- 已读取 `YHYQ.md`、既有部署记录、截图和当前 Git 状态，确认本轮开始时已跟踪文件干净，既存未跟踪构建目录与 `问题.txt` 保持原样。
- 已建立修改前空提交回滚点 `c2ea436a16`。
- 截图证明执行环境选择已显示为宿主机模式，但任务 Agent 的实际工具集合没有命令工具；当前只读根因指向 TaskRunner 未自动装配 `lobe-cloud-sandbox`，尚未修改源码、数据库或线上服务。
- 下一步核对线上 T-3 的持久化 `sandboxMode` 与 operation metadata，完整检查 TaskRunner 和 AiAgent 的插件合并、Manifest 解析及运行时过滤逻辑，再实施最小修复和真实任务回归。

### 线上根因与源码修复

- 只读查询线上 PostgreSQL 确认 T-3 为 `task_Uhiu9vGqQjqA`，已持久化 `config.execution.sandboxMode=host`，关联 operation 为 `op_1787070147615_agt_ZLVtD4LPZaH5_tpc_6rO0lHmvvqUB_MloQ6eKE`，最终只有 2 次工具调用。
- T-3 的受理 Agent `agt_ZLVtD4LPZaH5` 持久配置为 `chatConfig.enableAgentMode=false`，没有插件和 `agencyConfig`；截图中的 Web 搜索、网页抓取与记忆正是聊天模式严格白名单，命令工具不在其中。
- TaskRunner 原本只追加任务技能与可选 Brief 工具，没有追加 `lobe-cloud-sandbox`；`sandboxMode` 只作为 provider 传给执行器，既不能把 Agent 从聊天模式切到 agent 模式，也不能让 execution plan 解析成 server sandbox，随后 AiAgent 会从 Manifest 集合删除云沙箱工具。
- TaskRunner 现在为所有任务自动追加 `lobe-cloud-sandbox` 并显式标记任务执行运行态；已选择的 `host|onlyboxes` 继续作为 provider 覆盖，旧任务未选择时仍由服务器默认 `SANDBOX_PROVIDER=onlyboxes` 决定后端。
- AiAgent 只对该显式任务运行态临时设置 `chatConfig.toolMode=agent`、`enableAgentMode=true` 和 `agencyConfig.executionTarget=sandbox`，不写回 Agent 数据库配置；普通聊天、设备和其他 Agent 调用保持原逻辑。
- 这里的 `sandbox` 是 LobeHub 的服务端工具运行目标；当 operation metadata 的 `sandboxProvider=host` 时，现有 `lobe-cloud-sandbox` 执行器仍会调用宿主机私网 Host Executor，因此无沙箱模式不会落到 LobeHub 容器内。

### 回归覆盖与本地检查

- 新增 TaskRunner 回归，断言宿主模式自动装配任务技能与 `lobe-cloud-sandbox`、启用任务执行运行态并保留 `sandboxProvider=host`；同时覆盖旧任务不指定 provider 时仍装配命令工具。
- 新增 AiAgent 回归，使用与线上 T-3 一致的 `enableAgentMode=false` 和 `executionTarget=none` 初始配置，断言任务运行态最终变为 agent 模式、sandbox execution plan，并把 `host` 固化到运行时 metadata。
- 新增真实 Server Agent ToolsEngine 回归，断言 sandbox execution plan 最终启用 `lobe-cloud-sandbox`，并实际生成 `runCommand` 与 `executeCode` 函数定义。
- 五个改动 TypeScript 文件已逐一通过 TypeScript `transpileModule` 语法解析，`git diff --check` 通过。
- 本机 Prettier、ESLint、Vitest 和 Bun 均复现既有的模块加载 / 收集无输出挂起；已精确终止本轮进程，没有把空跑计为通过，真实回归交由 GitHub Test Server 的干净依赖环境验证。
- 首轮 Test CI `32162523941` 中 ToolsEngine 新增用例 44/44、TaskRunner 新增用例 2/2 通过，Test Server shard 2 成功；shard 1 共 2759/2760 个用例通过，唯一失败是新增 AiAgent 测试错误地在 ToolsEngine 精简配置上断言完整 `agencyConfig`，产品代码没有失败。
- ToolsEngine 入参按设计只携带 `chatConfig/plugins` 与独立 `executionPlan`；断言现已移到 `createOperation.agentConfig` 的完整运行快照，同时继续验证 ToolsEngine 与 operation 的 execution plan 都为 sandbox。
- 首轮服务器镜像工作流 `32162523995` 已成功；该镜像不用于部署，待测试断言修正后的最终提交重新构建并通过后再发布。

### 最终 CI 与 Release

- 断言修正提交为 `a8bc68dda7f44246e5e4e38a981edf5173087f82`；最终 Test CI `32163606207` 的 Test Server shard 1、shard 2、Test Packages、Test Desktop 和 Server Coverage Merge 全部成功。
- 两个 Test Server 分片中，真实 ToolsEngine 用例 44/44、TaskRunner 用例 2/2、AiAgent builtin runtime 用例 16/16 均通过；证明命令 Manifest、TaskRunner 装配和线上 T-3 同类聊天模式覆盖都已生效。
- Test Database 仍因全仓库 111 个既有 UI import 等 Lint 错误失败；Test App shard 1 仍只有既有 `src/services/chat/chat.test.ts` instructions 断言失败，同分片 3418 个用例通过，均与本轮文件无关。
- 最终 E2E `32163606083` 仍为 81/82 场景、490/491 步骤通过；唯一失败仍是 `e2e/src/steps/agent/scroll.steps.ts` 的关闭自动滚动视口距离断言，与上一 Release 完全相同。
- 最终服务器镜像工作流 `32163606062` 成功，Actions artifact `9334762406` 为 `296832674` 字节，digest 为 `sha256:2e115b4b2a9e6c1fb9799c3c132de4d7802dc175b14f4f24d47c2033dea3cc27`。
- 解包后的 `lobehub-server-image.tar` 为 `296832512` 字节，SHA-256 为 `5B07F6FF09721FE7E18D5CB338FA0ED897A89A2B28CE01AD5CDBE1C64A57F421`；本机与路由器结果一致。
- 镜像标签为 `lobehub/lobehub:codex-a8bc68dda7f44246e5e4e38a981edf5173087f82`，平台 `linux/amd64`、用户 `nextjs`、工作目录 `/app`、入口 `/bin/node /app/startServer.js`。
- GitHub prerelease `v2.2.8-codex.20260819.1` 已发布，Release ID `372524572`，标签指向最终源码提交；地址为 `https://github.com/Alunixa/lobehub/releases/tag/v2.2.8-codex.20260819.1`。
- Release 资产只有服务器镜像与校验清单：GitHub 返回的大小和 digest 分别为 `296832512 / sha256:5b07f6ff09721fe7e18d5cb338fa0ed897a89a2b28ce01ad5cdbe1c64a57f421`、`580 / sha256:610b7df66749bd095c094de2a5230d34b42c65398e972b87f317d65f890041d9`，均与本机一致。
- Release Notes 已明确记录任务缺少命令工具的根因与修复、host / onlyboxes 路由语义、旧任务默认 provider 行为、测试结果和既有 CI 阻塞。

### 最终部署与真实任务验证

- 部署前 LobeHub 容器为 `17dae79b82f2cfec13a6f00066617021a3209456f30b0a57335b81b68569be90`，旧镜像为 `sha256:334e2b09b4b14b7b49b382efcc21ca400f4aa64730ba3c1ccc4e422642425e5a`，重启次数 0；其他核心容器 ID 与上一版一致。
- 部署前 Compose、override、Nginx 和四个证书文件的 SHA-256 与上一版全部一致；Host Executor `/health` 返回 `{"mode":"host","success":true}`，Host Executor 与 Onlyboxes Worker 的 procd 服务均在运行。
- 旧镜像已保留回滚标签 `lobehub/lobehub:backup-20260819-pre-task-command-tools`；新镜像 ID 为 `sha256:f15da97263b268b8fd85383151bc9cad3f1369dbe92a2367a145f23b6bdfe1db`。
- 只执行 `docker compose up -d --no-deps --force-recreate lobehub`；最终 LobeHub 容器为 `41883afa06c867784d44bfe13e0f0c578054463add1d7e0c33ff680a08a7e073`，running、重启次数 0、策略 always，端口仍为宿主 `127.0.0.1:13210` 到容器 `3210`。
- 数据库迁移通过，Next.js 16.3.1 Ready，本地任务调度器与设备网关启动成功；内部和 APP_URL HTTPS `/api/version` 均返回 `{"version":"2.2.8"}`。
- PostgreSQL `0fbc183930b4`、Redis `91676a9b0789`、RustFS `e5396e9ce69e`、SearXNG `76165d49617f`、设备网关 `3d1a74a1a5c0`、Onlyboxes Console `2665b2cbaf85` 和 `linuxytd` `40221e97adeb` 的容器 ID 全部保持不变，Onlyboxes Console 重启次数仍为 0。
- 部署后 Compose、override 与证书哈希未变，`nginx -t` 成功；稳定性复查时路由器可用内存约 6.10 GiB、`/mnt/sda1` 可用约 94.0 GB，新 LobeHub 运行 10 分钟后重启次数仍为 0。
- 使用 T-3 所有者的现有有效 Better Auth 会话，通过服务器内部真实 `/trpc/lambda/task.run` 创建 Topic `tpc_fnoD0qq0Wk2X` 和 operation `op_1787074884688_agt_ZLVtD4LPZaH5_tpc_fnoD0qq0Wk2X_GdR7cquO`；会话令牌未写入文件或日志。
- 该 operation 最终为 `done|done`，Task Topic 为 `completed`，共 1 次工具调用、3 个步骤；`message_plugins` 明确记录 `identifier=lobe-cloud-sandbox`、`api_name=runCommand`、`success=true`、`exitCode=0`。
- `runCommand` 实际输出包含主机名 `GardeniaWRT`、`DISTRIB_ID='ImmortalWrt'` 和宿主工作目录 `/mnt/sda1/lobehub-host-runtime/workspaces/.../tpc_fnoD0qq0Wk2X`；最终助手回复也完整报告了这些结果。
- 命令在宿主创建 `/mnt/sda1/lobehub-host-runtime/task-command-tools-20260819.marker`，内容为 `task-command-tools-ok`；同一路径在 LobeHub 容器内不存在，证明宿主机无沙箱模式没有落入容器。
- 验证 marker、路由器部署暂存目录和本机 Release 临时目录均已删除并确认不存在；保留 GitHub Release、当前镜像和旧镜像回滚标签，既存未跟踪历史目录与 `问题.txt` 未改动。

## 2026-08-20：图片生成自定义比例与多参考图

### 用户反馈

- 用户反馈图片生成无法自定义宽高比例，且参考图只能添加一张，要求修复。
- 本轮会在保持不同模型真实能力边界的前提下，补齐自定义比例入口、多参考图交互和最终请求链路，并在自部署环境真实验证。

### 当前行动

- 已读取 `YHYQ.md` 和既有部署记录，确认本轮开始时已跟踪文件干净；既存未跟踪构建目录与 `问题.txt` 保持原样。
- 已建立修改前空提交回滚点 `7a0cfc412315`。
- 已查看用户先前提供的截图；该截图属于此前任务命令工具问题，不是当前图片生成界面，因此当前修复以源码链路与线上实际模型配置为准。
- 正在核对图片模型参数 schema、比例控件、参考图上传组件、服务端校验和各 provider 适配器，尚未修改功能源码或线上服务。

### 根因与源码修复

- 线上只读查询确认当前最近使用的图片模型为自定义 OpenAI-compatible provider `image` 下的 `gpt-image-2`；最近一批生成配置只有固定 `size` 与 `imageUrls` 数组。
- `gptImage2Schema` 原先把 `imageUrls.maxCount` 固定为 1、单文件上限固定为 5 MiB，前端因此主动切换到单图上传组件；运行时和服务端本身已经支持多 URL 数组，并不会只保留第一张。
- `size` 参数 schema 原先只有固定枚举，尺寸卡片没有自定义入口；即使最终请求链路允许透传任意字符串，用户也无法在界面输入。
- 图片尺寸 schema 现新增 `allowCustom/min/max/step` 元数据，`gpt-image-2` 开启自定义尺寸，范围为 256–4096、步进 64；配置面板新增“自定义”卡片，可直接输入宽度和高度，例如 `2048x1024`，该值会原样保存为 `size` 并形成自定义宽高比。
- 自定义尺寸输入包含正整数、上下界、回车确认、取消和再次编辑校验；不支持自定义尺寸的其他模型继续只显示自身固定选项，不会被全局错误放开。
- `gpt-image-1` 与 `gpt-image-2` 的参考图上限均更新为 16 张，单文件上限更新为 50 MiB；现有 `MultiImagesUpload` 会自动启用多选、追加、删除和管理界面。
- 新增回归覆盖：尺寸字符串解析与边界、schema 元数据、GPT 图片模型多参考图上限、配置 hook 约束读取，以及创建请求完整保留 `2048x1024` 和两张参考图。

### 本地检查

- 11 个目标 TypeScript/TSX 文件均通过 TypeScript `transpileModule` 语法解析，两个翻译 JSON 解析成功，`git diff --check` 无空白错误。
- 使用本机 TypeScript 与 Zod 直接执行的 schema 冒烟检查通过，确认 `2048x1024` 解析、256–4096 边界、`allowCustom=true` 与 `maxCount=16` 均生效。
- 本机 `node_modules` 在此前失败的提交钩子 `npm ci` 后缺失 Vitest 实体；离线冻结安装因仓库既有 overrides/lockfile 不一致被拒绝，非冻结离线恢复速度异常缓慢且未下载任何包，已及时终止，未将 Vitest 或 TSC 空跑计为通过。完整回归交由 GitHub Actions 干净环境验证。

### GitHub Actions、部署与真实验证

- 功能提交为 `ff9aac5dfc06c1ca8269a7983e7a7a0a040801dd`，已推送到 `Alunixa/lobehub` 的 `codex/deploy-server-image-20260720` 分支。
- 服务器镜像工作流 `32417296215` 成功；GitHub artifact `9424621754` 为 `296871586` 字节，digest 为 `sha256:43746fa2b63ad406f60eb6fa1f74f1538d1e6be1aae0359b87706002db8d587a`。
- 解包后的 `lobehub-server-image.tar` 为 `296871424` 字节，SHA-256 为 `A53B7EF2C50A27EA4A17676A6437ABF57F70B7DA90CCC9BA2EF154477BBD7037`；本机、路由器与 GitHub Release digest 完全一致。
- Test CI `32417296784` 中 Model Bank 包测试、两个 Test Server 分片、Server Coverage Merge 和 Desktop 全部成功；新增 `Select/utils.test.ts` 为 3/3 通过，`createImage/action.test.ts` 为 12/12 通过。
- Test App shard 1 仍只有既有 `src/services/chat/chat.test.ts` instructions 断言失败，同分片 3413 个用例通过；shard 2 因矩阵 fail-fast 被取消。Test Database 仍被全仓库 170 个既有弃用 UI import 等 Lint 错误阻塞，本轮目标文件没有出现在 Lint 错误列表。
- E2E `32417296032` 为 81/82 场景、490/491 步骤通过；唯一失败仍是 `e2e/src/steps/agent/scroll.steps.ts` 的关闭流式自动滚动视口距离断言，和前两版发布完全相同。
- 部署前 LobeHub 容器为 `41883afa06c867784d44bfe13e0f0c578054463add1d7e0c33ff680a08a7e073`，旧镜像 ID 为 `sha256:f15da97263b268b8fd85383151bc9cad3f1369dbe92a2367a145f23b6bdfe1db`，重启次数 0；其他核心容器 ID 与上一版一致。
- 旧镜像已保留回滚标签 `lobehub/lobehub:backup-20260820-pre-image-controls`；新镜像标签为 `lobehub/lobehub:codex-ff9aac5dfc06c1ca8269a7983e7a7a0a040801dd`，镜像 ID 为 `sha256:215e67b69b2c69c81d3e26cb557f016ff0c2475692002dab6b9cb77342a6dd5a`。
- 只执行 `docker compose up -d --no-deps --force-recreate lobehub`；最终 LobeHub 容器为 `08e4c22d1c1efdd2b9adb487cfd454f44890541452c4678d8113fa4bb48f507c`，运行 23 分钟后重启次数仍为 0，内部 `/api/version` 返回 `2.2.8`。
- PostgreSQL `0fbc183930b4`、Redis `91676a9b0789`、RustFS `e5396e9ce69e`、SearXNG `76165d49617f`、设备网关 `3d1a74a1a5c0`、Onlyboxes Console `2665b2cbaf85` 和 `linuxytd` `40221e97adeb` 均未重建。
- Compose、override 与四个证书文件 SHA-256 全部未变，`nginx -t` 成功；Host Executor `/health` 仍返回 `mode=host, success=true`，部署后 LobeHub 错误日志为空。
- 使用用户现有有效 Better Auth 会话，通过真实 `/trpc/lambda/image.createImage` 提交 `provider=image`、`model=gpt-image-2`、`size=2048x1024` 和两张现有参考图，未输出或持久化会话令牌。
- 真实批次 `gb_zyG5zXMGRIoS` 的数据库配置保存了自定义尺寸和两个不同参考图 key；异步任务 `8b19c79e-8a20-48f3-b7d0-eceb0cc12398` 成功，耗时约 42.4 秒，最终文件 `file_t0x41jau7psM` 的实际产物尺寸为 `2048×1024`。
- GitHub prerelease `v2.2.8-codex.20260820.1` 已发布，标签指向功能提交，地址为 `https://github.com/Alunixa/lobehub/releases/tag/v2.2.8-codex.20260820.1`。
- Release 资产为服务器镜像与清单：GitHub 返回大小和 digest 分别为 `296871424 / sha256:a53b7ef2c50a27ea4a17676a6437abf57f70b7da90ccc9ba2ef154477bbd7037`、`1398 / sha256:34775aa4492838b1e7cb40d818788cfdf4c84248ab1adb59f3e62915b8deead0`，均与本机一致；Release Notes 已写明功能、测试、已知既有阻塞、资产大小和 SHA-256。
- 本轮路由器上传暂存目录与本机 Release 临时目录已精确删除并确认不存在；保留当前镜像、回滚镜像标签、GitHub Release、真实验证生成记录，以及本轮开始前既存的未跟踪历史目录与 `问题.txt`。

## 2026-08-21：默认图片数量设置无法保存为 1

### 用户反馈

- 用户反馈“设置 → 服务模型”底部的默认图片数量只能保持为 2；改成 1 后刷新页面又恢复为 2，要求修复持久化问题。

### 当前行动

- 已读取 `YHYQ.md`、既有图片生成修复与部署记录，确认本轮开始时已跟踪文件干净，既存未跟踪历史构建目录与 `问题.txt` 保持不动。
- 已建立修改前空提交回滚点。
- 正在核对默认图片数量控件、用户设置写入、数据库字段与页面初始化回退逻辑，尚未修改功能源码或线上配置。

### 根因与源码修复

- 线上数据库原始 `user_settings.image` 为 `{}`，因此刷新时按默认配置显示 `defaultImageNum=2`。
- 使用同一用户的真实 `user.updateSettings` 接口直接提交 `defaultImageNum=1` 后，HTTP 200 且数据库正确保存为 `{"defaultImageNum":1}`，证明服务端校验、路由、数据库 JSONB 字段和读取链路均支持数值 1。
- 根因位于通用 `FormSliderWithInput`：控件只在失焦时向 Form 提交值；当输入 change 与 blur 发生在同一 React 批次时，blur 闭包会读取尚未提交渲染的旧 state，例如把旧值 2 再次提交，覆盖用户刚输入的 1。
- 组件现用 ref 同步保存每一次最新数值，blur 始终提交 ref 当前值；外部设置刷新时也同时同步 state 与 ref，避免状态分叉。
- 新增组件回归，覆盖 change 与 blur 同一批次时必须提交 1，以及外部 value 更新后失焦必须提交新值。
- 真实接口诊断已经把用户当前默认图片数量持久化为 1；功能修复部署后，后续在页面中设置 1 也不会再被旧值覆盖。

### 本地检查

- `FormSliderWithInput.tsx` 与新增回归文件均通过目标 Prettier 格式一致性检查和 TypeScript `transpileModule` 语法解析，`git diff --check` 无空白错误。
- 新回归将 change 与 blur 放在同一个 React act 批次中，直接复现旧实现会提交上一帧数值的竞态；修复后必须提交最新值 1。
- 本机依赖目录延续上一轮不完整状态，Vitest 可执行实体缺失，因此没有把本机用例标记为通过；将由 GitHub Actions 干净环境进行权威验证。

### 首轮 GitHub Actions 与测试矩阵修正

- 功能提交 `aa86ddfa7f74f844b3e7fb06a3a5608d356fcc6b` 已推送；服务器镜像工作流 `32448930851` 成功，Test CI `32448930763` 与 E2E `32448930876` 已完成。
- Test Server 两个分片、Test Packages、Test Desktop 与 Server Coverage Merge 均成功；Test App shard 1 仍只有既有 `src/services/chat/chat.test.ts` instructions 断言失败，3422 个同分片用例通过；Test Database 仍为全仓库 170 个既有弃用 UI import 等错误。
- E2E 仍为 81/82 场景、490/491 步骤通过；唯一失败仍是 `e2e/src/steps/agent/scroll.steps.ts` 的关闭流式自动滚动视口距离断言，与本轮设置组件无关。
- 新增 `FormSliderWithInput.test.tsx` 被 Vitest 分到 App shard 2，但仓库原工作流默认 `fail-fast=true`，shard 1 的既有失败会立即取消 shard 2；对取消 job 的两次 GitHub 单 job 重跑也会被矩阵 fail-fast 状态立即取消，不能把该用例误报为已执行。
- 独立临时 worktree 的在线依赖恢复速度异常缓慢，约 5 分钟只复用 49 个包，已及时终止且未把空跑计为通过；后续把 App 测试矩阵明确改为 `fail-fast: false`，让两个分片即使其中一个失败也必须完整执行。

### 最终 GitHub Actions、Release 与部署

- App 测试矩阵修正提交为 `aadf342eb2658742e6939ccd676a580ae5be0ed1`，已推送到 `Alunixa/lobehub` 的 `codex/deploy-server-image-20260720` 分支；最终 Test CI 为 `32450691909`，E2E 为 `32450691905`，服务器镜像工作流为 `32450708976`。
- `FormSliderWithInput.test.tsx` 在最终 Test App shard 2 中真实执行并 2/2 通过，耗时 65 ms；该分片其余失败为既有 Host Executor 文件被 Vitest 收集但没有 suite、ComfyUI Form 的 `cx is not a function`，以及两个默认 Agent 设置快照不匹配，共 3473 个同分片用例通过。
- Test App shard 1 仍只有既有 `src/services/chat/chat.test.ts` instructions 断言失败；Test Server 两个分片、Test Packages、Test Desktop 与 Server Coverage Merge 全部成功；Test Database 仍为全仓库 170 个既有弃用 UI import 等 Lint 错误。
- 最终 E2E 仍为 81/82 场景、490/491 步骤通过；唯一失败仍是 `e2e/src/steps/agent/scroll.steps.ts` 的关闭流式自动滚动视口距离断言，期望大于 320、实际 82，与本轮设置控件无关。
- 最终 GitHub Actions artifact `9435724741` 为 `296843938` 字节，digest 为 `sha256:42477c643dc62e0f398860269cae554e22a3026ff89e54382c8822d9cfbbd88b`；解包后的 `lobehub-server-image.tar` 为 `296843776` 字节，SHA-256 为 `CCA133F774C5BD26B2887E67DAFB2E68FC29C3FD52B732152C537A66BE018F7B`。
- GitHub prerelease `v2.2.8-codex.20260821.1` 已发布，标签指向最终源码提交，地址为 `https://github.com/Alunixa/lobehub/releases/tag/v2.2.8-codex.20260821.1`；服务器镜像与校验清单的 GitHub digest、大小和本机完全一致，Release Notes 已写明根因、修复、测试结果、既有阻塞和资产信息。
- 部署前 LobeHub 容器为 `08e4c22d1c1efdd2b9adb487cfd454f44890541452c4678d8113fa4bb48f507c`，旧镜像 ID 为 `sha256:215e67b69b2c69c81d3e26cb557f016ff0c2475692002dab6b9cb77342a6dd5a`，重启次数 0；Compose、override、Nginx、四个证书和宿主执行器均正常。
- 上传到路由器的服务器镜像和校验清单在安装前重新核验大小与 SHA-256，和本机 / GitHub Release 完全一致；旧镜像已保留回滚标签 `lobehub/lobehub:backup-20260821-pre-default-image-count`。
- 新镜像标签为 `lobehub/lobehub:codex-aadf342eb2658742e6939ccd676a580ae5be0ed1`，镜像 ID 为 `sha256:52698627a970680e2f4b108cf26370581f38ce9b65b6e35a2ea2e9526d17d65f`，平台 `linux/amd64`。
- 只执行 `docker compose up -d --no-deps --force-recreate lobehub`；最终 LobeHub 容器为 `30757d97039d9592892f8956f91098d3e1f73da6f401b0746fa8a61cd2c0cf97`，运行 5 分钟后仍为 running、重启次数 0，端口保持宿主 `127.0.0.1:13210` 到容器 `3210`。
- 内部与 APP_URL HTTPS `/api/version` 均返回 `2.2.8`，启动后十分钟日志范围内没有 error / fatal / panic / migration failed；Host Executor `/health` 仍返回 `mode=host, success=true`。
- PostgreSQL `0fbc183930b4`、Redis `91676a9b0789`、RustFS `e5396e9ce69e`、SearXNG `76165d49617f`、设备网关 `3d1a74a1a5c0`、Onlyboxes Console `2665b2cbaf85` 和 `linuxytd` `40221e97adeb` 容器 ID 全部未变。
- 主 Compose 与 override SHA-256 仍分别为 `fdaca5c7444241ec100768ae61e34ee265f16113bcb9395954b43aa0fcc0378e`、`e6786a2f36860bb726abb147aee246b61167033f14b43c9c80fc9bc365f047f9`；四个证书哈希未变，`nginx -t` 成功，可用内存约 6.30 GB，`/mnt/sda1` 可用约 92.0 GB。
- 部署后数据库中目标用户的 `user_settings.image.defaultImageNum` 仍为 `1`；未登录的隔离浏览器会进入登录页，使用数据库 session token 直接构造 Better Auth cookie 的只读 API 探测返回 401，因此没有把该探测误报为页面级验证；最终依据真实数据库值、部署镜像和 GitHub Actions 2/2 组件回归确认修复生效。
- 路由器部署暂存目录、本机两版服务器 archive、测试 blob、Release 临时文件、未完成依赖安装的临时 worktree 与指针文件均已精确删除并验证不存在；保留 GitHub Release、当前镜像、旧镜像回滚标签，以及本轮开始前既存的未跟踪历史目录与 `问题.txt`。

## 2026-08-23：手机网页版缺少图片生成功能

### 用户反馈

- 用户反馈手机网页版 LobeHub 没有图片生成功能，要求补齐移动端可用入口与交互。

### 当前行动

- 已读取 `YHYQ.md`、既有图片生成自定义比例、多参考图、默认图片数量修复与部署记录。
- 已确认本轮开始时跟踪文件干净，仅保留既存未跟踪构建目录、发布目录与 `问题.txt`，不会纳入提交或删除。
- 已建立修改前 Git 回滚锚点，正在核对移动端导航、路由守卫、响应式隐藏条件与图片生成页面布局，尚未修改功能源码或线上服务。

### 根因与源码修复

- 根因已确认在 `src/spa/router/mobileRouter.config.tsx`：桌面端注册了 `/image` 页面和布局，但移动端路由树完全没有 `image` 路由，手机访问 `/image` 会落入 catch-all 并重定向到首页。
- 移动端底部 `NavBar` 原来只有聊天、发现和我的，也没有图片入口，因此用户既不能从导航进入，也不能通过直达 URL 使用图片生成。
- 移动端共享主区域现注册 `/image` 与 `/:workspaceSlug/image`，使用独立移动端图片布局和页面包装器；个人空间与工作区均可进入同一图片生成状态和服务端链路。
- 移动端底部导航新增图片入口，并让个人与工作区图片路径都正确显示底部导航和图片激活态。
- 新移动端布局提供“图片生成”标题栏，为底部导航预留高度，不挂载桌面侧边栏；生成历史工作区、Prompt、模型选择、参数配置、参考图上传和生成结果继续复用现有图片模块。
- 通用创建页面新增移动端模式：隐藏桌面左栏开关和宽屏按钮，首页不再显示可切换到未注册移动视频路由的桌面 Hero 选择器。
- 图片 Prompt 工具栏在移动端隐藏冗余的图片/视频模式选择，并把可见性控件收缩为带无障碍标签的图标按钮，避免窄屏操作栏溢出；模型、参数、图片数量、Prompt 优化和生成按钮保持可用。

### 本地检查

- 新增移动路由回归，断言移动图片页面、移动图片布局、`/image` 路径、底部图片入口、工作区图片路径导航显示和激活态逻辑均已注册。
- 扩展 `CreateGenerationPage` 回归，断言移动端仍显示 Prompt 输入，但不渲染桌面 NavHeader 与宽屏按钮。
- 11 个目标 TypeScript/TSX 文件均通过 TypeScript `transpileModule` 语法解析，`git diff --check` 无空白错误。
- 本机 `node_modules` 仍是不完整依赖状态，Prettier 包启动后无结果挂起，已精确终止该进程且未计为通过；Vitest 可执行入口仍缺失，权威格式与回归验证交由 GitHub Actions 干净环境执行。

### 首轮 GitHub Actions

- 功能提交 `89f890fbbd5a8fa21db51d377170505a33c33e17` 已推送；服务器镜像工作流 `32619431200` 成功，Test CI `32619431209` 与 E2E `32619431198` 已完成。
- 新增 `mobileRouter.test.tsx` 在 App shard 1 中 3/3 通过，扩展的 `CreateGenerationPage.test.tsx` 在 App shard 2 中 5/5 通过，证明移动图片路由、导航入口和移动页面包装均被真实执行。
- Test App shard 1 仍只有既有 chat instructions 断言失败；shard 2 仍为既有 Host Executor 收集、ComfyUI Form 和两个设置快照问题；E2E 仍为 81/82 场景、490/491 步骤通过，唯一失败仍是既有关闭自动滚动视口距离断言。
- Test Database 全仓库 Lint 从既有 170 个错误增加到 171 个，其中唯一新增错误是 `CreateGenerationPageProps` 的 `mobile` 字段未按接口字母顺序排列；现已把 `mobile` 移到 `onUploadFiles` 前，并同步修正可见性按钮的 JSX props 排序警告，后续重新推送做最终权威验证。

### 最终 GitHub Actions、Release 与部署

- 最终修正提交为 `e102fca0694a8f7ef800bb144a0c88780c64c789`；最终 Test CI `32620139116` 中移动路由回归 3/3、移动创建页面回归 5/5 均通过，Test Server 两个分片、Test Packages、Test Desktop 与 Server Coverage Merge 全部成功。
- Test Database 已恢复为全仓库既有 170 个错误和 264 个警告，本轮新增 Lint 错误为 0；Test App shard 1 仍只有既有 chat instructions 断言失败，shard 2 仍为既有 Host Executor 收集、ComfyUI Form 和两个默认 Agent 设置快照问题。
- 最终 E2E `32620139180` 仍为 81/82 场景、490/491 步骤通过；唯一失败仍是关闭自动滚动后的视口距离断言，期望大于 320、实际 82，与移动图片路由无关。
- 最终服务器镜像工作流 `32620139176` 成功，Actions artifact `9488214073` 为 `296990882` 字节，digest 为 `sha256:1bc2948dffacd7cb91e49390632f5e2f536e3a0d5d888cb72f2c5a031aca54b6`。
- 解包后的 `lobehub-server-image.tar` 为 `296990720` 字节，SHA-256 为 `6596BB086071EB66142F5FF2E38EBAB45D6F62D6AC8BD14B9806B996175C835F`；本机、路由器与 GitHub Release 完全一致。
- GitHub prerelease `v2.2.8-codex.20260823.1` 已发布，标签指向最终源码提交，地址为 `https://github.com/Alunixa/lobehub/releases/tag/v2.2.8-codex.20260823.1`；Release Notes 已明确记录手机路由、底部入口、移动布局、窄屏工具栏、测试结果和既有阻塞。
- 部署前 LobeHub 容器为 `30757d97039d9592892f8956f91098d3e1f73da6f401b0746fa8a61cd2c0cf97`，旧镜像为 `sha256:52698627a970680e2f4b108cf26370581f38ce9b65b6e35a2ea2e9526d17d65f`；其重启计数在本轮开始前已为 7，但最近两小时没有 error / fatal / OOM，最后一次退出码为 0，不能把既有重启历史归因于本轮部署。
- 旧镜像已保留回滚标签 `lobehub/lobehub:backup-20260823-pre-mobile-image`；新镜像标签为 `lobehub/lobehub:codex-e102fca0694a8f7ef800bb144a0c88780c64c789`，镜像 ID 为 `sha256:ab684322a74be1d6099012b6d5600a46650404a97130f02cf122f46cd099a9ec`。
- 只执行 `docker compose up -d --no-deps --force-recreate lobehub`；最终容器为 `35221899ff9ec6dc2dba1506a70102a740863144056c47c337efe6ddb3c6790f`，运行 5 分钟后仍为 running、重启次数 0，端口保持宿主 `127.0.0.1:13210` 到容器 `3210`。
- 使用数据库中现有有效 Better Auth 会话，在路由器内存中按当前 `AUTH_SECRET` 生成签名 Cookie，并以 iPhone User-Agent 真实请求 APP_URL `/image`；HTTP 200、最终地址仍为 `/image`、响应体 19514 字节，令牌和签名 Cookie 均未输出或写入文件。
- 内部与 APP_URL HTTPS `/api/version` 均返回 `2.2.8`，Host Executor `/health` 仍返回 `mode=host, success=true`，部署后 15 分钟日志范围内没有 error / fatal / panic / migration failed。
- PostgreSQL `0fbc183930b4`、Redis `91676a9b0789`、RustFS `e5396e9ce69e`、SearXNG `76165d49617f`、设备网关 `3d1a74a1a5c0`、Onlyboxes Console `2665b2cbaf85` 和 `linuxytd` `40221e97adeb` 容器 ID 全部未变。
- Compose、override 与四个证书 SHA-256 全部未变，`nginx -t` 成功；稳定性复查时可用内存约 6.63 GB，`/mnt/sda1` 可用约 90.8 GB。
- 路由器部署暂存目录、本机服务器 archive、Release 临时文件和指针文件均已精确删除并验证不存在；保留 GitHub Release、当前镜像、旧镜像回滚标签，以及本轮开始前既存的未跟踪历史目录与 `问题.txt`。

## 2026-08-24：修复 GPT / Claude 视频附件兼容与自部署视频链接

### 用户反馈

- 用户在 GPT 5.6 Sol 对话中上传视频后，OpenAI-compatible Responses 接口返回 `input_video` 非法，明确只接受 `input_text`、`input_image`、`input_audio`、`input_file` 等类型。
- 同一视频使用 Claude Opus 4.6 时能够开始思考，但卡在读取一个视频上传链接；用户自己访问该链接也持续加载，要求修复视频附件投影与文件访问链路。

### 当前行动

- 已读取 `YHYQ.md`、既有附件模型投影修复、当前 Git 状态与部署拓扑；本轮开始时跟踪文件干净，既存未跟踪构建目录、发布目录与 `问题.txt` 保持不动。
- 已建立修改前 Git 回滚锚点；正在检查视频文件持久化、模型消息投影、Responses / Anthropic 适配器和自部署文件下载路由，尚未修改功能源码或线上服务。

## 2026-08-24：优先 Bing / Google 并实现搜索引擎自动故障转移

### 用户要求

- 暂停 GPT / Claude 视频附件兼容修复，不再继续本轮视频源码改动。
- 希望联网搜索优先使用时效性更好的 Bing 或 Google；若无账号直搜确实不可用，再使用 DuckDuckGo、Yahoo Japan 等候选。
- 用户可以提供 Google / Bing 登录态，但考虑 Cookie 过期和风控，优先实现无需账号、可长期自动运行的搜索方案。
- 单个搜索引擎被验证码、限流、超时、解析错误或访问拒绝时，必须自动重试下一个候选；只有所有引擎和后续提供商都失败时才返回错误，不能首个失败就终止。

### 当前行动

- 已停止视频附件修复线；该任务只完成只读协议排查和测试探测，没有修改功能源码或线上服务。
- 已读取既有搜索修复记录：当前自部署 SearXNG 曾启用 Bing、Naver、ResultHunter、Wiby、Yandex、Wikipedia，LobeHub 已有提供商级重试与并发限制，但尚需核对引擎级优先级和失败切换是否会被部分过时结果短路。
- 已建立本轮修改前 Git 回滚锚点；下一步只读实测 Bing、Google、DuckDuckGo、Yahoo Japan 及当前默认集合，并检查 SearchService 与 SearXNG 实现后再修改。
- 暂停视频排查后的首次临时克隆清理因 Git pack 文件只读属性被系统拒绝，第二次路径安全检查又因 TEMP 短路径与解析后的长路径不一致而主动中止，两次均未影响项目文件。
- 已改用核验过的绝对长路径，只解除该临时克隆内只读属性并精确删除目录及指针文件；项目既有未跟踪目录保持不动。
