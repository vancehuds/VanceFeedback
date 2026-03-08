# VanceFeedback Docker 部署指南

本指南介绍了如何使用 Docker 部署 VanceFeedback 系统。该 Docker 镜像是一个多合一容器，同时运行后端 API 和前端应用。

## 先决条件

- 您的机器上已安装 Docker。
- 现有的 MySQL 数据库（可选，请参阅配置模式）。

## 快速开始

### 1. 构建并运行

在项目根目录下运行以下命令：

```bash
docker compose up --build -d
```

应用程序将可以通过以下地址访问：`http://localhost:3000`

## 配置模式

配置应用程序有两种方式：

### 模式 A：基于 UI 的设置（首次使用推荐）

1. 保持 `docker-compose.yml` 中的 `environment` 部分处于注释状态（默认）。
2. 启动容器：`docker-compose up -d`。
3. 在浏览器中打开 `http://localhost:3000`。
4. 您将被重定向到 **安装页面**。
5. 在网页表单中输入您的数据库详细信息和管理员帐户信息。
6. 系统将保存配置并进行初始化。

*注意：配置保存在 `server/config/db_config.json` 中。由于此路径位于容器内部，如果您在没有挂载卷的情况下重建容器，配置可能会丢失。不过，此模式非常适合快速测试。*

### 模式 B：环境变量配置（自动配置）

将此模式用于自动部署，或者如果您想跳过 UI 设置。

1. 打开 `docker-compose.yml`。
2. 取消注释并填写 `environment` 变量：

```yaml
    environment:
      - DB_TYPE=mysql
      - DB_HOST=host.docker.internal  # 或者您的数据库 IP
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASS=your_password
      - DB_NAME=qli_feedback
      # 如果设置了这些，系统将在首次运行时自动创建管理员用户
      - ADMIN_USER=admin
      - ADMIN_PASS=admin123
```

3. 启动容器：`docker-compose up -d`。
4. 系统将自动连接、初始化表并创建管理员用户。
5. 打开 `http://localhost:3000` 并直接登录。

## 连接到宿主机数据库

如果您的 MySQL 数据库运行在宿主机上（Docker 外部），请使用主机名：

- **Windows/Mac**: `host.docker.internal`
- **Linux**: 使用宿主机的 IP 地址（例如 `172.17.0.1`）

## 数据持久化 (SQLite)

如果您选择使用 SQLite 而不是 MySQL，请在 `docker-compose.yml` 中挂载数据卷以持久化更改：

```yaml
    volumes:
       - ./data:/app/server/data
```

## Nginx 反向代理配置 (推荐)

在生产环境中，无论是 Windows 还是 Linux，通常使用 Nginx 进行反向代理。

由于 Docker 容器内部已经处理了前端静态文件和 SPA (单页应用) 路由（伪静态），**Nginx 只需要配置纯反向代理即可**，无需配置 `try_files` 或其他复杂的静态规则。

为了确保数据持久化，建议挂载以下卷：
   - **`/server/data`**: 用于 SQLite 数据库持久化（映射到宿主机的 `./server/data`）。
   - **`/server/config`**: 用于 `db_config.json` 持久化（映射到宿主机的 `./server/config`）。

以下是标准的 Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your_domain.com;  # 替换为您的域名

    location / {
        # 将请求转发到 Docker 容器的 3000 端口
        proxy_pass http://127.0.0.1:3000;
        
        # 标准代理头设置
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持 (如果未来需要)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
