# ---------- Build Stage ----------
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---------- Runtime Stage ----------
FROM oven/bun:1-slim
WORKDIR /app

# Sharp + libvips
RUN apt-get update && \
    apt-get install -y --no-install-recommends libvips42 && \
    rm -rf /var/lib/apt/lists/*

# Copia dist e src (necessário por causa dos imports com 'src/...')
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

RUN bun install --production --frozen-lockfile

EXPOSE 3000

CMD ["bun", "start:prod"]