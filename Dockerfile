# Build Stage for Frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./
COPY src/ ./src/
# Install dependencies including devDependencies for build
RUN npm install
RUN npm run build

# Production Stage
FROM node:24-alpine
WORKDIR /app

# Copy Backend Files
COPY package*.json ./
COPY server/ ./server/

# Install native build tools required by sqlite3 (node-gyp)
RUN apk add --no-cache python3 make g++ gcc

# Install ONLY production dependencies
# Note: we are in the root directory, so we install root dependencies which include backend packages
# We use --omit=dev to avoid installing devDependencies like Vite/Tailwind in production
RUN npm install --omit=dev

# Remove build tools to keep the image small
RUN apk del python3 make g++ gcc

# Copy Built Frontend from Builder Stage
COPY --from=frontend-builder /app/dist ./dist

# Create Data and Config Directories
RUN mkdir -p server/data && mkdir -p server/config

# Expose API Port
EXPOSE 3000

# Start Server
CMD ["node", "server/index.js"]
