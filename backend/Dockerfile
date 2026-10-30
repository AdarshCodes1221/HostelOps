# Multi-stage minimal production Dockerfile for HMS Backend
FROM node:20-alpine AS base

# Install curl / wget for container health checks
RUN apk add --no-cache wget

WORKDIR /app

# Install dependencies (utilizing Docker layer caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source code
COPY config ./config
COPY controllers ./controllers
COPY middleware ./middleware
COPY models ./models
COPY routes ./routes
COPY services ./services
COPY utils ./utils
COPY server.js balanceHostels.js ./

# Ensure uploads directory and subfolders exist with correct permissions
RUN mkdir -p uploads/mess-menu uploads/profile-images uploads/bus-routes uploads/notices \
    && chown -R node:node /app

# Switch to non-root user for production security
USER node

# Expose backend port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:5000/api/health || exit 1

# Graceful shutdown support with standard Node command
CMD ["node", "server.js"]
