# Build Stage for Frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./
COPY src/ ./src/
# Install dependencies and build frontend in one layer
RUN npm install && npm run build

# Production Stage
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy Backend Files
COPY package*.json ./
COPY server/ ./server/

# Install build tools as a virtual package for clean removal,
# build better-sqlite3 native module, then remove tools + cache
RUN apk add --no-cache --virtual .build-deps python3 make g++ && \
    npm install --omit=dev && \
    npm cache clean --force && \
    apk del .build-deps

# Copy Built Frontend from Builder Stage
COPY --from=frontend-builder /app/dist ./dist

# Create Data and Config Directories
RUN mkdir -p server/data && mkdir -p server/config

# Expose API Port
EXPOSE 3000

# Start Server
CMD ["node", "server/index.js"]
