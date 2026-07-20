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
