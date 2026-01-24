# Dockerfile pour SQAL Frontend (Vite + React)
# Système de Qualification Alimentaire Temps Réel

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copier package files
COPY package*.json ./

# Installer les dépendances (skip prepare script to avoid Husky)
RUN npm ci --ignore-scripts

# Copier le code source
COPY . .

# Build l'application (increase Node heap size for large build)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Production - Use nginx for serving static files
FROM nginx:alpine

# Copier le build depuis le stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier la configuration nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port 80 (nginx default)
EXPOSE 80

# Démarrer nginx
CMD ["nginx", "-g", "daemon off;"]