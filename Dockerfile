FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3101
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
# Sesiones de login (.sessions.json) en un volumen escribible por node.
RUN mkdir data && chown node:node data && ln -s data/.sessions.json .sessions.json
USER node
EXPOSE 3101
# Credenciales (JIRA_*) por variables de entorno: nunca dentro de la imagen.
CMD ["node", "server/index.js"]
