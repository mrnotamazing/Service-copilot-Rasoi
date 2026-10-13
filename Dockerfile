# TableMate: build the web app, then run the API + static server.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production COPILOT_PORT=4000
WORKDIR /app
COPY package.json package-lock.json ./
# tsx runs the TypeScript server directly, so dev dependencies stay installed.
RUN npm ci --no-audit --no-fund && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
COPY tsconfig.json ./
COPY --from=build /app/dist ./dist
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 4000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://localhost:'+process.env.COPILOT_PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "server/index.ts"]
