# Etapa 1: instala as dependências e compila o TypeScript
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Etapa 2: imagem final, só com o necessário para rodar
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY config ./config

# Pasta do banco SQLite (montada como volume no docker-compose)
RUN mkdir -p data && chown node:node data
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]