# Pillaxia API - Express + PostgREST proxy
FROM node:20-alpine AS api
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
EXPOSE 3000

CMD ["node", "src/index.js"]
