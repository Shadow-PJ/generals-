# The relay as a container: `docker build -t generals-relay server && docker run -p 8787:8787 generals-relay`.
FROM node:22-alpine
WORKDIR /relay
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY protocol.ts relay.ts ./
RUN npm run build && npm prune --omit=dev
ENV PORT=8787
EXPOSE 8787
CMD ["node", "build/relay.js"]
