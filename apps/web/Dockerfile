# syntax=docker/dockerfile:1
# Builds the SPA and serves it with nginx. Build context: the repo root.
#   docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY apps/web apps/web

# Vite inlines VITE_* at build time. Defaults target the local compose stack.
ARG VITE_BACKEND=supabase
ARG VITE_SUPABASE_URL=http://localhost:54321
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_BACKEND=$VITE_BACKEND \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build -w @codesnip/web

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
