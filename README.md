# VanceFeedback

[![GitHub](https://img.shields.io/badge/GitHub-vancehuds%2FVanceFeedback-blue?logo=github)](https://github.com/vancehuds/VanceFeedback)
[![Docker](https://img.shields.io/badge/Docker-vancehud%2Fvancefeedback-blue?logo=docker&logoColor=white)](https://hub.docker.com/r/vancehud/vancefeedback)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

VanceFeedback 是一个现代化的智能反馈和工单管理系统。它采用客户端-服务器架构，前端基于 React，后端基于 Express，集成了 **Google Gemini AI** 或**ZhiPu BigModel** 驱动的自动化功能，旨在提升用户反馈收集、跟踪和管理的效率。

> [English Documentation](README_EN.md)

## 主要功能

- **🤖 AI 智能助手**：
  - 自动生成工单摘要，通过 AI 快速了解问题核心。
  - 智能回复建议。
- **📱 移动端优化**：
  - 专为移动设备设计的管理后台，支持手势操作和响应式布局。
  - 随时随地管理工单、查看用户和处理反馈。
- **🛡️ 增强安全性**：
  - **多重人机验证**：支持 **Cloudflare Turnstile** 和 **Altcha** (包括基于 Pow 的验证)，灵活应对不同安全需求。
  - **API 速率限制**：基于角色的速率限制策略，有效防御滥用和 DDoS 攻击。
  - **安全认证**：邮箱验证、JWT 身份认证和密码加密存储。
- **👥 角色访问控制 (RBAC)**：
  - **普通用户**：提交反馈，实时追踪工单进度。
  - **管理员**：全功能工单管理，支持 AI 辅助处理。
  - **超级管理员**：系统级配置，用户管理，审计日志查看。
- **📈 数据可视化**：
  - 管理员仪表盘提供基于时间的趋势分析、工单统计和满意度分布。
- **📤 灵活部署**：
  - 支持 Docker 容器化部署（前后端分离或合并）。
  - 支持 Serverless 环境（如 Vercel）部署。

## 技术栈

### 前端
- **框架**: React 18 (Vite)
- **样式**: Tailwind CSS, PostCSS
- **图标**: Lucide React
- **图表**: Recharts
- **路由**: React Router DOM v6
- **HTTP 客户端**: Axios

### 后端
- **运行时**: Node.js
- **框架**: Express
- **AI 引擎**: Google Generative AI (Gemini)
- **数据库**: SQLite (开发/测试) / MySQL (生产环境推荐)
- **安全**: Node-RSA, Helmet, Express Rate Limit
- **验证码**: Altcha Lib, Cloudflare Turnstile

## 快速开始

### 前提条件
- Node.js (v18+)
- npm 或 yarn
- Google Gemini API Key (用于 AI 功能)
- ZhiPu BigModel API Key (用于 AI 功能)

### 安装步骤

1.  **克隆仓库**
    ```bash
    git clone https://github.com/vancehuds/VanceFeedback.git
    cd VanceFeedback
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **配置环境**
    复制示例配置文件：
    ```bash
    cp .env.example .env
    ```
    编辑 `.env` 文件，配置以下关键项：
    - 数据库连接
    - JWT 密钥
    - 邮件服务 (SMTP)
    - **GEMINI_API_KEY** (AI 功能必需)
    - 验证码服务密钥 (Turnstile/Altcha)

4.  **运行应用**
    启动开发服务器（前后端连调）：
    ```bash
    npm run dev
    ```
    - 前端: http://localhost:5173
    - 后端: http://localhost:3000

## 部署

VanceFeedback 提供了灵活的部署方案，适配多种生产环境。

### 1. Docker 部署（推荐）
你可以直接使用 Docker Hub 上的官方镜像：
```bash
docker run -d -p 3000:3000 --name vancefeedback vancehud/vancefeedback:latest
```

或者使用源码编译启动完整环境：
```bash
docker-compose -f docker-compose.separated.yml up -d --build
```
更多详情请参考 [DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md)。

### 2. Vercel 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvancehuds%2FVanceFeedback&env=JWT_SECRET,DB_TYPE,DB_HOST,DB_PORT,DB_USER,DB_NAME,DB_PASSWORD&project-name=VanceFeedback)

支持前后端分离部署到 Vercel Serverless 环境：
- 前端可直接导入 Vercel 部署。
- 后端作为 Serverless Functions 运行。  
详细指南请参考[DEPLOY_VERCEL_FULLSTACK.md](docs/DEPLOY_VERCEL_FULLSTACK.md)。
### 3. 前后端分离部署
适用于传统服务器环境，请参考 [DEPLOY_SEPARATED.md](docs/DEPLOY_SEPARATED.md)。

## 项目结构

- **`src/`**: 前端核心代码
  - `pages/`: 页面组件 (含 `MobileAdmin*` 移动端页面)
  - `components/`: 可复用组件
- **`server/`**: 后端服务代码
  - `routes/`: API 路由 (含 `aiRoutes.js`)
  - `services/`: 业务逻辑封装
  - `middleware/`: 中间件 (RateLimiter, Auth)

## 许可证

[MIT License](LICENSE)

## Star 历史

[![Stargazers over time](https://starchart.cc/vancehuds/VanceFeedback.svg?variant=adaptive)](https://starchart.cc/vancehuds/VanceFeedback)
