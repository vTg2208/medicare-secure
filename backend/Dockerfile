FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY package.json package-lock.json ./

FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY src ./src
COPY scripts ./scripts
EXPOSE 5000
CMD ["dumb-init", "npm", "run", "dev"]

FROM base AS dependencies
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine AS production
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
RUN mkdir -p uploads logs && chown node:node uploads logs
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:5000/readyz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["dumb-init", "node", "src/server.js"]
