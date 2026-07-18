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
