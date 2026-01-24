# ==============================================================================
# Frontend SQAL Dockerfile - React + Vite Application
# ==============================================================================

# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files from FrontEnd subdirectory
COPY FrontEnd/package.json FrontEnd/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy application code from FrontEnd subdirectory
COPY FrontEnd/ .

# Set build-time environment variables
ARG VITE_API_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build application with full TypeScript checking
# Increase Node.js heap size for large build
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Runner (Nginx)
FROM nginx:alpine AS runner

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration from FrontEnd directory
COPY FrontEnd/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80 || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
