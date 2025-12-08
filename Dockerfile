# ---------- Build Stage ----------
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lockb ./
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

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN bun install --production --frozen-lockfile

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "start:prod"]