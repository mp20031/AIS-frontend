# AIS Hub portal — Vue 3 + Vite, served as static files by nginx.
#
#   docker build -t ais-portal --build-arg VITE_API_BASE_URL=http://localhost:8010/ .
#   docker run -p 5173:80 ais-portal
#
# VITE_* variables are resolved at BUILD time, not at startup: changing the API
# URL requires rebuilding the image.

# --- build -------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

ARG VITE_API_BASE_URL=http://localhost:8010/
ARG VITE_API_TIMEOUT_MS=15000
ARG VITE_AUTH_TOKEN_KEY=ais_access_token
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_TIMEOUT_MS=$VITE_API_TIMEOUT_MS \
    VITE_AUTH_TOKEN_KEY=$VITE_AUTH_TOKEN_KEY

COPY . .
RUN npm run build


# --- runtime -----------------------------------------------------------------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
