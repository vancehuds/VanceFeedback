# VanceFeedback 前端 Vercel 部署教程

本教程将指导您如何将 VanceFeedback 的前端部署到 Vercel，后端独立部署到其他服务器（VPS、Docker 等）。

## 📋 目录

- [部署架构](#部署架构)
- [前置准备](#前置准备)
- [后端部署](#后端部署)
- [Vercel 前端部署](#vercel-前端部署)
- [环境变量配置](#环境变量配置)
- [域名和 HTTPS](#域名和-https)
- [常见问题](#常见问题)
- [与 Docker 部署的兼容性](#与-docker-部署的兼容性)

---

## 🏗️ 部署架构

```
┌─────────────────────┐         ┌──────────────────────┐
│   Vercel (前端)      │         │   VPS/Docker (后端)   │
│   React SPA         │────────▶│   Node.js + Express  │
│   全球 CDN 加速      │  API请求 │   端口: 3030         │
└─────────────────────┘         └──────────────────────┘
         │                               │
         │                               │
         ▼                               ▼
    用户浏览器                       数据库存储
```

**优势：**
- ✅ 前端享受 Vercel 全球 CDN 加速
- ✅ 自动 HTTPS 和免费 SSL 证书
- ✅ 一键部署，Git 推送自动部署
- ✅ 零配置，无需管理服务器
- ✅ 后端独立部署，完全掌控

---

## 💻 前置准备

### 必需条件

1. **GitHub/GitLab/Bitbucket 账号**
   - 用于托管代码仓库

2. **Vercel 账号**（免费）
   - 访问 [vercel.com](https://vercel.com) 注册
   - 建议使用 GitHub 账号登录

3. **可访问的后端服务**
   - 一台 VPS 服务器或云服务器
   - 或使用 Docker 部署后端
   - 必须有公网 IP 或域名
   - 建议配置 HTTPS（使用 Let's Encrypt）

### 环境检查

```bash
# 确保已安装 Node.js 和 npm
node --version  # 应为 v16 或更高
npm --version   # 应为 v7 或更高

# 确保已安装 Git
git --version
```

---

## 🖥️ 后端部署

在部署前端到 Vercel 之前，必须先部署后端服务。

### 方式一：使用 Docker 部署后端（推荐）

#### 1. 在服务器上安装 Docker

```bash
# 安装 Docker（以 Ubuntu 为例）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

#### 2. 克隆项目到服务器

```bash
cd /opt
git clone https://github.com/your-username/VanceFeedback.git
cd VanceFeedback
```

#### 3. 构建并运行后端容器

```bash
# 构建后端镜像
docker build -f Dockerfile.backend -t vancefeedback-backend:latest .

# 运行后端容器
docker run -d \
  --name vancefeedback-backend \
  -p 3030:3030 \
  -e PORT=3030 \
  -e DB_TYPE=sqlite \
  -v $(pwd)/server/data:/app/server/data \
  -v $(pwd)/server/config:/app/server/config \
  --restart unless-stopped \
  vancefeedback-backend:latest
```

#### 4. 验证后端运行

```bash
# 检查容器状态
docker ps

# 测试 API
curl http://localhost:3030/api/status
# 应返回：{"status":"ok"}
```

#### 5. 配置反向代理（重要）

为了让前端能访问后端，需要配置 Nginx 反向代理并启用 HTTPS。

**安装 Nginx：**
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

**创建 Nginx 配置：**
```bash
sudo nano /etc/nginx/sites-available/vancefeedback-api
```

**配置内容：**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # 替换为你的后端域名

    location / {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**启用配置：**
```bash
sudo ln -s /etc/nginx/sites-available/vancefeedback-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**配置 SSL（使用 Let's Encrypt）：**
```bash
sudo certbot --nginx -d api.yourdomain.com
```

**验证 HTTPS：**
```bash
curl https://api.yourdomain.com/api/status
```

### 方式二：直接运行 Node.js（不推荐）

如果不使用 Docker，可以直接运行 Node.js：

```bash
cd VanceFeedback
npm install
export PORT=3030
export DB_TYPE=sqlite
npm run server
```

> **注意**：生产环境建议使用 PM2 管理进程：
> ```bash
> npm install -g pm2
> pm2 start server/index.js --name vancefeedback-backend
> pm2 save
> pm2 startup
> ```

---

## 🚀 Vercel 前端部署

### 步骤 1：准备代码仓库

#### 1.1 推送代码到 GitHub

如果尚未推送到 GitHub：

```bash
# 在本地项目目录
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/VanceFeedback.git
git push -u origin main
```

### 步骤 2：在 Vercel 创建项目

#### 2.1 登录 Vercel

访问 [vercel.com](https://vercel.com) 并登录（使用 GitHub 账号）。

#### 2.2 导入 Git 仓库

1. 点击 **"Add New..."** → **"Project"**
2. 选择你的 GitHub 仓库（`VanceFeedback`）
3. 点击 **"Import"**

#### 2.3 配置项目

Vercel 会自动检测到这是一个 Vite 项目，但需要确认以下配置：

- **Framework Preset**: Vite
- **Root Directory**: `./`（保持默认）
- **Build Command**: `npm run build`（保持默认）
- **Output Directory**: `dist`（保持默认）

### 步骤 3：配置环境变量

这是**最关键**的步骤！

#### 3.1 在 Vercel 项目设置中添加环境变量

1. 在项目页面，点击 **"Settings"** 标签
2. 左侧菜单选择 **"Environment Variables"**
3. 添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_API_BASE_URL` | `https://api.yourdomain.com/api` | 你的后端 API 地址（必须是完整的 HTTPS URL） |

**重要提示：**
- ✅ 必须使用 HTTPS（`https://`），不要使用 HTTP
- ✅ 路径必须以 `/api` 结尾
- ✅ 不要在末尾加斜杠 `/`
- ❌ 错误示例：`http://api.yourdomain.com/api/`
- ✅ 正确示例：`https://api.yourdomain.com/api`

#### 3.2 应用到所有环境

确保环境变量应用到：
- ☑️ Production
- ☑️ Preview
- ☑️ Development

### 步骤 4：部署

#### 4.1 触发部署

点击 **"Deploy"** 按钮，Vercel 会自动：
1. 从 GitHub 拉取代码
2. 安装依赖（`npm install`）
3. 构建项目（`npm run build`）
4. 部署到全球 CDN

部署通常需要 1-3 分钟。

#### 4.2 查看部署状态

在 **"Deployments"** 标签可以查看部署进度和日志。

### 步骤 5：访问应用

部署成功后，Vercel 会分配一个临时域名，例如：
```
https://vance-feedback-abc123.vercel.app
```

点击链接即可访问你的应用！

---

## 🌐 域名和 HTTPS

### 绑定自定义域名

#### 1. 在 Vercel 添加域名

1. 进入项目设置 → **"Domains"**
2. 输入你的域名（例如 `feedback.yourdomain.com`）
3. 点击 **"Add"**

#### 2. 配置 DNS

Vercel 会提示你添加 DNS 记录。根据提示，在你的域名管理后台添加：

**方式 A：使用 A 记录**
```
Type: A
Name: feedback
Value: 76.76.21.21
```

**方式 B：使用 CNAME 记录（推荐）**
```
Type: CNAME
Name: feedback
Value: cname.vercel-dns.com
```

#### 3. 等待 DNS 生效

通常需要 5-60 分钟，Vercel 会自动配置 SSL 证书。

#### 4. 验证

访问你的自定义域名（例如 `https://feedback.yourdomain.com`），应该可以正常访问。

---

## 🔄 自动部署

### Git 自动部署

配置完成后，每次推送代码都会自动触发部署：

```bash
# 修改代码后
git add .
git commit -m "Update features"
git push

# Vercel 会自动检测并重新部署
```

### 部署预览

- **Production**：推送到 `main` 分支会部署到生产环境
- **Preview**：推送到其他分支或 Pull Request 会创建预览部署

---

## 🔍 环境变量配置

### 前端环境变量（Vercel）

在 Vercel 项目设置的 **Environment Variables** 中配置：

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `VITE_API_BASE_URL` | ✅ 是 | 后端 API 完整地址 | `https://api.yourdomain.com/api` |

### 后端环境变量（Docker/VPS）

在运行后端容器或 Node.js 时配置：

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | 否 | 3030 | 后端服务端口 |
| `DB_TYPE` | 否 | sqlite | 数据库类型（sqlite/mysql） |
| `DB_HOST` | 条件 | - | MySQL 主机（使用 MySQL 时） |
| `DB_PORT` | 否 | 3306 | MySQL 端口 |
| `DB_USER` | 条件 | - | MySQL 用户名（使用 MySQL 时） |
| `DB_PASS` | 条件 | - | MySQL 密码（使用 MySQL 时） |
| `DB_NAME` | 否 | vancefeedback | MySQL 数据库名 |

---

## 🐛 常见问题

### 1. 前端无法连接后端 API

**症状**：页面加载正常，但显示"网络错误"或控制台显示 CORS 错误。

**解决方案：**

1. **检查 `VITE_API_BASE_URL` 是否正确**
   - 必须是完整的 HTTPS URL
   - 路径以 `/api` 结尾
   - 在 Vercel 设置中检查环境变量

2. **确认后端可访问**
   ```bash
   curl https://api.yourdomain.com/api/status
   ```

3. **检查后端 CORS 配置**
   - 后端应允许来自 Vercel 域名的请求
   - 检查 `server/index.js` 中的 CORS 设置

4. **查看浏览器控制台**
   - 按 F12 打开开发者工具
   - 查看 Network 标签，检查请求的完整 URL

### 2. 环境变量未生效

**症状**：前端仍然请求 `/api` 而不是后端地址。

**解决方案：**

1. **重新部署**
   - 修改环境变量后，必须触发重新部署
   - 在 Vercel → Deployments → 点击 "Redeploy"

2. **检查变量名**
   - 必须是 `VITE_API_BASE_URL`（全大写）
   - Vite 环境变量必须以 `VITE_` 开头

3. **清除浏览器缓存**
   ```
   Ctrl + Shift + R（Windows/Linux）
   Cmd + Shift + R（Mac）
   ```

### 3. 404 错误（刷新页面时）

**症状**：直接访问 `/login` 或 `/dashboard` 时显示 404。

**解决方案：**

检查 `vercel.json` 文件是否包含以下配置：
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

如果已配置但仍有问题，触发重新部署。

### 4. 后端 CORS 错误

**症状**：浏览器控制台显示 "Access to XMLHttpRequest has been blocked by CORS policy"

**解决方案：**

确保后端的 CORS 配置允许来自 Vercel 的请求。修改 `server/index.js`：

```javascript
const cors = require('cors');

// 允许所有来源（开发环境）
app.use(cors());

// 或只允许特定域名（生产环境推荐）
app.use(cors({
  origin: [
    'https://your-app.vercel.app',
    'https://feedback.yourdomain.com'
  ],
  credentials: true
}));
```

### 5. 构建失败

**症状**：Vercel 部署时显示 "Build failed"

**解决方案：**

1. **查看构建日志**
   - 在 Deployments → 点击失败的部署 → 查看日志

2. **常见原因：**
   - npm 依赖安装失败：检查 `package.json`
   - 构建命令错误：确认 Build Command 为 `npm run build`
   - 内存不足：Vercel 免费版有限制，考虑优化代码

3. **本地测试构建**
   ```bash
   npm install
   npm run build
   ```
   如果本地构建失败，先解决本地问题。

### 6. 后端无法访问数据库

**症状**：后端日志显示 "Failed to initialize DB"

**解决方案：**

1. **使用 SQLite（推荐方式）**
   ```bash
   docker run -d \
     --name vancefeedback-backend \
     -p 3030:3030 \
     -e DB_TYPE=sqlite \
     -v $(pwd)/server/data:/app/server/data \
     vancefeedback-backend:latest
   ```

2. **使用 MySQL**
   - 确保 MySQL 服务运行
   - 检查连接信息（HOST、PORT、USER、PASS）
   - 确保数据库已创建或用户有创建权限

### 7. SSL/HTTPS 问题

**症状**：浏览器显示"不安全"或证书错误

**解决方案：**

1. **后端 SSL 配置**
   - 使用 Certbot 重新申请证书
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```

2. **检查证书有效期**
   ```bash
   sudo certbot certificates
   ```

3. **自动续期**
   Certbot 通常会自动续期，也可以手动测试：
   ```bash
   sudo certbot renew --dry-run
   ```

---

## 🔧 与 Docker 部署的兼容性

本项目的代码修改**完全兼容**原有的 Docker 部署方案。

### Docker 部署如何工作？

在 Docker 部署中（无论是合并部署还是分离部署）：

1. **前端不设置 `VITE_API_BASE_URL` 环境变量**
2. **`api.js` 自动回退到 `/api`**
   ```javascript
   baseURL: import.meta.env.VITE_API_BASE_URL || '/api'
   //       如果未设置 ↑                    ↑ 使用默认值
   ```
3. **Nginx 配置代理 `/api` 到后端**（在 `nginx.conf` 中）

### 验证兼容性

#### 测试 Docker 分离部署

```bash
# 1. 构建并启动
docker-compose -f docker-compose.separated.yml up -d --build

# 2. 访问前端
# 浏览器打开 http://localhost:3020

# 3. 检查 API 请求
# 打开浏览器 F12 → Network，应该看到请求发送到 /api/*

# 4. 清理
docker-compose -f docker-compose.separated.yml down
```

#### 测试 Docker 合并部署

```bash
# 1. 构建并启动
docker-compose up -d --build

# 2. 访问应用
# 浏览器打开 http://localhost:3000

# 3. 检查功能正常
# 测试登录、提交反馈等功能

# 4. 清理
docker-compose down
```

### 代码变更说明

本次为支持 Vercel 部署，只做了以下**最小化**修改：

| 文件 | 变更 | 影响 |
|------|------|------|
| `src/api.js` | 支持环境变量 `VITE_API_BASE_URL` | ✅ 向后兼容，不影响 Docker 部署 |
| `.env.example` | 添加前端环境变量说明 | ✅ 仅文档更新，不影响运行 |
| `vercel.json` | 新增 Vercel 配置文件 | ✅ 仅 Vercel 使用，不影响 Docker |

**没有修改**任何 Docker 相关文件（`Dockerfile.*`、`docker-compose.yml`、`nginx.conf`）。

---

## 📊 部署方式对比

| 特性 | Vercel 前端 + VPS 后端 | Docker 分离部署 | Docker 合并部署 |
|------|------------------------|-----------------|-----------------|
| **前端托管** | Vercel（全球 CDN） | 自建服务器/容器 | 自建服务器/容器 |
| **后端托管** | 自建 VPS/Docker | 自建服务器/容器 | 自建服务器/容器 |
| **前端性能** | ⭐⭐⭐⭐⭐ 全球加速 | ⭐⭐⭐ 取决于服务器 | ⭐⭐⭐ 取决于服务器 |
| **部署难度** | ⭐⭐⭐ 中等 | ⭐⭐⭐ 中等 | ⭐⭐ 简单 |
| **成本** | 前端免费，后端需 VPS | 需要服务器 | 需要服务器 |
| **HTTPS** | ⭐⭐⭐⭐⭐ 自动配置 | ⭐⭐⭐ 需手动配置 | ⭐⭐⭐ 需手动配置 |
| **CI/CD** | ⭐⭐⭐⭐⭐ Git 自动部署 | ⭐⭐⭐ 需自行配置 | ⭐⭐⭐ 需自行配置 |
| **适用场景** | 追求性能和便利 | 完全自主控制 | 快速部署测试 |

### 什么时候使用 Vercel 部署？

✅ **推荐使用 Vercel 部署：**
- 想要前端全球 CDN 加速
- 不想管理前端服务器
- 需要自动化 CI/CD
- 追求简单快速的 HTTPS 配置
- 已有后端服务器或 VPS

✅ **推荐使用 Docker 部署：**
- 完全内网部署（不需要公网访问）
- 需要完全自主控制所有组件
- 已有完善的 Docker 基础设施
- 不希望依赖第三方平台

---

## 📚 相关资源

### 相关部署文档

- [Docker 分离部署教程](./DEPLOY_SEPARATED.md) - 前后端分别在 Docker 容器中部署
- [Docker 合并部署教程](./DOCKER_DEPLOY.md) - 前后端在同一 Docker 容器中部署

### 技术栈

- **前端框架**: React 19 + React Router 7
- **构建工具**: Vite 7
- **后端框架**: Express 5 + Node.js
- **托管平台**: Vercel（前端）+ 自建（后端）

### Vercel 相关文档

- [Vercel 官方文档](https://vercel.com/docs)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html#vercel)
- [环境变量配置](https://vercel.com/docs/concepts/projects/environment-variables)

### 获取帮助

如有问题，请：

1. 查看本文档的 [常见问题](#常见问题) 章节
2. 检查 Vercel 部署日志
3. 查看后端服务器日志：`docker logs vancefeedback-backend`
4. 查看浏览器控制台（F12）的错误信息
5. 提交 Issue 到项目仓库

---

**祝您部署顺利！** 🎉

如果本教程对您有帮助，请给项目点个 Star ⭐
