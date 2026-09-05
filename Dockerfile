# ==========================================
# Battle City 1990 - Multi-Stage Production Dockerfile
# ==========================================

# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build Vite client assets & bundle production server.cjs
RUN npm run build

# ==========================================
# Stage 2: Minimal Production Runtime
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production runtime dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built distribution assets from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
USER node

# Expose game & websocket port
EXPOSE 3000

# Healthcheck probe for VPS / container orchestrator
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Start the Battle City 1990 production server
CMD ["node", "dist/server.cjs"]
