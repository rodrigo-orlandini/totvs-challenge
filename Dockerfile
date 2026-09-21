FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

FROM base AS dev
RUN npm install && npx prisma generate
COPY tsconfig*.json ./
CMD ["npx", "tsx", "watch", "src/main.ts"]

FROM base AS build
RUN npm ci && npx prisma generate
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
