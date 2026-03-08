# VanceFeedback

[![GitHub](https://img.shields.io/badge/GitHub-vancehuds%2FVanceFeedback-blue?logo=github)](https://github.com/vancehuds/VanceFeedback)
[![Docker](https://img.shields.io/badge/Docker-vancehud%2Fvancefeedback-blue?logo=docker&logoColor=white)](https://hub.docker.com/r/vancehud/vancefeedback)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

VanceFeedback 是一个现代化的智能反馈和工单管理系统。它采用客户端-服务器架构，前端基于 React，后端基于 Express，集成了 **Google Gemini AI** 和 **ZhiPu BigModel (智谱)** 双 AI 引擎驱动的自动化功能，旨在提升用户反馈收集、跟踪和管理的效率。

> [English Documentation](README_EN.md)

## ✨ 主要功能

- **🤖 AI 智能助手**：
  - 支持 **Google Gemini** 和 **ZhiPu BigModel** 双 AI 引擎，自动切换。
  - 自动生成工单摘要，通过 AI 快速了解问题核心。
  - 智能回复建议，提高客服效率。
  - **AI 知识问答**：基于知识库内容的智能问答系统。
- **📚 知识库管理**：
  - 创建和管理知识库文章（支持分类）。
  - 前台知识库搜索和浏览。
  - AI 驱动的知识库问答。
- **📱 移动端优化**：
  - 专为移动设备设计的管理后台，支持手势操作和响应式布局。
  - 完整的移动端管理功能：工单、用户、数据分析、知识库、公告、设置等。
  - 随时随地管理工单、查看用户和处理反馈。
- **🛡️ 增强安全性**：
  - **多重人机验证**：支持 **Cloudflare Turnstile** 和 **Altcha** (包括基于 PoW 的验证)，灵活应对不同安全需求。
  - **API 速率限制**：基于角色的速率限制策略，有效防御滥用和 DDoS 攻击。
  - **安全认证**：邮箱验证、JWT 身份认证、RSA 加密传输和密码加密存储。
- **👥 角色访问控制 (RBAC)**：
  - **普通用户**：提交反馈，实时追踪工单进度，评价满意度。
  - **管理员**：全功能工单管理，支持 AI 辅助处理。
  - **超级管理员**：系统级配置，用户管理，审计日志查看。
- **📢 公告系统**：
  - 管理员发布公告，用户端展示。
- **📊 数据可视化**：
  - 管理员仪表盘提供基于时间的趋势分析、工单统计和满意度分布。
- **⚙️ 丰富的系统管理**：
  - **安装向导**：首次部署引导式配置，零门槛启动。
  - **自定义问题类型**：灵活定义工单分类。
  - **邮件模板管理**：自定义通知邮件内容。
  - **管理员通知**：工单变更实时通知。
  - **钉钉通知**：支持钉钉 Webhook 推送新工单通知。
  - **审计日志**：完整记录系统操作。
- **📤 灵活部署**：
  - 支持 Docker 容器化部署（前后端合并或分离）。
  - 支持 Serverless 环境（如 Vercel）部署。
  - 支持 PWA (Progressive Web App)。

## 🛠️ 技术栈

### 前端
- **框架**: React 19 (Vite 7)
- **样式**: Tailwind CSS 4, PostCSS
- **图标**: Lucide React
- **图表**: Recharts 3
- **路由**: React Router DOM v7
- **HTTP 客户端**: Axios
- **PWA**: vite-plugin-pwa
- **分析**: Vercel Analytics & Speed Insights

### 后端
- **运行时**: Node.js
- **框架**: Express 5
- **AI 引擎**: Google Generative AI (Gemini) / ZhiPu BigModel（双引擎，自动切换）
- **数据库**: SQLite (开发/轻量部署) / MySQL (生产环境推荐)
- **安全**: Node-RSA, bcryptjs, Helmet, Express Rate Limit
- **验证码**: Altcha Lib, Cloudflare Turnstile
- **邮件**: Nodemailer
- **通知**: 钉钉 Webhook

## 🚀 快速开始

### 前提条件
- Node.js (v18+)
- npm 或 yarn
- Google Gemini API Key 和/或 ZhiPu BigModel API Key (用于 AI 功能，可选)

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
    - 数据库连接 (`DB_TYPE`, `DB_HOST` 等)
    - JWT 密钥 (`JWT_SECRET`)
    - 邮件服务 SMTP
    - `GEMINI_API_KEY` 和/或 `BIGMODEL_API_KEY` (AI 功能)
    - 验证码服务密钥 (Turnstile / Altcha)

    > 💡 如果不配置环境变量，首次启动时将进入**安装向导**，通过 Web 界面完成配置。

4.  **运行应用**
    启动开发服务器（前后端联调）：
    ```bash
    npm run dev
    ```
    - 前端: http://localhost:5173
    - 后端: http://localhost:3030

## 📦 部署

VanceFeedback 提供了灵活的部署方案，适配多种生产环境。详细方案请参考 [部署推荐指南](docs/RECOMMENDED_DEPLOYMENTS.md)。

### 1. Docker 部署（推荐）
你可以直接使用 Docker Hub 上的官方镜像：
```bash
docker run -d -p 3000:3000 --name vancefeedback vancehud/vancefeedback:latest
```

或者使用源码编译启动完整环境：
```bash
docker-compose -f docker-compose.separated.yml up -d --build
```
更多详情请参考 [DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md) 和 [DEPLOY_SEPARATED.md](docs/DEPLOY_SEPARATED.md)。

### 2. Vercel 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvancehuds%2FVanceFeedback&env=JWT_SECRET,DB_TYPE,DB_HOST,DB_PORT,DB_USER,DB_NAME,DB_PASSWORD&project-name=VanceFeedback)

支持前后端分离或全栈部署到 Vercel Serverless 环境：
- **全栈部署**：前后端均托管于 Vercel。详见 [DEPLOY_VERCEL_FULLSTACK.md](docs/DEPLOY_VERCEL_FULLSTACK.md)。
- **前端 Vercel + 后端 VPS**：前端部署到 Vercel CDN，后端独立部署。详见 [DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)。

## 📁 项目结构

```
VanceFeedback/
├── src/                          # 前端核心代码
│   ├── App.jsx                   # 应用入口与路由配置
│   ├── api.js                    # API 请求封装
│   ├── index.css                 # 全局样式
│   ├── pages/                    # 页面组件
│   │   ├── Home.jsx              # 用户首页（工单列表）
│   │   ├── Login.jsx             # 登录/注册
│   │   ├── Dashboard.jsx         # 管理员仪表盘
│   │   ├── SetupWizard.jsx       # 安装向导
│   │   ├── KnowledgeBase.jsx     # 知识库
│   │   ├── UserCenter.jsx        # 用户中心
│   │   ├── admin/                # PC 端管理页面
│   │   └── mobile/               # 移动端页面（含 admin）
│   ├── components/               # 可复用组件
│   └── utils/                    # 工具函数
├── server/                       # 后端服务代码
│   ├── app.js                    # Express 应用配置
│   ├── db.js                     # 数据库初始化与连接
│   ├── installer.js              # 数据库迁移与安装
│   ├── security.js               # RSA 密钥管理
│   ├── routes/                   # API 路由
│   │   ├── tickets.js            # 工单 CRUD
│   │   ├── auth.js               # 认证
│   │   ├── users.js              # 用户管理
│   │   ├── ai-qa.js              # AI 知识问答
│   │   ├── knowledge-base.js     # 知识库管理
│   │   ├── announcements.js      # 公告管理
│   │   ├── settings.js           # 系统设置
│   │   └── ...                   # 更多路由
│   ├── services/                 # 业务服务
│   │   ├── ai.js                 # AI 服务 (Gemini / BigModel)
│   │   ├── email.js              # 邮件服务
│   │   ├── dingtalk.js           # 钉钉通知
│   │   └── rateLimitStore.js     # 速率限制存储
│   └── middleware/               # 中间件
│       ├── auth.js               # JWT 认证
│       ├── rateLimiter.js        # 速率限制
│       └── recaptcha.js          # 验证码验证
├── docs/                         # 部署文档
├── Dockerfile*                   # Docker 构建文件
├── docker-compose*.yml           # Docker Compose 编排
└── nginx.conf                    # Nginx 配置（前端容器）
```

## 📄 许可证

[MIT License](LICENSE)

## ⭐ Star 历史

[![Stargazers over time](https://starchart.cc/vancehuds/VanceFeedback.svg?variant=adaptive)](https://starchart.cc/vancehuds/VanceFeedback)
