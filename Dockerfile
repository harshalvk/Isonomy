FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build src/index.ts --outdir dist --target bun

FROM oven/bun:1-slim AS prod
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json ./
ENV NODE_ENV=production
CMD ["bun", "dist/index.js"]