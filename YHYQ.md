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

### 待执行方案

- 备份服务器上的 LobeHub `.env`、Docker Compose 和 Nginx 配置。
- 在现有 HTTPS `3210` 站点下增加同源 `/lobe` 文件路径代理，保留原始 Host 与端口以兼容 S3 预签名。
- 将 LobeHub S3 地址改为现有公网 HTTPS `3210` 地址。
- 为 RustFS 的 `lobe` 存储桶配置精确的上传 CORS。
- 仅平滑重新加载 Nginx并重建 LobeHub 容器。
- 验证预签名上传、文件读取、LobeHub 登录/聊天接口和其他容器状态。
