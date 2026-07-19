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
- 在高级设置页新增“记忆嵌入模型”分组，开启后显示 `BaseURL`、`Key`、嵌入模型名称和保存按钮。
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
