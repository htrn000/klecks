FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run icon:build && npm run lang:build && npm run build

FROM node:22-alpine AS api
WORKDIR /app
COPY server/package.json server/server.js ./server/
ENV DATA_DIR=/data PORT=3000 HOST=0.0.0.0
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server/server.js"]

FROM node:22-alpine AS static
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server/static-proxy.js ./server/static-proxy.js
ENV STATIC_DIR=/app/dist PORT=5050 PROJECT_API_HOST=project-api PROJECT_API_PORT=3000
EXPOSE 5050
CMD ["node", "server/static-proxy.js"]
