# VanceFeedback

[![GitHub](https://img.shields.io/badge/GitHub-vancehuds%2FVanceFeedback-blue?logo=github)](https://github.com/vancehuds/VanceFeedback)
[![Docker](https://img.shields.io/badge/Docker-vancehud%2Fvancefeedback-blue?logo=docker&logoColor=white)](https://hub.docker.com/r/vancehud/vancefeedback)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

VanceFeedback is a modern, intelligent feedback and ticket management system. Built with a client-server architecture using React for the frontend and Express for the backend, it integrates **Google Gemini AI** and **ZhiPu BigModel** dual AI engines to enhance the efficiency of user feedback collection, tracking, and management.

> [中文文档](README.md)

## ✨ Key Features

- **🤖 AI Intelligent Assistant**:
  - Dual AI engine support: **Google Gemini** and **ZhiPu BigModel** with automatic fallback.
  - Auto-generate ticket summaries to quickly grasp core issues using AI.
  - Smart reply suggestions to improve support efficiency.
  - **AI Knowledge Q&A**: Intelligent Q&A system powered by your knowledge base content.
- **📚 Knowledge Base**:
  - Create and manage knowledge base articles with categories.
  - Public-facing knowledge base search and browsing.
  - AI-powered knowledge base Q&A.
- **📱 Mobile Optimization**:
  - Dedicated mobile admin dashboard designed with gesture support and responsive layouts.
  - Full mobile admin features: tickets, users, analytics, knowledge base, announcements, settings, and more.
  - Manage tickets, view users, and handle feedback anytime, anywhere.
- **🛡️ Enhanced Security**:
  - **Multi-CAPTCHA Support**: Flexibly supports **Cloudflare Turnstile** and **Altcha** (including Proof-of-Work verification).
  - **API Rate Limiting**: Role-based rate limiting strategies to protect against abuse and DDoS attacks.
  - **Secure Authentication**: Email verification, JWT authentication, RSA-encrypted transmission, and encrypted password storage.
- **👥 Role-Based Access Control (RBAC)**:
  - **User**: Submit feedback, track real-time ticket progress, rate satisfaction.
  - **Admin**: Full ticket management capabilities with AI assistance.
  - **Super Admin**: System configuration, user management, audit log viewing.
- **📢 Announcement System**:
  - Admin-published announcements with user-facing display.
- **📊 Data Visualization**:
  - Admin dashboard providing time-based trend analysis, ticket statistics, and satisfaction distribution.
- **⚙️ Rich System Administration**:
  - **Setup Wizard**: Guided first-time deployment configuration for zero-barrier setup.
  - **Custom Question Types**: Flexible ticket category definitions.
  - **Email Template Management**: Customize notification email content.
  - **Admin Notifications**: Real-time notifications for ticket changes.
  - **DingTalk Notifications**: DingTalk webhook integration for new ticket alerts.
  - **Audit Logs**: Complete system operation logging.
- **📤 Flexible Deployment**:
  - Supports Docker containerized deployment (combined or separated).
  - Supports Serverless environment deployment (e.g., Vercel).
  - Supports PWA (Progressive Web App).

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 (Vite 7)
- **Styling**: Tailwind CSS 4, PostCSS
- **Icons**: Lucide React
- **Charts**: Recharts 3
- **Routing**: React Router DOM v7
- **HTTP Client**: Axios
- **PWA**: vite-plugin-pwa
- **Analytics**: Vercel Analytics & Speed Insights

### Backend
- **Runtime**: Node.js
- **Framework**: Express 5
- **AI Engine**: Google Generative AI (Gemini) / ZhiPu BigModel (dual engine with auto-fallback)
- **Database**: SQLite (Dev/Lightweight) / MySQL (Recommended for Production)
- **Security**: Node-RSA, bcryptjs, Helmet, Express Rate Limit
- **CAPTCHA**: Altcha Lib, Cloudflare Turnstile
- **Email**: Nodemailer
- **Notifications**: DingTalk Webhook

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Google Gemini API Key and/or ZhiPu BigModel API Key (for AI features, optional)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/vancehuds/VanceFeedback.git
    cd VanceFeedback
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configuration**
    Copy the example configuration file:
    ```bash
    cp .env.example .env
    ```
    Edit the `.env` file and configure key settings:
    - Database connection (`DB_TYPE`, `DB_HOST`, etc.)
    - JWT Secret (`JWT_SECRET`)
    - Email Service (SMTP)
    - `GEMINI_API_KEY` and/or `BIGMODEL_API_KEY` (for AI features)
    - CAPTCHA Service Keys (Turnstile / Altcha)

    > 💡 If you don't configure environment variables, the **Setup Wizard** will guide you through configuration on first launch via the web interface.

4.  **Run the Application**
    Start the development server (Frontend + Backend):
    ```bash
    npm run dev
    ```
    - Frontend: http://localhost:5173
    - Backend: http://localhost:3030

## 📦 Deployment

VanceFeedback supports flexible deployment options suitable for various production environments. See the [Deployment Recommendation Guide](docs/RECOMMENDED_DEPLOYMENTS.md) for details.

### 1. Docker Deployment (Recommended)
You can directly use the official image from Docker Hub:
```bash
docker run -d -p 3000:3000 --name vancefeedback vancehud/vancefeedback:latest
```

Or launch the full environment from source:
```bash
docker-compose -f docker-compose.separated.yml up -d --build
```
For more details, refer to [DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md) and [DEPLOY_SEPARATED.md](docs/DEPLOY_SEPARATED.md).

### 2. Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvancehuds%2FVanceFeedback&env=JWT_SECRET,DB_TYPE,DB_HOST,DB_PORT,DB_USER,DB_NAME,DB_PASSWORD&project-name=VanceFeedback)

Supports separated or full-stack deployment on Vercel Serverless:
- **Full-stack Deployment**: Both frontend and backend hosted on Vercel. See [DEPLOY_VERCEL_FULLSTACK.md](docs/DEPLOY_VERCEL_FULLSTACK.md).
- **Frontend Vercel + Backend VPS**: Frontend on Vercel CDN, backend deployed independently. See [DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md).

## 📁 Project Structure

```
VanceFeedback/
├── src/                          # Frontend core code
│   ├── App.jsx                   # Application entry & routing
│   ├── api.js                    # API request abstraction
│   ├── index.css                 # Global styles
│   ├── pages/                    # Page components
│   │   ├── Home.jsx              # User home (ticket list)
│   │   ├── Login.jsx             # Login / Register
│   │   ├── Dashboard.jsx         # Admin dashboard
│   │   ├── SetupWizard.jsx       # Setup Wizard
│   │   ├── KnowledgeBase.jsx     # Knowledge base
│   │   ├── UserCenter.jsx        # User center
│   │   ├── admin/                # Desktop admin pages
│   │   └── mobile/               # Mobile pages (incl. admin)
│   ├── components/               # Reusable components
│   └── utils/                    # Utility functions
├── server/                       # Backend service code
│   ├── app.js                    # Express app configuration
│   ├── db.js                     # Database initialization
│   ├── installer.js              # Database migration & setup
│   ├── security.js               # RSA key management
│   ├── routes/                   # API routes
│   │   ├── tickets.js            # Ticket CRUD
│   │   ├── auth.js               # Authentication
│   │   ├── users.js              # User management
│   │   ├── ai-qa.js              # AI Knowledge Q&A
│   │   ├── knowledge-base.js     # Knowledge base management
│   │   ├── announcements.js      # Announcement management
│   │   ├── settings.js           # System settings
│   │   └── ...                   # More routes
│   ├── services/                 # Business services
│   │   ├── ai.js                 # AI service (Gemini / BigModel)
│   │   ├── email.js              # Email service
│   │   ├── dingtalk.js           # DingTalk notifications
│   │   └── rateLimitStore.js     # Rate limit storage
│   └── middleware/               # Middleware
│       ├── auth.js               # JWT authentication
│       ├── rateLimiter.js        # Rate limiting
│       └── recaptcha.js          # CAPTCHA verification
├── docs/                         # Deployment documentation
├── Dockerfile*                   # Docker build files
├── docker-compose*.yml           # Docker Compose orchestration
└── nginx.conf                    # Nginx config (frontend container)
```

## 📄 License

[MIT License](LICENSE)

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vancehuds/VanceFeedback&type=Date)](https://star-history.com/#vancehuds/VanceFeedback&Date)
