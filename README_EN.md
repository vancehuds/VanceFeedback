# VanceFeedback

[![GitHub](https://img.shields.io/badge/GitHub-vancehuds%2FVanceFeedback-blue?logo=github)](https://github.com/vancehuds/VanceFeedback)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

VanceFeedback is a modern, intelligent feedback and ticket management system. Built with a client-server architecture using React for the frontend and Express for the backend, it integrates **Google Gemini AI** or **ZhiPu BigModel** powered automation to enhance the efficiency of user feedback collection, tracking, and management.

> [中文文档](README.md)

## Key Features

- **🤖 AI Intelligent Assistant**:
  - Automatically generate ticket summaries to quickly grasp core issues using AI.
  - Smart reply suggestions.
- **📱 Mobile Optimization**:
  - Dedicated mobile admin dashboard designed with gesture support and responsive layouts.
  - Manage tickets, view users, and handle feedback anytime, anywhere.
- **🛡️ Enhanced Security**:
  - **Multi-CAPTCHA Support**: Flexibly supports **Cloudflare Turnstile** and **Altcha** (including Proof-of-Work verification).
  - **API Rate Limiting**: Role-based rate limiting strategies to protect against abuse and DDoS attacks.
  - **Secure Authentication**: Email verification, JWT authentication, and encrypted password storage.
- **👥 Role-Based Access Control (RBAC)**:
  - **User**: Submit feedback, track real-time ticket progress.
  - **Admin**: Full ticket management capabilities with AI assistance.
  - **Super Admin**: System configuration, user management, audit log viewing.
- **📈 Data Visualization**:
  - Admin dashboard providing time-based trend analysis, ticket statistics, and satisfaction distribution.
- **📤 Flexible Deployment**:
  - Supports Docker containerized deployment (separated or combined).
  - Supports Serverless environment deployment (e.g., Vercel).

## Tech Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS, PostCSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **AI Engine**: Google Generative AI (Gemini)
- **Database**: SQLite (Dev/Test) / MySQL (Recommended for Production)
- **Security**: Node-RSA, Helmet, Express Rate Limit
- **CAPTCHA**: Altcha Lib, Cloudflare Turnstile

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Google Gemini API Key (Required for AI features)
- ZhiPu BigModel API Key (Required for AI features)

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
    - Database connection
    - JWT Secret
    - Email Service (SMTP)
    - **GEMINI_API_KEY** (Required for AI)
    - CAPTCHA Service Keys (Turnstile/Altcha)

4.  **Run the Application**
    Start the development server (Frontend + Backend):
    ```bash
    npm run dev
    ```
    - Frontend: http://localhost:5173
    - Backend: http://localhost:3000

## Deployment

VanceFeedback supports flexible deployment options suitable for various production environments.

### 1. Docker Deployment (Recommended)
Launch the full environment with a single command:
```bash
docker-compose -f docker-compose.separated.yml up -d --build
```
For more details, refer to [DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md).

### 2. Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvancehuds%2FVanceFeedback&env=JWT_SECRET,DB_TYPE,DB_HOST,DB_PORT,DB_USER,DB_NAME,DB_PASSWORD&project-name=VanceFeedback)


Supports separated frontend and backend deployment on Vercel Serverless:
- Frontend can be imported directly to Vercel.
- Backend runs as Serverless Functions.
See [DEPLOY_VERCEL_FULLSTACK.md](docs/DEPLOY_VERCEL_FULLSTACK.md) for detailed instructions.

### 3. Separated Deployment
For traditional server environments, please refer to [DEPLOY_SEPARATED.md](docs/DEPLOY_SEPARATED.md).

## Project Structure

- **`src/`**: Frontend core code
  - `pages/`: Page components (including `MobileAdmin*` pages)
  - `components/`: Reusable components
- **`server/`**: Backend service code
  - `routes/`: API routes (including `aiRoutes.js`)
  - `services/`: Business logic services
  - `middleware/`: Middleware (RateLimiter, Auth)

## License

[MIT License](LICENSE)
