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
